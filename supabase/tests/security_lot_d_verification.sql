-- Vérification du lot D (RPC, conversations privées, carte de groupe,
-- personne fêtée, budget). Après application des migrations :
--   supabase db query --linked -f supabase/tests/security_lot_d_verification.sql
-- Avant application (dry-run) : concaténer les migrations 2026102913*.sql
-- devant ce script.
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000031'; -- owner
  C uuid := '00000000-0000-4000-a000-000000000032'; -- co-organisateur
  F uuid := '00000000-0000-4000-a000-000000000033'; -- personne fêtée (invitée + co-org)
  B uuid := '00000000-0000-4000-a000-000000000034'; -- testB, invité going
  T uuid := '00000000-0000-4000-a000-000000000035'; -- compte tiers
  EV uuid := '00000000-0000-4000-b000-000000000031';
  EV2 uuid := '00000000-0000-4000-b000-000000000032';
  DC uuid := '00000000-0000-4000-d000-000000000031';
  cases text[][] := array[
    ['tiers s''invite (RPC)', 'T', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-b000-000000000031', array['00000000-0000-4000-a000-000000000035']::uuid[])) x$s$, 'ERR 42501'],
    ['anon invite (RPC)', 'anon', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-b000-000000000031', array['00000000-0000-4000-a000-000000000035']::uuid[])) x$s$, 'ERR 42501'],
    ['invité testB invite (RPC)', 'B', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-b000-000000000031', array['00000000-0000-4000-a000-000000000035']::uuid[])) x$s$, 'ERR 42501'],
    ['co-org invite tiers (RPC)', 'C', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-b000-000000000031', array['00000000-0000-4000-a000-000000000035']::uuid[])) x$s$, '1'],
    ['invitation créée', 'postgres', $s$select count(*) from invitations where event_id='00000000-0000-4000-b000-000000000031' and invited_user_id='00000000-0000-4000-a000-000000000035' and invited_by='00000000-0000-4000-a000-000000000032'$s$, '1'],
    ['is_invited_to_event soi', 'B', $s$select public.is_invited_to_event('00000000-0000-4000-b000-000000000031','00000000-0000-4000-a000-000000000034')::text$s$, 'true'],
    ['is_invited_to_event autrui', 'B', $s$select public.is_invited_to_event('00000000-0000-4000-b000-000000000031','00000000-0000-4000-a000-000000000033')::text$s$, 'false'],
    ['is_invited_to_event anon', 'anon', $s$select public.is_invited_to_event('00000000-0000-4000-b000-000000000031','00000000-0000-4000-a000-000000000034')::text$s$, 'ERR 42501'],
    ['autres participants : tiers', 'T', $s$select count(*) from get_conversation_other_participants(array['00000000-0000-4000-d000-000000000031']::uuid[])$s$, '0'],
    ['autres participants : membre', 'B', $s$select count(*) from get_conversation_other_participants(array['00000000-0000-4000-d000-000000000031']::uuid[]) where other_user_id='00000000-0000-4000-a000-000000000031'$s$, '1'],
    ['autres participants : anon', 'anon', $s$select count(*) from get_conversation_other_participants(array['00000000-0000-4000-d000-000000000031']::uuid[])$s$, 'ERR 42501'],
    ['nb mots carte : fêtée', 'F', $s$select get_card_message_count('00000000-0000-4000-b000-000000000031')::text$s$, '0'],
    ['nb mots carte : testB', 'B', $s$select get_card_message_count('00000000-0000-4000-b000-000000000031')::text$s$, '1'],
    ['nb mots carte : tiers', 'T', $s$select get_card_message_count('00000000-0000-4000-b000-000000000031')::text$s$, '0'],
    ['nb mots carte : anon', 'anon', $s$select get_card_message_count('00000000-0000-4000-b000-000000000031')::text$s$, 'ERR 42501'],
    ['calendar dots : anon', 'anon', $s$select count(*) from get_calendar_dots('2026-01-01','2026-12-31')$s$, 'ERR 42501'],
    ['tiers s''ajoute à une conversation', 'T', $s$with x as (insert into direct_conversation_participants(conversation_id,user_id) values ('00000000-0000-4000-d000-000000000031','00000000-0000-4000-a000-000000000035') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['tiers crée une conversation', 'T', $s$with x as (insert into direct_conversations default values returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['testB déplace sa participation', 'B', $s$with x as (update direct_conversation_participants set conversation_id=gen_random_uuid() where user_id='00000000-0000-4000-a000-000000000034' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['testB met en sourdine', 'B', $s$with x as (update direct_conversation_participants set is_muted=true where user_id='00000000-0000-4000-a000-000000000034' returning 1) select count(*) from x$s$, '1'],
    ['testB lit sa conversation', 'B', 'select count(*) from direct_conversations', '1'],
    ['RPC conversation testB→tiers', 'B', $s$select (public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000034','00000000-0000-4000-a000-000000000035') is not null)::text$s$, 'true'],
    ['RPC : 2 participants créés', 'postgres', $s$select count(*) from direct_conversation_participants p join direct_conversation_participants q on q.conversation_id=p.conversation_id where p.user_id='00000000-0000-4000-a000-000000000034' and q.user_id='00000000-0000-4000-a000-000000000035'$s$, '1'],
    ['RPC tiers→testB = même conversation', 'T', $s$select count(distinct c) from (select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000035','00000000-0000-4000-a000-000000000034') c union all select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000035','00000000-0000-4000-a000-000000000034')) x$s$, '1'],
    ['RPC p_user_id forgé', 'B', $s$select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000035','00000000-0000-4000-a000-000000000033')::text$s$, 'ERR 42501'],
    ['RPC avec soi-même', 'B', $s$select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000034','00000000-0000-4000-a000-000000000034')::text$s$, 'ERR 22023'],
    ['RPC bloquée (fêtée a bloqué tiers)', 'T', $s$select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000035','00000000-0000-4000-a000-000000000033')::text$s$, 'ERR 42501'],
    ['RPC anon', 'anon', $s$select public.find_or_create_direct_conversation('00000000-0000-4000-a000-000000000035','00000000-0000-4000-a000-000000000033')::text$s$, 'ERR 42501'],
    ['carte : owner crée', 'O', $s$with x as (insert into group_cards(event_id,status) values ('00000000-0000-4000-b000-000000000031','collecting') returning 1) select count(*) from x$s$, '1'],
    ['carte : owner crée hors anniversaire', 'O', $s$with x as (insert into group_cards(event_id,status) values ('00000000-0000-4000-b000-000000000032','collecting') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['carte : testB crée', 'B', $s$with x as (insert into group_cards(event_id,status) values ('00000000-0000-4000-b000-000000000032','collecting') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['carte : fêtée (co-org) révèle', 'F', $s$with x as (update group_cards set status='revealed' returning 1) select count(*) from x$s$, '0'],
    ['carte : testB révèle', 'B', $s$with x as (update group_cards set status='revealed' returning 1) select count(*) from x$s$, '0'],
    ['carte : tiers révèle', 'T', $s$with x as (update group_cards set status='revealed' returning 1) select count(*) from x$s$, '0'],
    ['carte : co-org révèle', 'C', $s$with x as (update group_cards set status='revealed' returning 1) select count(*) from x$s$, '1'],
    ['carte : testB lit', 'B', 'select count(*) from group_cards', '1'],
    ['carte : fêtée lit', 'F', 'select count(*) from group_cards', '0'],
    ['carte : anon lit', 'anon', 'select count(*) from group_cards', 'ERR 42501'],
    ['mots : fêtée lit', 'F', 'select count(*) from group_card_messages', '0'],
    ['mots : testB lit', 'B', 'select count(*) from group_card_messages', '1'],
    ['mots : tiers lit', 'T', 'select count(*) from group_card_messages', '0'],
    ['mots : fêtée écrit', 'F', $s$with x as (insert into group_card_messages(event_id,user_id,message) values ('00000000-0000-4000-b000-000000000031','00000000-0000-4000-a000-000000000033','coucou') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['mots : co-org écrit', 'C', $s$with x as (insert into group_card_messages(event_id,user_id,message) values ('00000000-0000-4000-b000-000000000031','00000000-0000-4000-a000-000000000032','bravo') returning 1) select count(*) from x$s$, '1'],
    ['réactions carte : testB réagit', 'B', $s$with x as (insert into group_card_reactions(message_id,user_id,emoji) values ('00000000-0000-4000-e000-000000000031','00000000-0000-4000-a000-000000000034','🎉') returning 1) select count(*) from x$s$, '1'],
    ['réactions carte : tiers réagit', 'T', $s$with x as (insert into group_card_reactions(message_id,user_id,emoji) values ('00000000-0000-4000-e000-000000000031','00000000-0000-4000-a000-000000000035','🎉') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['réactions carte : fêtée lit', 'F', 'select count(*) from group_card_reactions', '0'],
    ['réactions carte : anon lit', 'anon', 'select count(*) from group_card_reactions', 'ERR 42501'],
    ['réactions souvenir : testB réagit', 'B', $s$with x as (insert into memory_reactions(memory_id,user_id,emoji) values ('00000000-0000-4000-f000-000000000031','00000000-0000-4000-a000-000000000034','❤️') returning 1) select count(*) from x$s$, '1'],
    ['réactions souvenir : tiers réagit', 'T', $s$with x as (insert into memory_reactions(memory_id,user_id,emoji) values ('00000000-0000-4000-f000-000000000031','00000000-0000-4000-a000-000000000035','❤️') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['réactions souvenir : fêtée réagit', 'F', $s$with x as (insert into memory_reactions(memory_id,user_id,emoji) values ('00000000-0000-4000-f000-000000000031','00000000-0000-4000-a000-000000000033','❤️') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['réactions souvenir : fêtée lit', 'F', 'select count(*) from memory_reactions', '0'],
    ['réactions souvenir : owner lit', 'O', 'select count(*) from memory_reactions', '1'],
    ['réactions souvenir : anon lit', 'anon', 'select count(*) from memory_reactions', 'ERR 42501'],
    ['checklist : co-org lit', 'C', $s$select (count(*) > 0)::text from checklist_items where event_id='00000000-0000-4000-b000-000000000031'$s$, 'true'],
    ['checklist : fêtée (co-org) lit', 'F', 'select count(*) from checklist_items', '0'],
    ['checklist : fêtée (co-org) ajoute', 'F', $s$with x as (insert into checklist_items(event_id,label) values ('00000000-0000-4000-b000-000000000031','x') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['checklist : testB lit', 'B', 'select count(*) from checklist_items', '0'],
    ['checklist : owner hors anniversaire', 'O', $s$with x as (insert into checklist_items(event_id,label) values ('00000000-0000-4000-b000-000000000032','x') returning 1) select count(*) from x$s$, '1'],
    ['dépenses : owner ajoute', 'O', $s$with x as (insert into event_expenses(event_id,label,amount) values ('00000000-0000-4000-b000-000000000031','gâteau',30) returning 1) select count(*) from x$s$, '1'],
    ['dépenses : fêtée (co-org) lit', 'F', 'select count(*) from event_expenses', '0'],
    ['dépenses : co-org lit', 'C', 'select count(*) from event_expenses', '1'],
    ['budget : reprise des données', 'postgres', $s$select count(*) from event_budgets where event_id not in ('00000000-0000-4000-b000-000000000031','00000000-0000-4000-b000-000000000032')$s$, '2'],
    ['budget : owner définit', 'O', $s$with x as (insert into event_budgets(event_id,total) values ('00000000-0000-4000-b000-000000000031',300) returning 1) select count(*) from x$s$, '1'],
    ['budget : co-org modifie', 'C', $s$with x as (update event_budgets set total=350 returning 1) select count(*) from x$s$, '1'],
    ['budget : fêtée (co-org) lit', 'F', 'select count(*) from event_budgets', '0'],
    ['budget : fêtée (co-org) modifie', 'F', $s$with x as (update event_budgets set total=1 returning 1) select count(*) from x$s$, '0'],
    ['budget : testB lit', 'B', 'select count(*) from event_budgets', '0'],
    ['budget : anon lit', 'anon', 'select count(*) from event_budgets', 'ERR 42501'],
    ['budget : colonne events supprimée', 'B', 'select count(budget_total) from events', 'ERR 42703']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (T, 'dry-t@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into events (id, name, type, user_id, birthday_person_user_id, date) values
    (EV, 'Dry anniv', 'Anniversaire', O, F, now() + interval '30 days'),
    (EV2, 'Dry soirée', 'Autre', O, null, now() + interval '30 days');
  insert into event_organizers (event_id, user_id, role, status) values
    (EV, O, 'owner', 'approved'), (EV, C, 'co_organizer', 'approved'), (EV, F, 'co_organizer', 'approved'), (EV2, O, 'owner', 'approved');
  insert into invitations (event_id, invited_user_id, invited_by, status) values (EV, B, O, 'accepted'), (EV, F, O, 'accepted');
  insert into rsvps (event_id, user_id, status) values (EV, B, 'going'), (EV, F, 'going');
  insert into direct_conversations (id) values (DC);
  insert into direct_conversation_participants (conversation_id, user_id) values (DC, O), (DC, B);
  insert into group_card_messages (id, event_id, user_id, message) values ('00000000-0000-4000-e000-000000000031', EV, B, 'joyeux anniv');
  insert into collective_cards (id, event_id) values ('00000000-0000-4000-c000-000000000031', EV);
  insert into collective_memories (id, event_id, card_id, contributor_id, text) values ('00000000-0000-4000-f000-000000000031', EV, '00000000-0000-4000-c000-000000000031', B, 'souvenir');
  insert into user_blocks (blocker_id, blocked_id) values (F, T);

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'O' then O when 'C' then C when 'F' then F when 'B' then B when 'T' then T end;
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
