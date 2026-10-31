-- Vérification de 20261102180000 : réactions emoji sur les messages du chat
-- d'événement (lecture pour qui peut lire le message, ajout / retrait pour
-- soi-même, 6 emojis, pas de réaction sur un message système ni entre
-- personnes bloquées), réponse dans le même événement et le même canal,
-- suppression de ses propres messages (jamais d'un message système),
-- get_event_messages avec reply_to_id, temps réel.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_message_reactions_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000091';
  A uuid := '00000000-0000-4000-a000-000000000092';
  B uuid := '00000000-0000-4000-a000-000000000093';
  X uuid := '00000000-0000-4000-a000-000000000094';
  cases text[][] := array[
    -- O organise EV et invite A et B (qui acceptent) ; X n'est pas invité
    ['événement', 'postgres', $s$with e as (insert into events(id, name, user_id, invite_token) values ('00000000-0000-4000-e000-000000000091', 'Dry réactions', '00000000-0000-4000-a000-000000000091', '00000000-0000-4000-c000-000000000091') returning 1) select count(*) from e$s$, '1'],
    ['O invite A B', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000091', array['00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093']::uuid[])) x$s$, '1'],
    ['A accepte', 'A', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000091' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 'going') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['B accepte', 'B', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000091' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 'going') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['A écrit M1', 'A', $s$insert into messages(id, event_id, user_id, content, is_secret) values ('00000000-0000-4000-f000-000000000091', '00000000-0000-4000-e000-000000000091', auth.uid(), 'On se retrouve où ?', false) returning 1$s$, '1'],
    ['message système S1 (Secret)', 'postgres', $s$insert into messages(id, event_id, user_id, content, is_secret, system_type) values ('00000000-0000-4000-f000-000000000092', '00000000-0000-4000-e000-000000000091', null, 'Mise à jour', true, 'memory_added') returning 1$s$, '1'],
    ['message secret M9', 'postgres', $s$insert into messages(id, event_id, user_id, content, is_secret) values ('00000000-0000-4000-f000-000000000099', '00000000-0000-4000-e000-000000000091', '00000000-0000-4000-a000-000000000091', 'Chut', true) returning 1$s$, '1'],

    -- Répondre
    ['B répond à M1', 'B', $s$insert into messages(id, event_id, user_id, content, is_secret, reply_to_id) values ('00000000-0000-4000-f000-000000000093', '00000000-0000-4000-e000-000000000091', auth.uid(), 'Chez moi', false, '00000000-0000-4000-f000-000000000091') returning reply_to_id::text$s$, '00000000-0000-4000-f000-000000000091'],
    ['B cite le Secret depuis le Général', 'B', $s$insert into messages(event_id, user_id, content, is_secret, reply_to_id) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 'Intrus', false, '00000000-0000-4000-f000-000000000099') returning 1$s$, 'ERR 22023'],
    ['get_event_messages renvoie reply_to_id', 'A', $s$select reply_to_id::text from get_event_messages('00000000-0000-4000-e000-000000000091', false) where id = '00000000-0000-4000-f000-000000000093'$s$, '00000000-0000-4000-f000-000000000091'],

    -- Réagir
    ['B ❤️ M1', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '❤️') returning 1$s$, '1'],
    ['B ❤️ M1 deux fois', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '❤️') returning 1$s$, 'ERR 23505'],
    ['O 🎉 M1', 'O', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '🎉') returning 1$s$, '1'],
    ['emoji hors liste refusé', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '🍕') returning 1$s$, 'ERR 23514'],
    ['pas de réaction sur un message système', 'O', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000092', auth.uid(), '👍') returning 1$s$, 'ERR 42501'],
    ['B réagit au nom de A', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', '00000000-0000-4000-a000-000000000092', '👍') returning 1$s$, 'ERR 42501'],
    ['X non invité ne peut pas réagir', 'X', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '👍') returning 1$s$, 'ERR 42501'],
    ['B sans accès au Secret ne réagit pas à M9', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000099', auth.uid(), '👍') returning 1$s$, 'ERR 42501'],

    -- Lire
    ['A voit les 2 réactions', 'A', $s$select string_agg(emoji, '' order by emoji) from event_message_reactions$s$, '❤️🎉'],
    ['X ne voit rien', 'X', $s$select count(*) from event_message_reactions$s$, '0'],
    ['anon : aucun accès', 'anon', $s$select count(*) from event_message_reactions$s$, 'ERR 42501'],

    -- Bloquer
    ['A bloque B', 'postgres', $s$insert into user_blocks(blocker_id, blocked_id) values ('00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093') returning 1$s$, '1'],
    ['A ne voit plus la réaction de B', 'A', $s$select string_agg(emoji, '' order by emoji) from event_message_reactions$s$, '🎉'],
    ['O voit toujours les deux', 'O', $s$select count(*) from event_message_reactions$s$, '2'],
    ['B ne réagit plus au message de A', 'B', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000091', auth.uid(), '😮') returning 1$s$, 'ERR 42501'],
    ['A ne réagit pas au message de B', 'A', $s$insert into event_message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000093', auth.uid(), '😮') returning 1$s$, 'ERR 42501'],
    ['A débloque B', 'postgres', $s$with d as (delete from user_blocks where blocker_id = '00000000-0000-4000-a000-000000000092' returning 1) select count(*) from d$s$, '1'],

    -- Retirer
    ['A ne retire pas la réaction de B', 'A', $s$with d as (delete from event_message_reactions where user_id = '00000000-0000-4000-a000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['pas de modification', 'B', $s$update event_message_reactions set emoji = '😢' where user_id = auth.uid() returning 1$s$, 'ERR 42501'],
    ['O retire 🎉', 'O', $s$with d as (delete from event_message_reactions where user_id = auth.uid() and emoji = '🎉' returning 1) select count(*) from d$s$, '1'],

    -- Supprimer ses messages
    ['O (organisateur) ne supprime pas le message de B', 'O', $s$with d as (delete from messages where id = '00000000-0000-4000-f000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['personne ne supprime un message système', 'O', $s$with d as (delete from messages where id = '00000000-0000-4000-f000-000000000092' returning 1) select count(*) from d$s$, '0'],
    ['A supprime M1', 'A', $s$with d as (delete from messages where id = '00000000-0000-4000-f000-000000000091' returning 1) select count(*) from d$s$, '1'],
    ['réactions de M1 parties avec', 'postgres', $s$select count(*) from event_message_reactions where message_id = '00000000-0000-4000-f000-000000000091'$s$, '0'],
    ['la réponse perd sa citation', 'postgres', $s$select coalesce(reply_to_id::text, 'aucune') from messages where id = '00000000-0000-4000-f000-000000000093'$s$, 'aucune'],

    -- Temps réel et droits
    ['publiée en temps réel', 'postgres', $s$select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('event_message_reactions', 'messages')$s$, '2'],
    ['triggers internes non exécutables', 'postgres', $s$select (has_function_privilege('authenticated', 'public.guard_event_message_reaction_block()', 'execute') or has_function_privilege('authenticated', 'public.guard_event_message_reply()', 'execute'))::text$s$, 'false']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-emr-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-emr-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-emr-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-emr-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-emr-' || lower(who) || '@amiv.test')::text, true);
        perform set_config('request.jwt.claim.sub', who_id::text, true);
        execute 'set local role authenticated';
      end if;
      execute cases[i][3] into res;
      res := coalesce(res, 'NULL');
    exception when others then
      res := 'ERR ' || sqlstate;
      if cases[i][4] <> res then res := res || ' ' || sqlerrm; end if;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    if res = cases[i][4] or res like cases[i][4] || ' %' then
      out := out || E'\nOK   ' || cases[i][1] || ' -> ' || res;
    else
      fails := fails + 1;
      out := out || E'\nFAIL ' || cases[i][1] || ' -> ' || res || ' (attendu ' || cases[i][4] || ')';
    end if;
  end loop;
  raise exception 'DRYRUN (rollback) % échec(s)%', fails, out;
end
$dry$;
