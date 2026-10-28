-- Effets du blocage, appliqués en base :
--   - messages privés : aucun nouveau message entre deux personnes dont l'une
--     a bloqué l'autre (dans les deux sens, sinon le bloqueur écrirait à
--     quelqu'un qui ne peut pas répondre) ;
--   - demandes d'ami : impossibles dans les deux sens ;
--   - invitations : une invitation envoyée par quelqu'un que l'invité a bloqué
--     est ignorée sans erreur (les invitations partent par lots : une erreur
--     ferait échouer la création de l'événement, et révélerait le blocage) ;
--   - chats d'événement : les messages d'un utilisateur que j'ai bloqué ne me
--     sont plus lisibles (RLS) ; get_event_messages les renvoie sans contenu
--     pour afficher « Message masqué », et ils ne me notifient plus.

-- ── Messages privés ────────────────────────────────────────────────────────
create or replace function public.guard_direct_message_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.direct_conversation_participants p
    where p.conversation_id = new.conversation_id
      and p.user_id <> new.sender_id
      and public.is_blocked_between(p.user_id, new.sender_id)
  ) then
    raise exception 'Impossible d''envoyer ce message.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_direct_message_block on public.direct_messages;
create trigger trg_guard_direct_message_block
  before insert on public.direct_messages
  for each row execute function public.guard_direct_message_block();

-- ── Demandes d'ami ─────────────────────────────────────────────────────────
create or replace function public.guard_friendship_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.requester_id, new.addressee_id) then
    raise exception 'Impossible d''envoyer cette demande.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_friendship_block on public.friendships;
create trigger trg_guard_friendship_block
  before insert on public.friendships
  for each row execute function public.guard_friendship_block();

-- ── Invitations ────────────────────────────────────────────────────────────
create or replace function public.guard_invitation_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter uuid := coalesce(new.invited_by, auth.uid());
  v_invitee uuid := coalesce(
    new.invited_user_id,
    (select p.id from public.profiles p where lower(p.email) = lower(new.invited_email) limit 1)
  );
begin
  if v_inviter is not null and v_invitee is not null and exists (
    select 1 from public.user_blocks b
    where b.blocker_id = v_invitee and b.blocked_id = v_inviter
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_invitation_block on public.invitations;
create trigger trg_guard_invitation_block
  before insert on public.invitations
  for each row execute function public.guard_invitation_block();

-- ── Chats d'événement : lecture ────────────────────────────────────────────
drop policy if exists select_messages on public.messages;
create policy select_messages
  on public.messages for select to authenticated
  using (
    (
      ((is_secret = false) and (public.is_invited_to_event(event_id, auth.uid()) or public.is_event_organizer(event_id)))
      or ((is_secret = true) and public.can_access_secret_space(event_id))
    )
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = messages.user_id
    )
  );

-- Fil d'un chat d'événement avec les messages des personnes que j'ai
-- bloquées à leur place, sans contenu (is_hidden = true). Mêmes droits
-- d'accès que les policies de lecture de messages.
create or replace function public.get_event_messages(p_event_id uuid, p_is_secret boolean)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  is_secret boolean,
  is_hidden boolean
)
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
      or (not p_is_secret and (public.is_invited_to_event(p_event_id, auth.uid()) or public.is_event_organizer(p_event_id)))
      or (p_is_secret and public.can_access_secret_space(p_event_id))
    )
  order by m.created_at;
$$;

revoke all on function public.get_event_messages(uuid, boolean) from public, anon;
grant execute on function public.get_event_messages(uuid, boolean) to authenticated;

-- ── Chats d'événement : notifications ──────────────────────────────────────
-- Identique à 20261028100100_server_side_notifications, plus l'exclusion des
-- destinataires qui ont bloqué l'expéditeur.
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
    and recipients.uid is distinct from new.user_id
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = recipients.uid and b.blocked_id = new.user_id
    );

  return new;
end;
$$;
