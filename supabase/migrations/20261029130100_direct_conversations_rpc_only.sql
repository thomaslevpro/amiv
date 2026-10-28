-- Conversations privées : plus aucun insert direct. La policy "Ajouter un
-- participant" (auth.uid() is not null) permettait de s'ajouter à n'importe
-- quelle conversation et d'en lire les messages, et participants_update_own
-- permettait de déplacer sa ligne vers une autre conversation.
-- La seule façon de rejoindre une conversation est de la créer avec
-- find_or_create_direct_conversation (soi + l'autre personne), qui refuse
-- de créer une conversation entre deux personnes dont l'une a bloqué l'autre.
-- Une conversation existante est renvoyée même en cas de blocage (le
-- bloqueur doit pouvoir l'ouvrir pour débloquer) ; les messages y restent
-- refusés par guard_direct_message_block.

create or replace function public.find_or_create_direct_conversation(p_user_id uuid, p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_actor is null or p_user_id is distinct from v_actor then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_friend_id is null or p_friend_id = v_actor
     or not exists (select 1 from public.profiles p where p.id = p_friend_id) then
    raise exception 'Destinataire invalide' using errcode = '22023';
  end if;

  -- Deux créations simultanées pour la même paire ne doivent pas produire
  -- deux conversations.
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_actor::text, p_friend_id::text) || greatest(v_actor::text, p_friend_id::text), 0
  ));

  select dcp1.conversation_id into v_conversation_id
  from public.direct_conversation_participants dcp1
  join public.direct_conversation_participants dcp2
    on dcp1.conversation_id = dcp2.conversation_id
  where dcp1.user_id = v_actor
    and dcp2.user_id = p_friend_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  if public.is_blocked_between(v_actor, p_friend_id) then
    raise exception 'Impossible de démarrer cette conversation.' using errcode = '42501';
  end if;

  insert into public.direct_conversations default values
  returning id into v_conversation_id;

  insert into public.direct_conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_actor),
         (v_conversation_id, p_friend_id);

  return v_conversation_id;
end;
$$;

revoke all on function public.find_or_create_direct_conversation(uuid, uuid) from public, anon;
grant execute on function public.find_or_create_direct_conversation(uuid, uuid) to authenticated;

drop policy if exists "Ajouter un participant" on public.direct_conversation_participants;
drop policy if exists "Créer une conversation" on public.direct_conversations;

revoke all on public.direct_conversations from anon, authenticated;
grant select on public.direct_conversations to authenticated;

revoke all on public.direct_conversation_participants from anon, authenticated;
grant select on public.direct_conversation_participants to authenticated;
grant update (is_muted, last_read_at) on public.direct_conversation_participants to authenticated;
