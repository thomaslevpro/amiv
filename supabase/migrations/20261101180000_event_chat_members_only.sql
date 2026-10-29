-- Conversation d'un événement : organisateurs et invités qui ont accepté.
--
-- Avant : toute personne invitée (is_invited_to_event, quel que soit le
-- statut) pouvait lire et écrire dans la conversation générale, recevait les
-- notifications « Nouveau message » (et donc les push) dès l'invitation, et
-- la messagerie listait tout événement dont la ligne rsvps n'était pas
-- « declined » — y compris « pending », qui veut dire « en attente » ou
-- « peut-être ».
--
-- Maintenant : is_event_chat_member() est la seule définition.
--   Membre = créateur de l'événement, co-organisateur approuvé, RSVP
--   « going », ou invitation « accepted » sans RSVP « declined » (même
--   priorité que event_guest_statuses : confirmé).
--   En attente, peut-être, refusé : pas membre. Rien à lire, rien à écrire,
--   aucune notification de message, l'événement n'apparaît pas dans la
--   messagerie. Seule l'invitation notifie.
-- Utilisée par : RLS de messages, get_event_messages, can_access_secret_space,
-- get_my_event_conversation_ids (liste de la messagerie), notify_event_message
-- et le garde-fou before insert sur notifications.

-- ── Définition ───────────────────────────────────────────────────────────────
create or replace function public.is_event_chat_member(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    exists (select 1 from public.events e where e.id = p_event_id and e.user_id = p_user_id)
    or exists (
      select 1 from public.event_organizers o
      where o.event_id = p_event_id
        and o.user_id = p_user_id
        and o.role in ('owner', 'co_organizer')
        and o.status = 'approved'
    )
    or exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id and r.user_id = p_user_id and r.status = 'going'
    )
    or (
      not exists (
        select 1 from public.rsvps r
        where r.event_id = p_event_id and r.user_id = p_user_id and r.status = 'declined'
      )
      and exists (
        select 1 from public.invitations i
        where i.event_id = p_event_id
          and i.status = 'accepted'
          and (
            i.invited_user_id = p_user_id
            or lower(i.invited_email) = lower((select u.email from auth.users u where u.id = p_user_id))
          )
      )
    )
  );
$$;

revoke execute on function public.is_event_chat_member(uuid, uuid) from public, anon, authenticated;

-- Version pour l'utilisateur connecté (RLS, app)
create or replace function public.can_access_event_chat(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.is_event_chat_member(p_event_id, auth.uid());
$$;

revoke execute on function public.can_access_event_chat(uuid) from public, anon;
grant execute on function public.can_access_event_chat(uuid) to authenticated;

-- ── Lecture / écriture des messages ─────────────────────────────────────────
drop policy if exists "select_messages" on public.messages;
create policy "select_messages" on public.messages
  for select
  using (
    (
      (is_secret = false and public.can_access_event_chat(event_id))
      or (is_secret = true and public.can_access_secret_space(event_id))
    )
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = messages.user_id
    )
  );

drop policy if exists "insert_messages" on public.messages;
create policy "insert_messages" on public.messages
  for insert
  with check (
    auth.uid() = user_id
    and (
      (is_secret = false and public.can_access_event_chat(event_id))
      or (is_secret = true and public.can_access_secret_space(event_id))
    )
  );

create or replace function public.get_event_messages(p_event_id uuid, p_is_secret boolean)
returns table(id uuid, event_id uuid, user_id uuid, content text, created_at timestamptz, is_secret boolean, is_hidden boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         m.event_id,
         m.user_id,
         case when b.blocked_id is null then m.content end,
         m.created_at,
         m.is_secret,
         b.blocked_id is not null
  from public.messages m
  left join public.user_blocks b
    on b.blocker_id = auth.uid() and b.blocked_id = m.user_id
  where m.event_id = p_event_id
    and m.is_secret = p_is_secret
    and auth.uid() is not null
    and (
      m.user_id = auth.uid()
      or (not p_is_secret and public.can_access_event_chat(p_event_id))
      or (p_is_secret and public.can_access_secret_space(p_event_id))
    )
  order by m.created_at;
$$;

-- Espace secret : même définition de « a accepté », hors personne fêtée
create or replace function public.can_access_secret_space(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.birthday_person_user_id is distinct from auth.uid()
        and (e.type = 'Anniversaire' or e.birthday_person_user_id is not null)
    )
    and public.is_event_chat_member(p_event_id, auth.uid());
$$;

-- ── Liste de la messagerie ──────────────────────────────────────────────────
create or replace function public.get_my_event_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.event_id
  from (
    select e.id as event_id from public.events e where e.user_id = auth.uid()
    union
    select o.event_id from public.event_organizers o where o.user_id = auth.uid()
    union
    select r.event_id from public.rsvps r where r.user_id = auth.uid()
    union
    select i.event_id from public.invitations i
    where i.invited_user_id = auth.uid() or lower(i.invited_email) = lower(auth.email())
  ) c
  where auth.uid() is not null
    and public.is_event_chat_member(c.event_id, auth.uid());
$$;

revoke execute on function public.get_my_event_conversation_ids() from public, anon;
grant execute on function public.get_my_event_conversation_ids() to authenticated;

-- ── Notifications de message ────────────────────────────────────────────────
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
    select r.user_id as uid from public.rsvps r where r.event_id = new.event_id
    union
    select i.invited_user_id from public.invitations i where i.event_id = new.event_id
    union
    select ev.user_id
    union
    select o.user_id from public.event_organizers o where o.event_id = new.event_id
  ) recipients
  where recipients.uid is not null
    and recipients.uid is distinct from new.user_id
    and public.is_event_chat_member(new.event_id, recipients.uid)
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = recipients.uid and b.blocked_id = new.user_id
    );

  return new;
end;
$$;

-- Garde-fou (aucune notification de message, donc aucun push, pour un
-- non-membre, d'où qu'elle vienne) en plus du refus déjà en place.
create or replace function public.skip_declined_event_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if new.data is null or not (new.data ? 'event_id') then
    return new;
  end if;
  begin
    v_event_id := (new.data->>'event_id')::uuid;
  exception when others then
    return new;
  end;
  if public.has_declined_event(new.user_id, v_event_id) then
    return null;
  end if;
  if new.type = 'message_received' and not public.is_event_chat_member(v_event_id, new.user_id) then
    return null;
  end if;
  return new;
end;
$$;

-- Notifications de message déjà reçues par des non-membres : passées en lues
-- (elles ne comptent plus dans la cloche ni dans la messagerie).
update public.notifications n
   set read = true
 where n.type = 'message_received'
   and n.read = false
   and n.data ? 'event_id'
   and (n.data->>'event_id') ~ '^[0-9a-f-]{36}$'
   and not public.is_event_chat_member((n.data->>'event_id')::uuid, n.user_id);
