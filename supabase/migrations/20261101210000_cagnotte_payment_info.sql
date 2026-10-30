-- Cagnotte : « Comment me payer » (coordonnées du coordinateur), déclarations
-- de participation avec moyen utilisé et « Reçu », rappel avant la date limite.
--
-- Existant réutilisé :
--   event_cagnottes        : 1 ligne par événement (lien, objectif, cadeau).
--                            Le lien devient facultatif : une cagnotte peut
--                            n'être qu'un « envoyez-moi l'argent ».
--   cagnotte_contributions : 1 déclaration par personne (« J'ai participé »).
--   Coordinateur           : organisateur, co-organisateur approuvé ou
--                            guest_leader approuvé (« Je me propose »), jamais
--                            la personne fêtée (can_access_secret_space).
--
-- Confidentialité :
--   - les coordonnées (numéro, e-mail, IBAN, liens) ne sont lisibles que par
--     les membres de l'espace secret ; jamais dans un message ni une
--     notification ;
--   - montants individuels : la personne elle-même et les coordinateurs ;
--     les autres n'ont que le total et le nombre (get_cagnotte_summary) ;
--   - coordonnées supprimées 30 jours après l'événement (run_data_retention)
--     et avec le compte du coordinateur (on delete cascade).
-- Amiv ne traite ni ne vérifie aucun paiement : tout est déclaratif.

-- ── Coordinateurs de la cagnotte ───────────────────────────────────────────
create or replace function public.can_manage_cagnotte(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.can_access_secret_space(p_event_id)
    and (
      public.is_event_organizer(p_event_id)
      or exists (
        select 1 from public.event_organizers o
        where o.event_id = p_event_id
          and o.user_id = auth.uid()
          and o.role = 'guest_leader'
          and o.status = 'approved'
      )
    );
$$;

revoke execute on function public.can_manage_cagnotte(uuid) from public, anon;
grant execute on function public.can_manage_cagnotte(uuid) to authenticated;

-- ── Cagnotte : lien facultatif, gérée par les coordinateurs ────────────────
alter table public.event_cagnottes alter column url drop not null;

drop policy if exists "Organisateurs : création cagnotte" on public.event_cagnottes;
drop policy if exists "Coordinateurs : création cagnotte" on public.event_cagnottes;
create policy "Coordinateurs : création cagnotte"
  on public.event_cagnottes for insert to authenticated
  with check (
    public.can_manage_cagnotte(event_id)
    and (gift_id is null or exists (
      select 1 from public.gifts g where g.id = gift_id and g.event_id = event_cagnottes.event_id
    ))
  );

drop policy if exists "Organisateurs : modification cagnotte" on public.event_cagnottes;
drop policy if exists "Coordinateurs : modification cagnotte" on public.event_cagnottes;
create policy "Coordinateurs : modification cagnotte"
  on public.event_cagnottes for update to authenticated
  using (public.can_manage_cagnotte(event_id))
  with check (
    public.can_manage_cagnotte(event_id)
    and (gift_id is null or exists (
      select 1 from public.gifts g where g.id = gift_id and g.event_id = event_cagnottes.event_id
    ))
  );

drop policy if exists "Organisateurs : suppression cagnotte" on public.event_cagnottes;
drop policy if exists "Coordinateurs : suppression cagnotte" on public.event_cagnottes;
create policy "Coordinateurs : suppression cagnotte"
  on public.event_cagnottes for delete to authenticated
  using (public.can_manage_cagnotte(event_id));

-- ── Moyens de paiement ──────────────────────────────────────────────────────
-- [{type, value, holder?}] : 1 à 5 moyens, chacun une fois.
--   wero     : téléphone ou e-mail
--   lydia    : téléphone ou lien https lydia.me / lydia-app.com
--   paypal   : lien https://paypal.me/…
--   virement : IBAN (value) + titulaire (holder)
--   especes  : aucune valeur
create or replace function public.valid_cagnotte_payment_methods(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_typeof(p) = 'array', false)
    and jsonb_array_length(p) between 1 and 5
    and (select count(distinct m->>'type') = count(*) from jsonb_array_elements(p) m)
    and not exists (
      select 1
      from jsonb_array_elements(p) m,
           lateral (select coalesce(m->>'value', '') as v, coalesce(m->>'holder', '') as h) x
      where jsonb_typeof(m) <> 'object'
         or exists (select 1 from jsonb_object_keys(m) k where k not in ('type', 'value', 'holder'))
         or char_length(x.v) > 200
         or char_length(x.h) > 80
         or not coalesce(
              (m->>'type' = 'wero' and (x.v ~ '^\+?[0-9 .()-]{6,20}$' or x.v ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
           or (m->>'type' = 'lydia' and (x.v ~ '^\+?[0-9 .()-]{6,20}$' or x.v ~* '^https://([a-z0-9-]+\.)*(lydia\.me|lydia-app\.com)(/[^[:space:]]*)?$'))
           or (m->>'type' = 'paypal' and x.v ~* '^https://(www\.)?paypal\.me/[a-z0-9]{1,20}(/[^[:space:]]*)?$')
           or (m->>'type' = 'virement'
               and upper(regexp_replace(x.v, '\s', '', 'g')) ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
               and char_length(btrim(x.h)) between 2 and 80)
           or (m->>'type' = 'especes' and x.v = '' and x.h = ''),
              false)
    );
$$;

create table if not exists public.event_cagnotte_payment_info (
  event_id uuid primary key references public.event_cagnottes(event_id) on delete cascade,
  -- Coordinateur qui reçoit l'argent ; supprimé avec son compte
  recipient_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  methods jsonb not null check (public.valid_cagnotte_payment_methods(methods)),
  suggested_amount numeric(10, 2) check (suggested_amount is null or (suggested_amount > 0 and suggested_amount <= 100000)),
  -- Montant suggéré = objectif ÷ nombre de participants (calculé à l'affichage)
  split_goal boolean not null default false,
  deadline date,
  message text check (message is null or char_length(message) <= 280),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (split_goal and suggested_amount is not null))
);

create index if not exists event_cagnotte_payment_info_deadline_idx
  on public.event_cagnotte_payment_info (deadline)
  where reminded_at is null and deadline is not null;

-- Date limite modifiée : le rappel pourra repartir
create or replace function public.cagnotte_payment_info_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.deadline is distinct from old.deadline then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cagnotte_payment_info_before_update on public.event_cagnotte_payment_info;
create trigger trg_cagnotte_payment_info_before_update
  before update on public.event_cagnotte_payment_info
  for each row execute function public.cagnotte_payment_info_before_update();

alter table public.event_cagnotte_payment_info enable row level security;

revoke all on public.event_cagnotte_payment_info from anon, authenticated;
grant select, delete on public.event_cagnotte_payment_info to authenticated;
grant insert (event_id, methods, suggested_amount, split_goal, deadline, message)
  on public.event_cagnotte_payment_info to authenticated;
grant update (methods, suggested_amount, split_goal, deadline, message)
  on public.event_cagnotte_payment_info to authenticated;

drop policy if exists "Espace secret : lecture infos de paiement" on public.event_cagnotte_payment_info;
create policy "Espace secret : lecture infos de paiement"
  on public.event_cagnotte_payment_info for select to authenticated
  using (public.can_access_secret_space(event_id));

drop policy if exists "Coordinateur : ajout infos de paiement" on public.event_cagnotte_payment_info;
create policy "Coordinateur : ajout infos de paiement"
  on public.event_cagnotte_payment_info for insert to authenticated
  with check (recipient_id = auth.uid() and public.can_manage_cagnotte(event_id));

-- Seul le coordinateur qui reçoit l'argent modifie ses propres coordonnées
drop policy if exists "Coordinateur : modification infos de paiement" on public.event_cagnotte_payment_info;
create policy "Coordinateur : modification infos de paiement"
  on public.event_cagnotte_payment_info for update to authenticated
  using (recipient_id = auth.uid() and public.can_manage_cagnotte(event_id))
  with check (recipient_id = auth.uid() and public.can_manage_cagnotte(event_id));

-- Lui, ou un organisateur (pour qu'un autre coordinateur puisse reprendre)
drop policy if exists "Coordinateur : retrait infos de paiement" on public.event_cagnotte_payment_info;
create policy "Coordinateur : retrait infos de paiement"
  on public.event_cagnotte_payment_info for delete to authenticated
  using (
    public.can_manage_cagnotte(event_id)
    and (recipient_id = auth.uid() or public.is_event_organizer(event_id))
  );

-- ── Message système dans le chat Secret (sans montant ni coordonnées) ──────
alter table public.messages drop constraint if exists messages_system_type_check;
alter table public.messages add constraint messages_system_type_check check (
  system_type is null
  or (is_secret and system_type in ('memory_added', 'gift_added', 'cagnotte_joined', 'secret_reminder', 'cagnotte_payment_added'))
);

create or replace function public.cagnotte_payment_info_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.post_secret_system_message(
      new.event_id, new.recipient_id, 'cagnotte_payment_added',
      format('%s a ajouté les infos pour participer à la cagnotte', public.secret_display_first_name(new.recipient_id)),
      jsonb_build_object('tab', 'cagnotte')
    );
    return new;
  end if;

  delete from public.messages m
  where m.event_id = old.event_id
    and m.is_secret
    and m.system_type = 'cagnotte_payment_added';
  return old;
end;
$$;

drop trigger if exists trg_cagnotte_payment_info_message on public.event_cagnotte_payment_info;
create trigger trg_cagnotte_payment_info_message
  after insert or delete on public.event_cagnotte_payment_info
  for each row execute function public.cagnotte_payment_info_message();

-- ── Déclarations de participation ──────────────────────────────────────────
alter table public.cagnotte_contributions
  add column if not exists method text,
  add column if not exists received boolean not null default false,
  add column if not exists received_at timestamptz;

alter table public.cagnotte_contributions drop constraint if exists cagnotte_contributions_method_check;
alter table public.cagnotte_contributions add constraint cagnotte_contributions_method_check
  check (method is null or method in ('wero', 'lydia', 'paypal', 'virement', 'especes', 'autre'));

alter table public.cagnotte_contributions drop constraint if exists cagnotte_contributions_amount_check;
alter table public.cagnotte_contributions add constraint cagnotte_contributions_amount_check
  check (amount is null or amount between 0 and 100000);

-- « Reçu » : coordinateurs seulement. Le participant qui modifie sa
-- déclaration la repasse en « non reçu ».
create or replace function public.cagnotte_contribution_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.received is distinct from old.received then
    if not public.can_manage_cagnotte(new.event_id) then
      raise exception 'Seul un coordinateur peut confirmer la réception' using errcode = '42501';
    end if;
    new.received_at := case when new.received then now() end;
  elsif (new.amount is distinct from old.amount or new.method is distinct from old.method)
        and old.user_id = auth.uid() then
    new.received := false;
    new.received_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cagnotte_contribution_before_update on public.cagnotte_contributions;
create trigger trg_cagnotte_contribution_before_update
  before update on public.cagnotte_contributions
  for each row execute function public.cagnotte_contribution_before_update();

revoke all on public.cagnotte_contributions from anon, authenticated;
grant select, delete on public.cagnotte_contributions to authenticated;
grant insert (event_id, user_id, amount, method) on public.cagnotte_contributions to authenticated;
grant update (amount, method, received) on public.cagnotte_contributions to authenticated;

-- Montants individuels : soi-même et les coordinateurs
drop policy if exists "Espace secret : lecture contributions" on public.cagnotte_contributions;
create policy "Espace secret : lecture contributions"
  on public.cagnotte_contributions for select to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.can_manage_cagnotte(event_id))
  );

drop policy if exists "Espace secret : modification contribution" on public.cagnotte_contributions;
create policy "Espace secret : modification contribution"
  on public.cagnotte_contributions for update to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.can_manage_cagnotte(event_id))
  )
  with check (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.can_manage_cagnotte(event_id))
  );

drop policy if exists "Espace secret : suppression contribution" on public.cagnotte_contributions;
create policy "Espace secret : suppression contribution"
  on public.cagnotte_contributions for delete to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.can_manage_cagnotte(event_id))
  );

-- Total et nombre de participants, pour tous les membres
create or replace function public.get_cagnotte_summary(p_event_id uuid)
returns table (participants integer, total numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer, coalesce(sum(c.amount), 0)::numeric
  from public.cagnotte_contributions c
  where c.event_id = p_event_id
    and public.can_access_secret_space(p_event_id);
$$;

revoke execute on function public.get_cagnotte_summary(uuid) from public, anon;
grant execute on function public.get_cagnotte_summary(uuid) to authenticated;

-- ── Rappel 2 jours avant la date limite ────────────────────────────────────
alter table public.profiles add column if not exists notif_cagnotte boolean not null default true;
grant update (notif_cagnotte) on public.profiles to authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise', 'poll_reminder',
  'birthday_shared', 'secret_space_reminder', 'cagnotte_reminder'
]::text[]));

create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder', 'poll_reminder', 'secret_space_reminder') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    when p_type = 'cagnotte_reminder' then coalesce(p.notif_cagnotte, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- Une seule fois par cagnotte (reminded_at), à partir de 9 h (Paris) deux
-- jours avant la date limite, et jusqu'à la date limite incluse. Destinataires :
-- membres de l'espace secret sans déclaration, hors personne fêtée et hors
-- coordinateur qui reçoit l'argent, réglage « Rappels de cagnotte » activé.
-- Aucun montant ni coordonnée dans la notification.
create or replace function public.send_cagnotte_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer := 0;
  v_paris timestamp := now() at time zone 'Europe/Paris';
begin
  with due as (
    select pi.event_id, pi.recipient_id
    from public.event_cagnotte_payment_info pi
    where pi.reminded_at is null
      and pi.deadline is not null
      and v_paris >= (pi.deadline - 2) + time '09:00'
      and v_paris::date <= pi.deadline
    for update of pi skip locked
  ),
  processed as (
    update public.event_cagnotte_payment_info pi
       set reminded_at = now()
      from due
     where pi.event_id = due.event_id
    returning pi.event_id, pi.recipient_id, pi.deadline
  ),
  candidates as (
    select p.event_id, p.recipient_id, p.deadline, x.uid
    from processed p
    cross join lateral (
      select e.user_id as uid from public.events e where e.id = p.event_id
      union
      select o.user_id from public.event_organizers o where o.event_id = p.event_id
      union
      select r.user_id from public.rsvps r where r.event_id = p.event_id
      union
      select i.invited_user_id from public.invitations i where i.event_id = p.event_id
    ) x
  ),
  sent as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      c.uid,
      'cagnotte_reminder',
      'Cagnotte : plus que 2 jours 🎁',
      format('Pense à participer au cadeau commun pour l’anniversaire de %s', public.secret_display_first_name(e.birthday_person_user_id)),
      jsonb_build_object('event_id', c.event_id),
      false
    from candidates c
    join public.events e on e.id = c.event_id
    left join public.profiles pf on pf.id = c.uid
    where c.uid is not null
      and e.birthday_person_user_id is not null
      and c.uid is distinct from e.birthday_person_user_id
      and c.uid is distinct from c.recipient_id
      and public.is_event_chat_member(c.event_id, c.uid)
      and coalesce(pf.notif_cagnotte, true)
      and not exists (
        select 1 from public.cagnotte_contributions cc
        where cc.event_id = c.event_id and cc.user_id = c.uid
      )
    returning 1
  )
  select count(*) into v_sent from sent;

  return v_sent;
end;
$$;

revoke all on function public.send_cagnotte_reminders() from public, anon, authenticated;
grant execute on function public.send_cagnotte_reminders() to service_role;

-- SQL pur : le push part du trigger des notifications.
select cron.unschedule('cagnotte-reminders')
where exists (select 1 from cron.job where jobname = 'cagnotte-reminders');

select cron.schedule('cagnotte-reminders', '*/15 * * * *', $$select public.send_cagnotte_reminders();$$);

-- ── Nettoyage automatique : + coordonnées de paiement (30 j après l'événement)
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
  v_warnings_reset integer;
  v_cagnotte_payment_info integer;
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

  -- Coordonnées de paiement de la cagnotte : 30 jours après l'événement
  delete from public.event_cagnotte_payment_info pi
  using public.events e
  where e.id = pi.event_id
    and e.date is not null
    and e.date < now() - interval '30 days';
  get diagnostics v_cagnotte_payment_info = row_count;

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
    'inactivity_warnings_reset', v_warnings_reset,
    'cagnotte_payment_info', v_cagnotte_payment_info
  );
end;
$$;

revoke all on function public.run_data_retention() from public, anon, authenticated;
grant execute on function public.run_data_retention() to service_role;
