-- Notifications créées uniquement côté serveur (triggers / fonctions security definer).
-- Avant : policy "service can insert notifications" (with check true) => n'importe quel
-- client pouvait créer n'importe quelle notification pour n'importe qui, et la RPC
-- notify_message_recipients acceptait sender/titre/texte arbitraires.
--
-- Remplacements des inserts client :
--   useEventDetail (rsvp_received)          -> trigger notify_rsvp_going (rsvps)
--   usePlusOne (plus_one_request/response)  -> trigger notify_plus_one_change (rsvps)
--   useGuestLeader (guest_leader_*)         -> trigger notify_guest_leader_change (event_organizers)
--   PublicUserProfile (friend_request)      -> doublon du trigger existant notify_friend_request
--   Messages (rpc notify_message_recipients)-> trigger notify_event_message (messages)
--   + invitations ajoutées après création   -> trigger notify_invitation_created (invitations),
--     qui remplace aussi l'insert fait par create_event_with_owner.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected'
));

-- ── Invitations ──────────────────────────────────────────────────────────────
create or replace function public.notify_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  target_id uuid;
begin
  target_id := new.invited_user_id;
  if target_id is null and new.invited_email is not null then
    select id into target_id from public.profiles where lower(email) = lower(new.invited_email) limit 1;
  end if;
  if target_id is null or target_id = new.invited_by then
    return new;
  end if;

  select id, name, date into ev from public.events where id = new.event_id;

  insert into public.notifications (user_id, type, title, body, data, read)
  values (
    target_id,
    'event_invitation',
    format('Tu es invité(e) à %s', ev.name),
    case
      when ev.date is not null then 'Réponds à l’invitation sur Amiv'
      else 'Vote pour tes disponibilités sur Amiv'
    end,
    jsonb_build_object('event_id', new.event_id, 'sender_id', new.invited_by),
    false
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_invitation_created on public.invitations;
create trigger trg_notify_invitation_created
  after insert on public.invitations
  for each row
  execute function public.notify_invitation_created();

CREATE OR REPLACE FUNCTION public.create_event_with_owner(p_name text, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_visibility text DEFAULT 'Sur invitation'::text, p_cover_image text DEFAULT NULL::text, p_birthday_person_user_id uuid DEFAULT NULL::uuid, p_date_options jsonb DEFAULT '[]'::jsonb, p_invited_user_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events;
  v_invited_user_ids uuid[] := array[]::uuid[];
  v_invalid_invitee_count integer := 0;
begin
  if v_actor is null then
    raise exception 'create_event_with_owner requires an authenticated user';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Event name is required';
  end if;

  if p_date_options is null then
    p_date_options := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_date_options) <> 'array' then
    raise exception 'p_date_options must be a JSON array';
  end if;

  if jsonb_array_length(p_date_options) > 4 then
    raise exception 'An event can have at most 4 date options';
  end if;

  select coalesce(array_agg(distinct invitee_id), array[]::uuid[])
    into v_invited_user_ids
  from unnest(coalesce(p_invited_user_ids, array[]::uuid[])) as invitees(invitee_id)
  where invitee_id is not null
    and invitee_id <> v_actor;

  select count(*)
    into v_invalid_invitee_count
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  where not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_actor and f.addressee_id = invitee_id)
        or (f.addressee_id = v_actor and f.requester_id = invitee_id)
      )
  );

  if v_invalid_invitee_count > 0 then
    raise exception 'All invited users must be accepted friends';
  end if;

  insert into public.events (
    name,
    date,
    location,
    description,
    type,
    visibility,
    user_id,
    cover_image,
    birthday_person_user_id
  )
  values (
    trim(p_name),
    p_date,
    p_location,
    p_description,
    p_type,
    coalesce(p_visibility, 'Sur invitation'),
    v_actor,
    nullif(p_cover_image, ''),
    p_birthday_person_user_id
  )
  returning * into v_event;

  insert into public.event_organizers (event_id, user_id, role)
  values (v_event.id, v_actor, 'owner');

  insert into public.event_date_options (event_id, proposed_date, proposed_time)
  select
    v_event.id,
    (option_row->>'date')::date,
    nullif(option_row->>'time', '')::time
  from jsonb_array_elements(p_date_options) as option_row
  where nullif(option_row->>'date', '') is not null;

  insert into public.invitations (event_id, invited_user_id, invited_by, status)
  select v_event.id, invitee_id, v_actor, 'pending'
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  on conflict (event_id, invited_user_id) do nothing;

  insert into public.rsvps (event_id, user_id, status)
  select v_event.id, invitee_id, 'pending'
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  on conflict (event_id, user_id)
  do update set status = excluded.status;

  -- Notifications d'invitation : trigger notify_invitation_created.

  return v_event;
end;
$function$;

-- ── RSVP "going" -> owner ────────────────────────────────────────────────────
create or replace function public.notify_rsvp_going()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  guest_name text;
begin
  if new.status <> 'going' or (tg_op = 'UPDATE' and old.status = 'going') then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;
  if ev.user_id is null or ev.user_id = new.user_id then
    return new;
  end if;

  select name into guest_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    ev.user_id,
    'rsvp_received',
    format('%s participe à %s', coalesce(guest_name, 'Quelqu''un'), ev.name),
    'Nouvelle réponse à votre événement',
    jsonb_build_object('event_id', new.event_id, 'sender_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_rsvp_going on public.rsvps;
create trigger trg_notify_rsvp_going
  after insert or update of status on public.rsvps
  for each row
  execute function public.notify_rsvp_going();

-- ── +1 : demande -> owner, réponse -> invité ─────────────────────────────────
create or replace function public.notify_plus_one_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  requester_name text;
begin
  select id, user_id into ev from public.events where id = new.event_id;

  if new.plus_one_requested and new.plus_one_status = 'pending'
     and not (coalesce(old.plus_one_requested, false) and old.plus_one_status = 'pending') then
    if ev.user_id is null or ev.user_id = new.user_id then
      return new;
    end if;
    select coalesce(first_name, name) into requester_name from public.profiles where id = new.user_id;
    requester_name := coalesce(requester_name, 'Un invité');

    insert into public.notifications (user_id, type, title, body, data)
    values (
      ev.user_id,
      'plus_one_request',
      format('%s veut amener un +1', requester_name),
      new.plus_one_message,
      jsonb_build_object('event_id', new.event_id, 'rsvp_id', new.id, 'table', 'rsvps', 'requester_name', requester_name)
    );
  elsif new.plus_one_status in ('accepted', 'declined')
        and old.plus_one_status is distinct from new.plus_one_status
        and new.user_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'plus_one_response',
      case when new.plus_one_status = 'accepted' then '🎉 +1 accepté !' else '+1 refusé' end,
      null,
      jsonb_build_object('event_id', new.event_id, 'status', new.plus_one_status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_plus_one_change on public.rsvps;
create trigger trg_notify_plus_one_change
  after update of plus_one_requested, plus_one_status on public.rsvps
  for each row
  execute function public.notify_plus_one_change();

-- ── Coordinateur (guest leader) ──────────────────────────────────────────────
create or replace function public.notify_guest_leader_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  candidate_name text;
begin
  if new.role <> 'guest_leader' then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    if ev.user_id is null then
      return new;
    end if;
    select coalesce(first_name, split_part(name, ' ', 1)) into candidate_name
      from public.profiles where id = new.user_id;
    candidate_name := coalesce(nullif(candidate_name, ''), 'Quelqu’un');

    insert into public.notifications (user_id, type, title, body, data, read)
    values (
      ev.user_id,
      'guest_leader_request',
      format('%s veut coordonner un anniversaire', candidate_name),
      format('%s souhaite coordonner l''espace secret de %s', candidate_name, ev.name),
      jsonb_build_object('event_id', new.event_id, 'sender_id', new.user_id),
      false
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, data, read)
    values (
      new.user_id,
      case when new.status = 'approved' then 'guest_leader_approved' else 'guest_leader_rejected' end,
      case when new.status = 'approved' then 'Tu es coordinateur ! ✦' else 'Demande de coordination' end,
      case
        when new.status = 'approved' then format('L''organisateur t''a confirmé comme coordinateur de %s', ev.name)
        else format('Ta demande pour %s n''a pas été retenue', ev.name)
      end,
      jsonb_build_object('event_id', new.event_id, 'sender_id', coalesce(auth.uid(), ev.user_id)),
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_guest_leader_change on public.event_organizers;
create trigger trg_notify_guest_leader_change
  after insert or update of status on public.event_organizers
  for each row
  execute function public.notify_guest_leader_change();

-- ── Messages du chat général (le chat secret ne notifiait pas, inchangé) ─────
create or replace function public.notify_event_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  if new.is_secret then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;

  insert into public.notifications (user_id, type, title, body, data, read)
  select
    recipients.uid,
    'message_received',
    format('Nouveau message dans %s', coalesce(ev.name, 'un événement')),
    case when char_length(new.content) > 40 then left(new.content, 40) || '…' else new.content end,
    jsonb_build_object('event_id', new.event_id, 'sender_id', new.user_id),
    false
  from (
    select r.user_id as uid from public.rsvps r
      where r.event_id = new.event_id and r.status <> 'declined'
    union
    select ev.user_id
    union
    select o.user_id from public.event_organizers o
      where o.event_id = new.event_id and o.role = 'co_organizer' and o.status = 'approved'
  ) recipients
  where recipients.uid is not null
    and recipients.uid is distinct from new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_event_message on public.messages;
create trigger trg_notify_event_message
  after insert on public.messages
  for each row
  execute function public.notify_event_message();

drop function if exists public.notify_message_recipients(uuid, uuid, text, text);

-- ── Droits clients : lecture + marquer comme lu uniquement ───────────────────
drop policy if exists "service can insert notifications" on public.notifications;
revoke insert on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;
