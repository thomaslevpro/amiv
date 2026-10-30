-- Album photo : durée de conservation (décision du 30/10/2026).
--
-- Les photos d'un album sont supprimées 2 mois après la date de
-- l'événement. Environ 30 jours avant (1 mois après l'événement), les
-- personnes qui voient l'album reçoivent une notification pour enregistrer
-- leurs photos. La suppression n'a jamais lieu moins de 30 jours après cet
-- avertissement : date de suppression = max(date + 2 mois, avertissement +
-- 30 jours) (event_photos_expires_at). Sans date (sondage en cours) :
-- aucune suppression.
--
-- Avertissement : cron event-photos-maintenance (toutes les 10 min), entre
-- 10 h et 20 h (Paris), une seule fois par événement ayant au moins une
-- photo (event_photos_expiry_warnings). Notification in-app toujours ; push
-- selon le réglage « Photos ».
-- Suppression : run_data_retention (cron data-retention, chaque nuit), qui
-- supprime les lignes ; les fichiers sont effacés par purge-storage.
-- Une fois la date passée, l'album n'accepte plus de photo.

create table if not exists public.event_photos_expiry_warnings (
  event_id uuid primary key references public.events(id) on delete cascade,
  warned_at timestamptz not null default now()
);

alter table public.event_photos_expiry_warnings enable row level security;
revoke all on public.event_photos_expiry_warnings from public, anon, authenticated;
grant all on public.event_photos_expiry_warnings to service_role;

create or replace function public.event_photos_expires_at(p_event_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case when e.date is null then null else greatest(
    e.date + interval '2 months',
    coalesce(w.warned_at, greatest(e.date + interval '1 month', now())) + interval '30 days'
  ) end
  from public.events e
  left join public.event_photos_expiry_warnings w on w.event_id = e.id
  where e.id = p_event_id;
$$;

revoke all on function public.event_photos_expires_at(uuid) from public, anon, authenticated;

-- Une notification par personne pour chaque album dont l'événement date
-- d'au moins un mois. Renvoie le nombre d'événements avertis.
create or replace function public.send_event_photos_expiry_warnings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with due as (
    select e.id, coalesce(nullif(trim(e.name), ''), 'l’événement') as name
    from public.events e
    where e.date is not null
      and e.date <= now() - interval '1 month'
      and exists (select 1 from public.event_photos p where p.event_id = e.id)
      and not exists (select 1 from public.event_photos_expiry_warnings w where w.event_id = e.id)
    limit 200
  ),
  warned as (
    insert into public.event_photos_expiry_warnings (event_id)
    select id from due
    on conflict (event_id) do nothing
    returning event_id
  ),
  sent as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      c.uid,
      'event_photos_expiring',
      'Photos bientôt supprimées 📸',
      format('Les photos de « %s » seront supprimées le %s. Pense à enregistrer celles que tu veux garder.',
        d.name,
        to_char(greatest(e.date + interval '2 months', now() + interval '30 days') at time zone 'Europe/Paris', 'DD/MM/YYYY')),
      jsonb_build_object('event_id', d.id),
      false
    from warned wd
    join due d on d.id = wd.event_id
    join public.events e on e.id = d.id
    cross join lateral (
      select e.user_id as uid
      union
      select o.user_id from public.event_organizers o where o.event_id = d.id
      union
      select r.user_id from public.rsvps r where r.event_id = d.id
      union
      select i.invited_user_id from public.invitations i where i.event_id = d.id
    ) c
    where c.uid is not null
      and public.can_view_event_photos(d.id, c.uid)
    returning 1
  )
  -- sent s'exécute même sans être lu (CTE de modification)
  select count(*) into v_count from warned;
  return v_count;
end;
$$;

revoke all on function public.send_event_photos_expiry_warnings() from public, anon, authenticated;
grant execute on function public.send_event_photos_expiry_warnings() to service_role;

-- Identique à 20261101220000, plus l'avertissement en journée.
create or replace function public.run_event_photos_maintenance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
  v_paris_hour integer := extract(hour from now() at time zone 'Europe/Paris');
begin
  delete from public.event_photos p
  where p.created_at < now() - interval '1 hour'
    and (
      not exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.path)
      or not exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.thumb_path)
    );
  get diagnostics v_deleted = row_count;
  -- Rattrapage si un appel immédiat a échoué
  perform public.request_storage_purge();
  -- Pas de notification la nuit
  if v_paris_hour between 10 and 19 then
    perform public.send_event_photos_expiry_warnings();
  end if;
  return v_deleted;
end;
$$;

revoke all on function public.run_event_photos_maintenance() from public, anon, authenticated;

-- ── Album fermé après la date de suppression ───────────────────────────────
-- Identique à 20261101220000, plus le contrôle de la date de suppression.
create or replace function public.prepare_event_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.can_view_event_photos(new.event_id, v_uid) then
    raise exception 'Album réservé aux participants' using errcode = '42501';
  end if;
  if public.event_photos_expires_at(new.event_id) <= now() then
    raise exception 'Album fermé : les photos ont été supprimées' using errcode = '23514', hint = 'event_photos_expired';
  end if;

  -- Deux envois simultanés ne doivent pas dépasser la limite
  perform pg_advisory_xact_lock(hashtextextended('event_photos:' || new.event_id::text || ':' || v_uid::text, 0));
  if (select count(*) from public.event_photos p where p.event_id = new.event_id and p.user_id = v_uid) >= 10 then
    raise exception 'Limite de 10 photos atteinte' using errcode = '23514', hint = 'event_photos_limit';
  end if;

  new.id := gen_random_uuid();
  new.user_id := v_uid;
  new.path := new.event_id::text || '/' || v_uid::text || '/' || new.id::text || '.jpg';
  new.thumb_path := new.event_id::text || '/' || v_uid::text || '/' || new.id::text || '_thumb.jpg';
  new.created_at := now();
  new.notified_at := null;
  return new;
end;
$$;

-- ── Date de suppression affichée dans l'album ─────────────────────────────
-- Identique à 20261101220000, plus expires_at.
create or replace function public.get_event_photos(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.can_view_event_photos(p_event_id, v_uid) then
    return jsonb_build_object('can_view', false);
  end if;

  return jsonb_build_object(
    'can_view', true,
    'can_manage', public.is_event_organizer(p_event_id),
    'expires_at', public.event_photos_expires_at(p_event_id),
    'max_per_user', 10,
    'my_count', (select count(*) from public.event_photos p where p.event_id = p_event_id and p.user_id = v_uid),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'path', p.path,
        'thumb_path', p.thumb_path,
        'created_at', p.created_at,
        'author_name', public.secret_display_first_name(p.user_id)
      ) order by p.created_at desc, p.id)
      from public.event_photos p
      where p.event_id = p_event_id
        and public.can_see_event_photo(p.event_id, p.user_id, v_uid)
        and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.path)
        and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.thumb_path)
    ), '[]'::jsonb)
  );
end;
$$;

-- ── Notifications ──────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise', 'poll_reminder',
  'birthday_shared', 'secret_space_reminder', 'cagnotte_reminder', 'event_photos_added',
  'event_photos_expiring'
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
    when p_type in ('event_photos_added', 'event_photos_expiring') then coalesce(p.notif_photos, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- ── Nettoyage automatique : + album photo ──────────────────────────────────
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
    'inactivity_warnings_reset', v_warnings_reset,
    'cagnotte_payment_info', v_cagnotte_payment_info,
    'event_photos', v_event_photos
  );
end;
$$;

revoke all on function public.run_data_retention() from public, anon, authenticated;
grant execute on function public.run_data_retention() to service_role;
