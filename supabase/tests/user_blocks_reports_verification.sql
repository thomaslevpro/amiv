-- Vérification du blocage et des signalements (lot B).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/user_blocks_reports_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  A  uuid := '00000000-0000-4000-a000-000000000011'; -- moi (bloqueur)
  B  uuid := '00000000-0000-4000-a000-000000000012'; -- testB (bloqué)
  T  uuid := '00000000-0000-4000-a000-000000000013'; -- compte tiers
  F  uuid := '00000000-0000-4000-a000-000000000014'; -- personne fêtée
  O  uuid := '00000000-0000-4000-a000-000000000015'; -- organisateur
  cases text[][] := array[
    ['anon lit user_blocks', 'anon', 'select count(*) from user_blocks', 'ERR 42501'],
    ['A bloque B', 'A', $s$with x as (insert into user_blocks(blocked_id) values ('00000000-0000-4000-a000-000000000012') returning 1) select count(*) from x$s$, '1'],
    ['A forge blocker_id', 'A', $s$with x as (insert into user_blocks(blocker_id, blocked_id) values ('00000000-0000-4000-a000-000000000013','00000000-0000-4000-a000-000000000012') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['B ne voit pas le blocage', 'B', 'select count(*) from user_blocks', '0'],
    ['A voit son blocage', 'A', 'select count(*) from user_blocks', '1'],
    ['B ne peut pas appeler is_blocked_between', 'B', $s$select public.is_blocked_between('00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000012')::text$s$, 'ERR 42501'],
    ['demande B→A en attente supprimée', 'postgres', $s$select count(*) from friendships where requester_id='00000000-0000-4000-a000-000000000012' and addressee_id='00000000-0000-4000-a000-000000000011'$s$, '0'],
    ['B envoie un MP à A', 'B', $s$with x as (insert into direct_messages(conversation_id,sender_id,content) values ('00000000-0000-4000-d000-000000000001','00000000-0000-4000-a000-000000000012','hey') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['A envoie un MP à B', 'A', $s$with x as (insert into direct_messages(conversation_id,sender_id,content) values ('00000000-0000-4000-d000-000000000001','00000000-0000-4000-a000-000000000011','hey') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['T envoie un MP à A', 'T', $s$with x as (insert into direct_messages(conversation_id,sender_id,content) values ('00000000-0000-4000-d000-000000000002','00000000-0000-4000-a000-000000000013','hey') returning 1) select count(*) from x$s$, '1'],
    ['B demande A en ami', 'B', $s$with x as (insert into friendships(requester_id,addressee_id,status) values ('00000000-0000-4000-a000-000000000012','00000000-0000-4000-a000-000000000011','pending') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['A demande B en ami', 'A', $s$with x as (insert into friendships(requester_id,addressee_id,status) values ('00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000012','pending') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['B invite A (ignoré)', 'B', $s$with x as (insert into invitations(event_id,invited_user_id,invited_by,status) values ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000012','pending') returning 1) select count(*) from x$s$, '0'],
    ['B invite A par email (ignoré)', 'B', $s$with x as (insert into invitations(event_id,invited_email,invited_by,status) values ('00000000-0000-4000-b000-000000000012','DRY-A@amiv.test','00000000-0000-4000-a000-000000000012','pending') returning 1) select count(*) from x$s$, '0'],
    ['B invite A via RPC (ignoré)', 'B', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-b000-000000000012', array['00000000-0000-4000-a000-000000000011']::uuid[])) x where not exists (select 1 from invitations where event_id='00000000-0000-4000-b000-000000000012' and invited_user_id='00000000-0000-4000-a000-000000000011')$s$, '1'],
    ['B invite T', 'B', $s$with x as (insert into invitations(event_id,invited_user_id,invited_by,status) values ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000013','00000000-0000-4000-a000-000000000012','pending') returning 1) select count(*) from x$s$, '1'],
    ['A invite B (sens autorisé)', 'A', $s$with x as (insert into invitations(event_id,invited_user_id,invited_by,status) values ('00000000-0000-4000-b000-000000000011','00000000-0000-4000-a000-000000000012','00000000-0000-4000-a000-000000000011','pending') returning 1) select count(*) from x$s$, '1'],
    ['A lit le chat général (sans B)', 'A', $s$select count(*) from messages where event_id='00000000-0000-4000-b000-000000000001' and is_secret=false$s$, '1'],
    ['T (non invité) lit le chat', 'T', $s$select count(*) from messages where event_id='00000000-0000-4000-b000-000000000001'$s$, '0'],
    ['A get_event_messages général', 'A', $s$select count(*)||'/'||count(*) filter (where is_hidden and content is null) from get_event_messages('00000000-0000-4000-b000-000000000001', false)$s$, '2/1'],
    ['A get_event_messages secret', 'A', $s$select count(*)||'/'||count(*) filter (where is_hidden and content is null) from get_event_messages('00000000-0000-4000-b000-000000000001', true)$s$, '1/1'],
    ['O get_event_messages général', 'O', $s$select count(*)||'/'||count(*) filter (where is_hidden) from get_event_messages('00000000-0000-4000-b000-000000000001', false)$s$, '2/0'],
    ['T get_event_messages', 'T', $s$select count(*) from get_event_messages('00000000-0000-4000-b000-000000000001', false)$s$, '0'],
    ['fêtée get_event_messages secret', 'F', $s$select count(*) from get_event_messages('00000000-0000-4000-b000-000000000001', true)$s$, '0'],
    ['fêtée get_event_messages général', 'F', $s$select count(*) from get_event_messages('00000000-0000-4000-b000-000000000001', false)$s$, '2'],
    ['anon get_event_messages', 'anon', $s$select count(*) from get_event_messages('00000000-0000-4000-b000-000000000001', false)$s$, 'ERR 42501'],
    ['B poste dans le chat', 'B', $s$with x as (insert into messages(event_id,user_id,content) values ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000012','nouveau') returning 1) select count(*) from x$s$, '1'],
    ['pas de notif pour A', 'postgres', $s$select count(*) from notifications where user_id='00000000-0000-4000-a000-000000000011' and type='message_received'$s$, '0'],
    ['notif pour O', 'postgres', $s$select count(*) from notifications where user_id='00000000-0000-4000-a000-000000000015' and type='message_received' and body='nouveau'$s$, '1'],
    ['A lit l''id de son signalement', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('event_message','00000000-0000-4000-e000-000000000001','harassment') returning id) select count(*) from x$s$, 'ERR 42501'],
    ['A signale (insert minimal)', 'A', $s$with x as (insert into reports(target_type,target_id,reason,comment) values ('event_message','00000000-0000-4000-e000-000000000001','harassment','  pas sympa ') returning 1) select count(*) from x$s$, '1'],
    ['A signale à nouveau', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('event_message','00000000-0000-4000-e000-000000000001','spam') returning 1) select count(*) from x$s$, 'ERR 23505'],
    ['A lit reports', 'A', 'select count(*) from reports', 'ERR 42501'],
    ['T signale un message inaccessible', 'T', $s$with x as (insert into reports(target_type,target_id,reason) values ('event_message','00000000-0000-4000-e000-000000000001','spam') returning 1) select count(*) from x$s$, 'ERR P0002'],
    ['fêtée signale un message secret', 'F', $s$with x as (insert into reports(target_type,target_id,reason) values ('event_message','00000000-0000-4000-e000-000000000002','spam') returning 1) select count(*) from x$s$, 'ERR P0002'],
    ['A signale le MP de B', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('direct_message','00000000-0000-4000-e000-000000000003','inappropriate') returning 1) select count(*) from x$s$, '1'],
    ['T signale le MP de B', 'T', $s$with x as (insert into reports(target_type,target_id,reason) values ('direct_message','00000000-0000-4000-e000-000000000003','spam') returning 1) select count(*) from x$s$, 'ERR P0002'],
    ['A signale le profil de B', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('profile','00000000-0000-4000-a000-000000000012','other') returning 1) select count(*) from x$s$, '1'],
    ['A signale son propre profil', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('profile','00000000-0000-4000-a000-000000000011','other') returning 1) select count(*) from x$s$, 'ERR 22023'],
    ['A forge reporter_id', 'A', $s$with x as (insert into reports(reporter_id,target_type,target_id,reason) values ('00000000-0000-4000-a000-000000000013','profile','00000000-0000-4000-a000-000000000012','other') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['motif invalide', 'A', $s$with x as (insert into reports(target_type,target_id,reason) values ('profile','00000000-0000-4000-a000-000000000015','nope') returning 1) select count(*) from x$s$, 'ERR 23514'],
    ['anon signale', 'anon', $s$with x as (insert into reports(target_type,target_id,reason) values ('profile','00000000-0000-4000-a000-000000000012','other') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['signalements figés', 'postgres', $s$select count(*) from reports where reporter_id='00000000-0000-4000-a000-000000000011' and reported_user_id='00000000-0000-4000-a000-000000000012' and content_snapshot is not null$s$, '3'],
    ['commentaire nettoyé + event_id', 'postgres', $s$select count(*) from reports where comment='pas sympa' and event_id='00000000-0000-4000-b000-000000000001'$s$, '1'],
    ['A débloque B', 'A', $s$with x as (delete from user_blocks where blocked_id='00000000-0000-4000-a000-000000000012' returning 1) select count(*) from x$s$, '1'],
    ['B renvoie un MP à A', 'B', $s$with x as (insert into direct_messages(conversation_id,sender_id,content) values ('00000000-0000-4000-d000-000000000001','00000000-0000-4000-a000-000000000012','re') returning 1) select count(*) from x$s$, '1'],
    ['A relit le chat (B visible)', 'A', $s$select count(*) from messages where event_id='00000000-0000-4000-b000-000000000001' and is_secret=false$s$, '3']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
  EV uuid := '00000000-0000-4000-b000-000000000001';
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (T, 'dry-t@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (O, 'dry-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into events (id, name, type, user_id, birthday_person_user_id, date) values
    (EV, 'Dry anniv', 'Anniversaire', O, F, now() + interval '30 days'),
    ('00000000-0000-4000-b000-000000000011', 'Event de A', 'Autre', A, null, now() + interval '30 days'),
    ('00000000-0000-4000-b000-000000000012', 'Event de B', 'Autre', B, null, now() + interval '30 days');
  insert into event_organizers (event_id, user_id, role, status) values (EV, O, 'owner', 'approved');
  insert into invitations (event_id, invited_user_id, invited_by, status) values
    (EV, A, O, 'accepted'), (EV, B, O, 'accepted'), (EV, F, O, 'accepted');
  insert into rsvps (event_id, user_id, status) values (EV, A, 'going'), (EV, B, 'going'), (EV, F, 'going');
  insert into messages (id, event_id, user_id, content, is_secret) values
    ('00000000-0000-4000-e000-000000000001', EV, B, 'msg de B', false),
    ('00000000-0000-4000-e000-000000000002', EV, B, 'secret de B', true),
    ('00000000-0000-4000-e000-000000000004', EV, O, 'msg de O', false);
  insert into direct_conversations (id) values ('00000000-0000-4000-d000-000000000001'), ('00000000-0000-4000-d000-000000000002');
  insert into direct_conversation_participants (conversation_id, user_id) values
    ('00000000-0000-4000-d000-000000000001', A), ('00000000-0000-4000-d000-000000000001', B),
    ('00000000-0000-4000-d000-000000000002', A), ('00000000-0000-4000-d000-000000000002', T);
  insert into direct_messages (id, conversation_id, sender_id, content) values
    ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000001', B, 'MP de B');
  insert into friendships (requester_id, addressee_id, status) values (B, A, 'pending');
  delete from notifications where user_id in (A, B, T, F, O);

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'A' then A when 'B' then B when 'T' then T when 'F' then F when 'O' then O end;
    begin
      if who = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', 'dry-' || lower(who) || '@amiv.test')::text, true);
        perform set_config('request.jwt.claim.sub', uid::text, true);
        execute 'set local role authenticated';
      end if;
      execute cases[i][3] into res;
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
