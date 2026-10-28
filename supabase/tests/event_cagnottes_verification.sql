-- Vérification RLS de event_cagnottes / cagnotte_contributions (lot A).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_cagnottes_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  O  uuid := '00000000-0000-4000-a000-000000000001'; -- owner
  C  uuid := '00000000-0000-4000-a000-000000000002'; -- co-organisateur approuvé
  B  uuid := '00000000-0000-4000-a000-000000000003'; -- testB, invité "going"
  T  uuid := '00000000-0000-4000-a000-000000000004'; -- compte tiers
  F  uuid := '00000000-0000-4000-a000-000000000005'; -- personne fêtée (invitée going + co-org)
  EV uuid := '00000000-0000-4000-b000-000000000001';
  EV2 uuid := '00000000-0000-4000-b000-000000000002';
  G  uuid := '00000000-0000-4000-c000-000000000001';
  G2 uuid := '00000000-0000-4000-c000-000000000002';
  cases text[][] := array[
    -- label, who, sql, expected
    ['anon lit cagnotte', 'anon', 'select count(*) from event_cagnottes', 'ERR 42501'],
    ['owner crée cagnotte', 'O', $s$with x as (insert into event_cagnottes(event_id,url,goal,gift_id) values ('00000000-0000-4000-b000-000000000001','https://leetchi.com/x',150,'00000000-0000-4000-c000-000000000001') returning 1) select count(*) from x$s$, '1'],
    ['created_by = owner', 'postgres', $s$select count(*) from event_cagnottes where created_by='00000000-0000-4000-a000-000000000001'$s$, '1'],
    ['testB lit cagnotte', 'B', 'select count(*) from event_cagnottes', '1'],
    ['testB modifie cagnotte', 'B', $s$with x as (update event_cagnottes set goal=1 returning 1) select count(*) from x$s$, '0'],
    ['testB supprime cagnotte', 'B', $s$with x as (delete from event_cagnottes returning 1) select count(*) from x$s$, '0'],
    ['tiers lit cagnotte', 'T', 'select count(*) from event_cagnottes', '0'],
    ['fêtée lit cagnotte', 'F', 'select count(*) from event_cagnottes', '0'],
    ['fêtée (co-org) modifie', 'F', $s$with x as (update event_cagnottes set goal=1 returning 1) select count(*) from x$s$, '0'],
    ['fêtée (co-org) crée sur EV2', 'F', $s$with x as (insert into event_cagnottes(event_id,url) values ('00000000-0000-4000-b000-000000000002','https://a.b') returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['co-org modifie', 'C', $s$with x as (update event_cagnottes set goal=200 returning 1) select count(*) from x$s$, '1'],
    ['created_by inchangé', 'postgres', $s$select count(*) from event_cagnottes where created_by='00000000-0000-4000-a000-000000000001' and goal=200$s$, '1'],
    ['owner force created_by', 'O', $s$with x as (update event_cagnottes set created_by='00000000-0000-4000-a000-000000000003' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['url javascript:', 'O', $s$with x as (update event_cagnottes set url='javascript:alert(1)' returning 1) select count(*) from x$s$, 'ERR 23514'],
    ['cadeau d''un autre événement', 'O', $s$with x as (update event_cagnottes set gift_id='00000000-0000-4000-c000-000000000002' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['contrib: testB ajoute la sienne', 'B', $s$with x as (insert into cagnotte_contributions(event_id,user_id,amount) values ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000003',20) returning 1) select count(*) from x$s$, '1'],
    ['contrib: testB pour un autre', 'B', $s$with x as (insert into cagnotte_contributions(event_id,user_id,amount) values ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000002',20) returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['contrib: owner lit', 'O', 'select count(*) from cagnotte_contributions where event_id=''00000000-0000-4000-b000-000000000001''', '1'],
    ['contrib: fêtée lit', 'F', 'select count(*) from cagnotte_contributions', '0'],
    ['contrib: fêtée ajoute', 'F', $s$with x as (insert into cagnotte_contributions(event_id,user_id,amount) values ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000005',20) returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['contrib: tiers lit', 'T', 'select count(*) from cagnotte_contributions', '0'],
    ['contrib: anon lit', 'anon', 'select count(*) from cagnotte_contributions', 'ERR 42501'],
    ['contrib: co-org corrige', 'C', $s$with x as (update cagnotte_contributions set amount=25 returning 1) select count(*) from x$s$, '1'],
    ['events.cagnotte_url supprimée', 'O', 'select count(cagnotte_url) from events', 'ERR 42703'],
    ['suppression compte owner', 'postgres', $s$select count(*) from (select public.prepare_account_deletion('00000000-0000-4000-a000-000000000001')) x$s$, '1'],
    ['événement transféré au co-org', 'postgres', $s$select count(*) from events where id='00000000-0000-4000-b000-000000000001' and user_id='00000000-0000-4000-a000-000000000002'$s$, '1'],
    ['delete auth.users owner', 'postgres', $s$with x as (delete from auth.users where id='00000000-0000-4000-a000-000000000001' returning 1) select count(*) from x$s$, '1'],
    ['cagnotte conservée, created_by null', 'postgres', $s$select count(*) from event_cagnottes where event_id='00000000-0000-4000-b000-000000000001' and created_by is null$s$, '1']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (T, 'dry-t@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into events (id, name, type, user_id, birthday_person_user_id, date) values
    (EV, 'Dry anniv', 'Anniversaire', O, F, now() + interval '30 days'),
    (EV2, 'Dry anniv 2', 'Anniversaire', O, F, now() + interval '30 days');
  insert into event_organizers (event_id, user_id, role, status) values
    (EV, O, 'owner', 'approved'), (EV, C, 'co_organizer', 'approved'), (EV, F, 'co_organizer', 'approved'),
    (EV2, O, 'owner', 'approved'), (EV2, F, 'co_organizer', 'approved');
  insert into invitations (event_id, invited_user_id, invited_by, status) values
    (EV, B, O, 'accepted'), (EV, F, O, 'accepted');
  insert into rsvps (event_id, user_id, status) values (EV, B, 'going'), (EV, F, 'going');
  insert into gifts (id, event_id, name) values (G, EV, 'Cadeau'), (G2, EV2, 'Autre');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'O' then O when 'C' then C when 'B' then B when 'T' then T when 'F' then F end;
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
