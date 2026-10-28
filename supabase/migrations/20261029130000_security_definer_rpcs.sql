-- Audit des RPC SECURITY DEFINER (lot D) : contrôles manquants sur auth.uid().
--   - invite_friends_to_event : aucune vérification, n'importe qui pouvait
--     s'inviter (ou inviter d'autres comptes) à n'importe quel événement, et
--     obtenir ainsi la lecture de l'événement, du chat et des invités.
--   - is_invited_to_event : appelable par anon, et pour n'importe quel
--     p_user_id (sonder si X est invité à Y). Tous les appelants (policies,
--     is_event_member, get_event_messages, prepare_report, front) passent
--     auth.uid().
--   - get_conversation_other_participants : appelable par anon, renvoyait les
--     participants de n'importe quelle conversation.
--   - get_card_message_count : appelable par anon, sans contrôle (et par la
--     personne fêtée).
--   - get_calendar_dots : appelable par anon (sans effet, auth.uid() nul) ;
--     retiré par hygiène.

create or replace function public.invite_friends_to_event(p_event_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_event_organizer(p_event_id) then
    raise exception 'Seuls les organisateurs peuvent inviter' using errcode = '42501';
  end if;

  insert into public.invitations (event_id, invited_user_id, invited_by, status)
  select p_event_id, uid, auth.uid(), 'pending'
  from unnest(p_user_ids) as uid
  where uid is not null and uid <> auth.uid()
  on conflict (event_id, invited_user_id) do nothing;
end;
$$;

revoke all on function public.invite_friends_to_event(uuid, uuid[]) from public, anon;
grant execute on function public.invite_friends_to_event(uuid, uuid[]) to authenticated;

create or replace function public.is_invited_to_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1 from public.invitations
      where event_id = p_event_id
        and (
          invited_user_id = p_user_id
          or invited_email = (select email from auth.users where id = p_user_id)
        )
    );
$$;

revoke all on function public.is_invited_to_event(uuid, uuid) from public, anon;
grant execute on function public.is_invited_to_event(uuid, uuid) to authenticated;

create or replace function public.get_conversation_other_participants(conv_ids uuid[])
returns table (conversation_id uuid, other_user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select o.conversation_id, o.user_id
  from public.direct_conversation_participants o
  where o.conversation_id = any(conv_ids)
    and o.user_id <> auth.uid()
    and exists (
      select 1 from public.direct_conversation_participants me
      where me.conversation_id = o.conversation_id
        and me.user_id = auth.uid()
    );
$$;

revoke all on function public.get_conversation_other_participants(uuid[]) from public, anon;
grant execute on function public.get_conversation_other_participants(uuid[]) to authenticated;

create or replace function public.get_card_message_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.group_card_messages
  where event_id = p_event_id
    and public.can_access_secret_space(p_event_id);
$$;

revoke all on function public.get_card_message_count(uuid) from public, anon;
grant execute on function public.get_card_message_count(uuid) to authenticated;

revoke all on function public.get_calendar_dots(date, date) from public, anon;
grant execute on function public.get_calendar_dots(date, date) to authenticated;
