-- Vérification des notifications push : device_tokens (RLS, réattribution,
-- cascade), trigger d'envoi (réglages du profil, appareil requis) et
-- notifications des messages privés (sourdine).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/push_notifications_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées, y compris les appels send-push
-- mis en file par pg_net (aucun n'est réellement envoyé).

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000031';
  B uuid := '00000000-0000-4000-a000-000000000032';
  T1 text := repeat('ab', 32);
  queued text := $q$select count(*) from net.http_request_queue where url like '%/functions/v1/send-push' and convert_from(body, 'utf8') like '%00000000-0000-4000-b000-00000000003_%'$q$;
  dm_queued text := $q$select count(*) from net.http_request_queue q join notifications n on convert_from(q.body, 'utf8') like '%' || n.id || '%' where q.url like '%/functions/v1/send-push' and n.data->>'conversation_id' = '00000000-0000-4000-c000-000000000031'$q$;
  cases text[][] := array[
    ['anon lit device_tokens', 'anon', 'select count(*) from device_tokens', 'ERR 42501'],
    ['anon appelle register_device_token', 'anon', $s$select 'done' from (select register_device_token('abababababababababababababababab')) s$s$, 'ERR 42501'],
    ['A enregistre T1', 'A', $s$select 'done' from (select register_device_token(repeat('AB', 32))) s$s$, 'done'],
    ['T1 stocké en minuscules', 'A', $s$select token = repeat('ab', 32) from device_tokens$s$, 'true'],
    ['A réenregistre T1 (pas de doublon)', 'A', $s$select count(*) from (select register_device_token(repeat('ab', 32))) s, device_tokens$s$, '1'],
    ['jeton invalide refusé', 'B', $s$select 'done' from (select register_device_token('pas-un-jeton')) s$s$, 'ERR P0001'],
    ['B ne voit pas le jeton de A', 'B', 'select count(*) from device_tokens', '0'],
    ['B ne peut pas supprimer le jeton de A', 'B', $s$with x as (delete from device_tokens returning 1) select count(*) from x$s$, '0'],
    ['B forge user_id', 'B', $s$insert into device_tokens(user_id, token) values ('00000000-0000-4000-a000-000000000031', repeat('cd', 32)) returning 1$s$, 'ERR 42501'],
    ['B lit push_deliveries', 'B', 'select count(*) from push_deliveries', 'ERR 42501'],
    ['B marque une notification comme déjà envoyée', 'B', $s$insert into push_deliveries(notification_id) values ('00000000-0000-4000-b000-000000000031') returning 1$s$, 'ERR 42501'],
    ['B ne peut pas appeler push_allowed', 'B', $s$select push_allowed('00000000-0000-4000-a000-000000000031', 'friend_request')$s$, 'ERR 42501'],
    ['B se connecte sur le même iPhone (T1)', 'B', $s$select 'done' from (select register_device_token(repeat('ab', 32))) s$s$, 'done'],
    ['T1 appartient maintenant à B', 'postgres', $s$select user_id::text from device_tokens where token = repeat('ab', 32)$s$, '00000000-0000-4000-a000-000000000032'],
    ['A ne voit plus aucun jeton', 'A', 'select count(*) from device_tokens', '0'],
    ['notif ami pour B (appareil) -> envoi', 'postgres', $s$insert into notifications(id, user_id, type, title) values ('00000000-0000-4000-b000-000000000031', '00000000-0000-4000-a000-000000000032', 'friend_accepted', 'Test') returning 1$s$, '1'],
    ['1 appel send-push en file', 'postgres', 'QUEUED', '1'],
    ['nouveau compte : réglage Messages activé', 'postgres', $s$select notif_messages from profiles where id = '00000000-0000-4000-a000-000000000032'$s$, 'true'],
    ['B coupe les messages', 'B', $s$with x as (update profiles set notif_messages = false where id = '00000000-0000-4000-a000-000000000032' returning 1) select count(*) from x$s$, '1'],
    ['message pour B (messages coupés) -> rien', 'postgres', $s$insert into notifications(id, user_id, type, title) values ('00000000-0000-4000-b000-000000000032', '00000000-0000-4000-a000-000000000032', 'message_received', 'Test') returning 1$s$, '1'],
    ['notif ami pour A (sans appareil) -> rien', 'postgres', $s$insert into notifications(id, user_id, type, title) values ('00000000-0000-4000-b000-000000000033', '00000000-0000-4000-a000-000000000031', 'friend_accepted', 'Test') returning 1$s$, '1'],
    ['B coupe les rappels', 'B', $s$with x as (update profiles set notif_birthdays = false where id = '00000000-0000-4000-a000-000000000032' returning 1) select count(*) from x$s$, '1'],
    ['rappel anniversaire pour B -> rien', 'postgres', $s$insert into notifications(id, user_id, type, title) values ('00000000-0000-4000-b000-000000000034', '00000000-0000-4000-a000-000000000032', 'birthday_reminder', 'Test') returning 1$s$, '1'],
    ['B active les messages', 'B', $s$with x as (update profiles set notif_messages = true where id = '00000000-0000-4000-a000-000000000032' returning 1) select count(*) from x$s$, '1'],
    ['message pour B -> envoi', 'postgres', $s$insert into notifications(id, user_id, type, title) values ('00000000-0000-4000-b000-000000000035', '00000000-0000-4000-a000-000000000032', 'message_received', 'Test') returning 1$s$, '1'],
    ['toujours 2 appels en file au total', 'postgres', 'QUEUED', '2'],
    ['conversation privée A-B', 'postgres', $s$with c as (insert into direct_conversations(id) values ('00000000-0000-4000-c000-000000000031') returning id), p as (insert into direct_conversation_participants(conversation_id, user_id) select c.id, u from c, unnest(array['00000000-0000-4000-a000-000000000031', '00000000-0000-4000-a000-000000000032']::uuid[]) u returning 1) select count(*) from p$s$, '2'],
    ['A écrit à B', 'postgres', $s$insert into direct_messages(conversation_id, sender_id, content) values ('00000000-0000-4000-c000-000000000031', '00000000-0000-4000-a000-000000000031', 'Salut B !') returning 1$s$, '1'],
    ['notification du message privé pour B', 'postgres', $s$select type || '|' || title || '|' || body || '|' || (data->>'sender_id') from notifications where user_id = '00000000-0000-4000-a000-000000000032' and data->>'conversation_id' = '00000000-0000-4000-c000-000000000031'$s$, 'message_received|Message de Alice|Salut B !|00000000-0000-4000-a000-000000000031'],
    ['pas de notification pour l''expéditeur', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000031' and data->>'conversation_id' = '00000000-0000-4000-c000-000000000031'$s$, '0'],
    ['push mis en file pour le message privé', 'postgres', 'DMQUEUED', '1'],
    ['B lit sa notification de message privé', 'B', $s$select count(*) from notifications where data->>'conversation_id' = '00000000-0000-4000-c000-000000000031'$s$, '1'],
    ['B met la conversation en sourdine', 'postgres', $s$with x as (update direct_conversation_participants set is_muted = true where conversation_id = '00000000-0000-4000-c000-000000000031' and user_id = '00000000-0000-4000-a000-000000000032' returning 1) select count(*) from x$s$, '1'],
    ['A écrit encore', 'postgres', $s$insert into direct_messages(conversation_id, sender_id, content) values ('00000000-0000-4000-c000-000000000031', '00000000-0000-4000-a000-000000000031', 'Tu es là ?') returning 1$s$, '1'],
    ['sourdine : pas de nouvelle notification', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000032' and data->>'conversation_id' = '00000000-0000-4000-c000-000000000031'$s$, '1'],
    ['B se déconnecte (supprime T1)', 'B', $s$with x as (delete from device_tokens where token = repeat('ab', 32) returning 1) select count(*) from x$s$, '1'],
    ['B se reconnecte', 'B', $s$select 'done' from (select register_device_token(repeat('ab', 32))) s$s$, 'done'],
    ['suppression du compte B', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000032' returning 1) select count(*) from x$s$, '1'],
    ['jetons de B supprimés', 'postgres', $s$select count(*) from device_tokens where user_id = '00000000-0000-4000-a000-000000000032'$s$, '0']
  ];
  i int; who text; uid uuid; res text; sql text; out text := ''; fails int := 0;
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-pa@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-pb@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into profiles (id, email, first_name, name, username) values
    (A, 'dry-pa@amiv.test', 'Alice', 'Dry', 'drypalice'),
    (B, 'dry-pb@amiv.test', 'Bob', 'Dry', 'drypbob')
  on conflict (id) do update
    set first_name = excluded.first_name, name = excluded.name, username = excluded.username;

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'A' then A when 'B' then B end;
    sql := case cases[i][3] when 'QUEUED' then queued when 'DMQUEUED' then dm_queued else cases[i][3] end;
    begin
      if who = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', uid::text, true);
        execute 'set local role authenticated';
      end if;
      execute sql into res;
      res := coalesce(res, 'NULL');
      execute 'reset role';
    exception when others then
      res := 'ERR ' || sqlstate;
      if cases[i][4] <> res then res := res || ' ' || sqlerrm; end if;
    end;
    execute 'reset role';
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
