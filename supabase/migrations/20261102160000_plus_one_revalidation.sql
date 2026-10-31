-- +1 à revalider après un désistement.
--
-- Avant : si Lola déclinait puis revenait, son +1 déjà accepté réapparaissait
-- tout seul ; après un retrait de son invitation, il était perdu (la ligne
-- rsvps est supprimée).
--
-- Maintenant :
--   - Lola repasse de « décliné » à « présente » ou « peut-être » (rsvps.status
--     declined → going / pending) : plus_one_status accepted → pending, nom et
--     message gardés. Entre « présente » et « peut-être », rien ne change.
--   - remove_event_invitation met le +1 (accepté ou en attente) de côté dans
--     plus_one_holds ; quand Lola, réinvitée, répond « présente » ou
--     « peut-être », il revient en attente.
--   - Dans les deux cas l'organisateur reçoit la notification habituelle de
--     demande de +1, et le +1 n'est compté nulle part tant qu'il n'est pas
--     revalidé (event_guest_statuses ne retient que accepted).
--
-- Aussi : un invité pouvait créer sa ligne rsvps avec un +1 déjà « accepted »
-- (guard_plus_one_status ne contrôlait que les UPDATE). Refusé désormais.

-- ---------------------------------------------------------------------------
-- 1. +1 mis de côté lors d'un retrait d'invitation (interne)
-- ---------------------------------------------------------------------------
create table if not exists public.plus_one_holds (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plus_one_name text,
  plus_one_message text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.plus_one_holds enable row level security;
revoke all on table public.plus_one_holds from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Retour après un désistement : le +1 repasse en attente
-- ---------------------------------------------------------------------------
-- BEFORE : la ligne renvoyée au client (upsert … select) montre déjà pending.
create or replace function public.reset_plus_one_on_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.plus_one_holds;
begin
  if tg_op = 'INSERT'
     and new.plus_one_status in ('accepted', 'declined')
     and auth.uid() is not null
     and not public.is_event_organizer(new.event_id) then
    raise exception 'Seul un organisateur peut valider ou refuser un +1' using errcode = '42501';
  end if;

  if new.status not in ('going', 'pending') then
    return new;
  end if;

  select * into v_hold from public.plus_one_holds h
  where h.event_id = new.event_id and h.user_id = new.user_id;

  if v_hold.event_id is not null and coalesce(new.plus_one_status, 'none') = 'none' then
    new.plus_one_requested := true;
    new.plus_one_status := 'pending';
    new.plus_one_name := v_hold.plus_one_name;
    new.plus_one_message := v_hold.plus_one_message;
  elsif tg_op = 'UPDATE' and old.status = 'declined' and new.plus_one_status = 'accepted' then
    new.plus_one_status := 'pending';
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_plus_one_on_return() from public, anon, authenticated;

drop trigger if exists trg_reset_plus_one_on_return on public.rsvps;
create trigger trg_reset_plus_one_on_return
  before insert or update of status on public.rsvps
  for each row execute function public.reset_plus_one_on_return();

-- AFTER : le +1 mis de côté est consommé une fois la réponse réellement
-- enregistrée (un upsert passe d'abord par BEFORE INSERT même s'il finit en
-- UPDATE).
create or replace function public.clear_plus_one_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('going', 'pending') then
    delete from public.plus_one_holds h
    where h.event_id = new.event_id and h.user_id = new.user_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.clear_plus_one_hold() from public, anon, authenticated;

drop trigger if exists trg_clear_plus_one_hold on public.rsvps;
create trigger trg_clear_plus_one_hold
  after insert or update of status on public.rsvps
  for each row execute function public.clear_plus_one_hold();

-- La notification de demande de +1 doit partir aussi quand c'est un trigger
-- (et non la requête) qui met plus_one_status à pending : plus de liste de
-- colonnes, et aussi à l'insertion. notify_plus_one_change ne notifie que sur
-- un vrai changement (ancien statut comparé au nouveau).
drop trigger if exists trg_notify_plus_one_change on public.rsvps;
create trigger trg_notify_plus_one_change
  after insert or update on public.rsvps
  for each row execute function public.notify_plus_one_change();

-- ---------------------------------------------------------------------------
-- 3. Retrait d'une invitation : le +1 est mis de côté
-- ---------------------------------------------------------------------------
-- Corps repris de 20261101160000, + insert into plus_one_holds.
create or replace function public.remove_event_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or not public.is_event_organizer(v_inv.event_id) then
    raise exception 'Seuls les organisateurs peuvent retirer une invitation' using errcode = '42501';
  end if;

  v_user := coalesce(
    v_inv.invited_user_id,
    (select p.id from public.profiles p where lower(p.email) = lower(v_inv.invited_email) limit 1)
  );

  if v_user is not null and exists (
    select 1 from public.event_organizers o
    where o.event_id = v_inv.event_id and o.user_id = v_user
      and o.role in ('owner', 'co_organizer') and o.status = 'approved'
  ) then
    raise exception 'Impossible de retirer un organisateur' using errcode = '42501';
  end if;

  delete from public.invitations where id = v_inv.id;

  if v_user is not null then
    insert into public.plus_one_holds (event_id, user_id, plus_one_name, plus_one_message)
    select r.event_id, r.user_id, r.plus_one_name, r.plus_one_message
    from public.rsvps r
    where r.event_id = v_inv.event_id and r.user_id = v_user
      and r.plus_one_status in ('accepted', 'pending')
    on conflict (event_id, user_id) do update
      set plus_one_name = excluded.plus_one_name,
          plus_one_message = excluded.plus_one_message,
          created_at = now();

    delete from public.rsvps where event_id = v_inv.event_id and user_id = v_user;
    delete from public.poll_reminders where event_id = v_inv.event_id and user_id = v_user;
    delete from public.notifications
     where user_id = v_user
       and not read
       and type in ('event_invitation', 'invitation_reminder', 'poll_reminder')
       and data->>'event_id' = v_inv.event_id::text;
  end if;
end;
$$;

revoke execute on function public.remove_event_invitation(uuid) from public, anon;
grant execute on function public.remove_event_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rétention : les +1 mis de côté suivent les noms de +1
-- ---------------------------------------------------------------------------
-- Corps tel qu'en base au 2026-10-31 (20261101230000), + plus_one_holds.
create or replace function public.run_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notifications integer;
  v_activity integer;
  v_reports integer;
  v_support_limits integer;
  v_guest_rsvps integer;
  v_public_rsvps integer;
  v_invitations_deleted integer;
  v_invitations_emails_cleared integer;
  v_plus_ones_cleared integer;
  v_plus_one_holds integer;
  v_warnings_reset integer;
  v_cagnotte_payment_info integer;
  v_event_photos integer;
begin
  delete from public.notifications
  where created_at < now() - interval '6 months';
  get diagnostics v_notifications = row_count;

  delete from public.activity
  where created_at < now() - interval '12 months';
  get diagnostics v_activity = row_count;

  delete from public.reports
  where coalesce(handled_at, created_at) < now() - interval '12 months';
  get diagnostics v_reports = row_count;

  delete from public.support_message_daily_limits
  where usage_date < (now() at time zone 'utc')::date;
  get diagnostics v_support_limits = row_count;

  -- Personnes sans compte
  delete from public.guest_rsvps
  where event_id in (select public.events_past_guest_retention());
  get diagnostics v_guest_rsvps = row_count;

  delete from public.public_rsvps
  where event_id in (select public.events_past_guest_retention())
     or (event_id is null and created_at < now() - interval '12 months');
  get diagnostics v_public_rsvps = row_count;

  delete from public.invitations
  where invited_user_id is null
    and (
      event_id in (select public.events_past_guest_retention())
      or (event_id is null and created_at < now() - interval '12 months')
    );
  get diagnostics v_invitations_deleted = row_count;

  update public.invitations
  set invited_email = null
  where invited_user_id is not null
    and invited_email is not null
    and event_id in (select public.events_past_guest_retention());
  get diagnostics v_invitations_emails_cleared = row_count;

  -- Nom et message des +1 (personnes sans compte) des utilisateurs inscrits
  update public.rsvps
  set plus_one_name = null, plus_one_message = null
  where (plus_one_name is not null or plus_one_message is not null)
    and event_id in (select public.events_past_guest_retention());
  get diagnostics v_plus_ones_cleared = row_count;

  delete from public.plus_one_holds
  where event_id in (select public.events_past_guest_retention());
  get diagnostics v_plus_one_holds = row_count;

  -- Coordonnées de paiement de la cagnotte : 30 jours après l'événement
  delete from public.event_cagnotte_payment_info pi
  using public.events e
  where e.id = pi.event_id
    and e.date is not null
    and e.date < now() - interval '30 days';
  get diagnostics v_cagnotte_payment_info = row_count;

  -- Album photo : 2 mois après l'événement, et au moins 30 jours après
  -- l'avertissement (event_photos_expires_at). Les fichiers suivent via
  -- storage_deletion_queue → purge-storage.
  delete from public.event_photos p
  where p.event_id in (
    select w.event_id from public.event_photos_expiry_warnings w
    where public.event_photos_expires_at(w.event_id) <= now()
  );
  get diagnostics v_event_photos = row_count;

  -- Comptes revenus après l'avertissement : on annule la suppression
  delete from public.account_inactivity_warnings w
  using public.account_activity() a
  where a.user_id = w.user_id
    and a.last_activity_at > w.warned_at;
  get diagnostics v_warnings_reset = row_count;

  return jsonb_build_object(
    'notifications', v_notifications,
    'activity', v_activity,
    'reports', v_reports,
    'support_limits', v_support_limits,
    'guest_rsvps', v_guest_rsvps,
    'public_rsvps', v_public_rsvps,
    'invitations_deleted', v_invitations_deleted,
    'invitations_emails_cleared', v_invitations_emails_cleared,
    'plus_ones_cleared', v_plus_ones_cleared,
    'plus_one_holds', v_plus_one_holds,
    'inactivity_warnings_reset', v_warnings_reset,
    'cagnotte_payment_info', v_cagnotte_payment_info,
    'event_photos', v_event_photos
  );
end;
$$;
