-- Conversation d'un événement : les invités « peut-être » y ont accès.
--
-- Avant (20261101180000) : seuls les confirmés étaient membres ; « peut-être »
-- n'avait ni conversation, ni messages, ni notifications.
--
-- Maintenant : membre = créateur de l'événement, co-organisateur approuvé,
-- RSVP « going », ou invitation « accepted » ou « maybe » sans RSVP
-- « declined » (même priorité que event_guest_statuses : confirmé ou
-- peut-être). En attente et refusé : toujours pas membre.
-- is_event_chat_member() reste la seule définition : RLS de messages,
-- get_event_messages, can_access_event_chat, can_access_secret_space (donc
-- l'espace secret d'un anniversaire aussi), get_my_event_conversation_ids,
-- notify_event_message et le garde-fou des notifications suivent.

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
          and i.status in ('accepted', 'maybe')
          and (
            i.invited_user_id = p_user_id
            or lower(i.invited_email) = lower((select u.email from auth.users u where u.id = p_user_id))
          )
      )
    )
  );
$$;

revoke execute on function public.is_event_chat_member(uuid, uuid) from public, anon, authenticated;
