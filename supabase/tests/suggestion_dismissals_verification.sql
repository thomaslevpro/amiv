-- Vérification des suggestions : masquées, profils sans nom ni pseudo, blocages.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/suggestion_dismissals_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000021'; -- moi
  B uuid := '00000000-0000-4000-a000-000000000022'; -- profil complet
  C uuid := '00000000-0000-4000-a000-000000000023'; -- profil complet, masqué par A
  N uuid := '00000000-0000-4000-a000-000000000024'; -- sans nom, avec pseudo
  U uuid := '00000000-0000-4000-a000-000000000025'; -- avec nom, sans pseudo
  E uuid := '00000000-0000-4000-a000-000000000026'; -- ni nom ni pseudo
  X uuid := '00000000-0000-4000-a000-000000000027'; -- bloqué par A
  Y uuid := '00000000-0000-4000-a000-000000000028'; -- a bloqué A
  cases text[][] := array[
    ['anon lit suggestion_dismissals', 'anon', 'select count(*) from suggestion_dismissals', 'ERR 42501'],
    ['A voit B, C, N (pseudo seul), U (nom seul) ; pas E, X, Y', 'A', $s$select string_agg(coalesce(name, '-') || '/' || coalesce(username, '-'), ',' order by user_id) from get_friend_suggestions('00000000-0000-4000-a000-000000000021') where user_id::text like '00000000-0000-4000-a000-00000000002_'$s$, 'Bob Dry/drybob,Chloé Dry/drychloe,-/drynoname,Ugo Dry/-'],
    ['X ne voit pas A (A l''a bloqué)', 'X', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000027') where user_id = '00000000-0000-4000-a000-000000000021'$s$, '0'],
    ['Y ne voit pas A (Y l''a bloqué)', 'Y', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000028') where user_id = '00000000-0000-4000-a000-000000000021'$s$, '0'],
    ['X voit toujours B', 'X', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000027') where user_id = '00000000-0000-4000-a000-000000000022'$s$, '1'],
    ['A masque C', 'A', $s$with x as (insert into suggestion_dismissals(dismissed_user_id) values ('00000000-0000-4000-a000-000000000023') returning 1) select count(*) from x$s$, '1'],
    ['A masque C à nouveau', 'A', $s$insert into suggestion_dismissals(dismissed_user_id) values ('00000000-0000-4000-a000-000000000023') returning 1$s$, 'ERR 23505'],
    ['A forge user_id', 'A', $s$insert into suggestion_dismissals(user_id, dismissed_user_id) values ('00000000-0000-4000-a000-000000000022','00000000-0000-4000-a000-000000000023') returning 1$s$, 'ERR 42501'],
    ['A se masque lui-même', 'A', $s$insert into suggestion_dismissals(dismissed_user_id) values ('00000000-0000-4000-a000-000000000021') returning 1$s$, 'ERR 23514'],
    ['C n''apparaît plus pour A', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000021') where user_id = '00000000-0000-4000-a000-000000000023'$s$, '0'],
    ['B apparaît toujours pour A', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000021') where user_id = '00000000-0000-4000-a000-000000000022'$s$, '1'],
    ['C toujours suggéré à B', 'B', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000022') where user_id = '00000000-0000-4000-a000-000000000023'$s$, '1'],
    ['A voit sa ligne', 'A', 'select count(*) from suggestion_dismissals', '1'],
    ['B ne voit pas la ligne de A', 'B', 'select count(*) from suggestion_dismissals', '0'],
    ['B ne peut pas supprimer la ligne de A', 'B', $s$with x as (delete from suggestion_dismissals returning 1) select count(*) from x$s$, '0'],
    ['B ne peut pas modifier la ligne de A', 'B', $s$update suggestion_dismissals set dismissed_user_id = '00000000-0000-4000-a000-000000000022'$s$, 'ERR 42501'],
    ['B lit les suggestions de A', 'B', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000021')$s$, '0'],
    ['B masque C', 'B', $s$with x as (insert into suggestion_dismissals(dismissed_user_id) values ('00000000-0000-4000-a000-000000000023') returning 1) select count(*) from x$s$, '1'],
    ['suppression du compte A', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000021' returning 1) select count(*) from x$s$, '1'],
    ['lignes de A supprimées', 'postgres', $s$select count(*) from suggestion_dismissals where user_id = '00000000-0000-4000-a000-000000000021'$s$, '0'],
    ['suppression du compte C (masqué)', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000023' returning 1) select count(*) from x$s$, '1'],
    ['lignes visant C supprimées', 'postgres', $s$select count(*) from suggestion_dismissals where dismissed_user_id = '00000000-0000-4000-a000-000000000023'$s$, '0']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-sa@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-sb@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-sc@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (N, 'dry-sn@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (U, 'dry-su@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-se@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-sx@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (Y, 'dry-sy@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into profiles (id, email, first_name, name, username) values
    (A, 'dry-sa@amiv.test', 'Alice', 'Dry', 'dryalice'),
    (B, 'dry-sb@amiv.test', 'Bob', 'Dry', 'drybob'),
    (C, 'dry-sc@amiv.test', 'Chloé', 'Dry', 'drychloe'),
    (N, 'dry-sn@amiv.test', '  ', '', 'drynoname'),
    (U, 'dry-su@amiv.test', 'Ugo', 'Dry', null),
    (E, 'dry-se@amiv.test', null, ' ', null),
    (X, 'dry-sx@amiv.test', 'Xavier', 'Dry', 'dryxavier'),
    (Y, 'dry-sy@amiv.test', 'Yann', 'Dry', 'dryyann')
  on conflict (id) do update
    set first_name = excluded.first_name, name = excluded.name, username = excluded.username;
  insert into user_blocks (blocker_id, blocked_id) values (A, X), (Y, A);

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'A' then A when 'B' then B when 'X' then X when 'Y' then Y end;
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
