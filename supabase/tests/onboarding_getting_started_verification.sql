-- Vérification de 20261102100000 : carte « Bien démarrer » masquable.
-- (Le rappel J-7 aux amis a été remplacé par 20261102210000_friend_birthdays,
-- voir friend_birthdays_verification.sql.)
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/onboarding_getting_started_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000071';
  B uuid := '00000000-0000-4000-a000-000000000072';
  C uuid := '00000000-0000-4000-a000-000000000073';
  D uuid := '00000000-0000-4000-a000-000000000074';
  E uuid := '00000000-0000-4000-a000-000000000075';
  cases text[][] := array[
    -- Carte « Bien démarrer »
    ['A masque la carte', 'A', $s$with x as (update profiles set getting_started_dismissed_at = now() where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A ne masque pas celle de B', 'A', $s$with x as (update profiles set getting_started_dismissed_at = now() where id = '00000000-0000-4000-a000-000000000072' returning 1) select count(*) from x$s$, '0'],
    ['lecture via get_my_profile', 'A', $s$select getting_started_dismissed_at is not null from get_my_profile()$s$, 'true'],
    ['colonne privée (pas de select direct)', 'B', $s$select getting_started_dismissed_at from profiles where id = '00000000-0000-4000-a000-000000000071'$s$, 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-ob-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-ob-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-ob-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-ob-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-ob-e@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'A' then A when 'B' then B end;
    begin
      if who = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated')::text, true);
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
