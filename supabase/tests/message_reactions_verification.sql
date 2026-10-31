-- Vérification de 20261102170000 : réactions emoji sur les messages privés
-- (lecture pour les membres de la conversation, ajout / retrait pour soi-même
-- seulement, 6 emojis, pas entre personnes bloquées), réponse à un message de
-- la même conversation, suppression de ses propres messages, temps réel.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/message_reactions_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000081';
  B uuid := '00000000-0000-4000-a000-000000000082';
  X uuid := '00000000-0000-4000-a000-000000000083';
  cases text[][] := array[
    -- A et B se parlent (C1) ; X parle à A dans C2
    ['conversations', 'postgres', $s$with c as (insert into direct_conversations(id) values ('00000000-0000-4000-d000-000000000081'), ('00000000-0000-4000-d000-000000000082') returning 1) select count(*) from c$s$, '2'],
    ['participants', 'postgres', $s$with p as (insert into direct_conversation_participants(conversation_id, user_id) values ('00000000-0000-4000-d000-000000000081', '00000000-0000-4000-a000-000000000081'), ('00000000-0000-4000-d000-000000000081', '00000000-0000-4000-a000-000000000082'), ('00000000-0000-4000-d000-000000000082', '00000000-0000-4000-a000-000000000081'), ('00000000-0000-4000-d000-000000000082', '00000000-0000-4000-a000-000000000083') returning 1) select count(*) from p$s$, '4'],
    ['A écrit M1', 'A', $s$insert into direct_messages(id, conversation_id, sender_id, content) values ('00000000-0000-4000-f000-000000000081', '00000000-0000-4000-d000-000000000081', auth.uid(), 'Salut') returning 1$s$, '1'],
    ['X écrit M9 dans C2', 'X', $s$insert into direct_messages(id, conversation_id, sender_id, content) values ('00000000-0000-4000-f000-000000000089', '00000000-0000-4000-d000-000000000082', auth.uid(), 'Autre') returning 1$s$, '1'],

    -- Répondre
    ['B répond à M1', 'B', $s$insert into direct_messages(id, conversation_id, sender_id, content, reply_to_id) values ('00000000-0000-4000-f000-000000000082', '00000000-0000-4000-d000-000000000081', auth.uid(), 'Coucou', '00000000-0000-4000-f000-000000000081') returning reply_to_id::text$s$, '00000000-0000-4000-f000-000000000081'],
    ['B cite un message d''une autre conversation', 'B', $s$insert into direct_messages(conversation_id, sender_id, content, reply_to_id) values ('00000000-0000-4000-d000-000000000081', auth.uid(), 'Intrus', '00000000-0000-4000-f000-000000000089') returning 1$s$, 'ERR 22023'],

    -- Réagir
    ['B ❤️ M1', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '❤️') returning 1$s$, '1'],
    ['B ❤️ M1 deux fois', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '❤️') returning 1$s$, 'ERR 23505'],
    ['B 🎉 M1', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '🎉') returning 1$s$, '1'],
    ['A 😂 M1 (son propre message)', 'A', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '😂') returning 1$s$, '1'],
    ['emoji hors liste refusé', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '🍕') returning 1$s$, 'ERR 23514'],
    ['B réagit au nom de A', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000082', '00000000-0000-4000-a000-000000000081', '👍') returning 1$s$, 'ERR 42501'],
    ['X hors conversation ne peut pas réagir', 'X', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '👍') returning 1$s$, 'ERR 42501'],

    -- Lire
    ['A voit les 3 réactions', 'A', $s$select count(*) from message_reactions where message_id = '00000000-0000-4000-f000-000000000081'$s$, '3'],
    ['B voit les 3 réactions', 'B', $s$select string_agg(emoji, '' order by emoji) from message_reactions where message_id = '00000000-0000-4000-f000-000000000081'$s$, '❤️🎉😂'],
    ['X ne voit rien', 'X', $s$select count(*) from message_reactions$s$, '0'],
    ['anon : aucun accès', 'anon', $s$select count(*) from message_reactions$s$, 'ERR 42501'],

    -- Retirer
    ['A ne retire pas la réaction de B', 'A', $s$with d as (delete from message_reactions where user_id = '00000000-0000-4000-a000-000000000082' returning 1) select count(*) from d$s$, '0'],
    ['pas de modification', 'B', $s$update message_reactions set emoji = '😢' where user_id = auth.uid() returning 1$s$, 'ERR 42501'],
    ['B retire 🎉', 'B', $s$with d as (delete from message_reactions where message_id = '00000000-0000-4000-f000-000000000081' and user_id = auth.uid() and emoji = '🎉' returning 1) select count(*) from d$s$, '1'],

    -- Bloqué : plus de réaction
    ['A bloque B', 'postgres', $s$insert into user_blocks(blocker_id, blocked_id) values ('00000000-0000-4000-a000-000000000081', '00000000-0000-4000-a000-000000000082') returning 1$s$, '1'],
    ['B bloqué ne peut pas réagir', 'B', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000081', auth.uid(), '😮') returning 1$s$, 'ERR 42501'],
    ['A (qui bloque) non plus', 'A', $s$insert into message_reactions(message_id, user_id, emoji) values ('00000000-0000-4000-f000-000000000082', auth.uid(), '😮') returning 1$s$, 'ERR 42501'],
    ['A débloque B', 'postgres', $s$with d as (delete from user_blocks where blocker_id = '00000000-0000-4000-a000-000000000081' returning 1) select count(*) from d$s$, '1'],

    -- Supprimer ses messages
    ['A ne supprime pas le message de B', 'A', $s$with d as (delete from direct_messages where id = '00000000-0000-4000-f000-000000000082' returning 1) select count(*) from d$s$, '0'],
    ['X ne supprime pas M1', 'X', $s$with d as (delete from direct_messages where id = '00000000-0000-4000-f000-000000000081' returning 1) select count(*) from d$s$, '0'],
    ['A supprime M1', 'A', $s$with d as (delete from direct_messages where id = '00000000-0000-4000-f000-000000000081' returning 1) select count(*) from d$s$, '1'],
    ['réactions de M1 parties avec', 'postgres', $s$select count(*) from message_reactions where message_id = '00000000-0000-4000-f000-000000000081'$s$, '0'],
    ['la réponse perd sa citation', 'postgres', $s$select coalesce(reply_to_id::text, 'aucune') from direct_messages where id = '00000000-0000-4000-f000-000000000082'$s$, 'aucune'],

    -- Temps réel et droits
    ['publiée en temps réel', 'postgres', $s$select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('message_reactions', 'direct_messages')$s$, '2'],
    ['triggers internes non exécutables', 'postgres', $s$select (has_function_privilege('authenticated', 'public.guard_message_reaction_block()', 'execute') or has_function_privilege('authenticated', 'public.guard_direct_message_reply()', 'execute'))::text$s$, 'false']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-mr-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-mr-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-mr-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'A' then A when 'B' then B when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-mr-' || lower(who) || '@amiv.test')::text, true);
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
