-- Vérification de 20261102220000 (partie 1) : année inconnue explicite
-- (birthdays.birth_year_known), une vraie naissance en 2000 est connue.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/birthday_year_known_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-0000000000a1';
  cases text[][] := array[
    ['colonne obligatoire', 'postgres', $s$select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'birthdays' and column_name = 'birth_year_known'$s$, 'NO'],
    ['aucune ligne sans valeur', 'postgres', 'select count(*) from birthdays where birth_year_known is null', '0'],

    -- Nouvelle app : valeur explicite
    ['vraie naissance en 2000', 'A', $s$insert into birthdays (user_id, name, birthdate, birth_year_known) values (auth.uid(), 'Vrai2000', '2000-03-12', true) returning birthdate || ':' || birth_year_known$s$, '2000-03-12:true'],
    ['année inconnue', 'A', $s$insert into birthdays (user_id, name, birthdate, birth_year_known) values (auth.uid(), 'Inconnue', '2000-04-01', false) returning birthdate || ':' || birth_year_known$s$, '2000-04-01:false'],
    ['inconnue : année ramenée à 2000', 'A', $s$insert into birthdays (user_id, name, birthdate, birth_year_known) values (auth.uid(), 'Ramenee', '1995-05-02', false) returning birthdate || ':' || birth_year_known$s$, '2000-05-02:false'],
    ['29 février inconnu', 'A', $s$insert into birthdays (user_id, name, birthdate, birth_year_known) values (auth.uid(), 'Bissextile', '2000-02-29', false) returning birthdate || ':' || birth_year_known$s$, '2000-02-29:false'],

    -- Ancienne app : pas de valeur
    ['ancienne app : 2000 = inconnue', 'A', $s$insert into birthdays (user_id, name, birthdate) values (auth.uid(), 'Vieux2000', '2000-06-03') returning birth_year_known::text$s$, 'false'],
    ['ancienne app : 1995 = connue', 'A', $s$insert into birthdays (user_id, name, birthdate) values (auth.uid(), 'Vieux1995', '1995-06-04') returning birth_year_known::text$s$, 'true'],
    ['ancienne app : âge saisi → connue', 'A', $s$update birthdays set birthdate = '1995-06-03' where name = 'Vieux2000' returning birthdate || ':' || birth_year_known$s$, '1995-06-03:true'],
    ['ancienne app : jour changé → reste inconnue', 'A', $s$update birthdays set birthdate = '2000-04-02' where name = 'Inconnue' returning birthdate || ':' || birth_year_known$s$, '2000-04-02:false'],

    -- Mises à jour de la nouvelle app
    ['vraie 2000 : jour changé → reste connue', 'A', $s$update birthdays set birthdate = '2000-03-13' where name = 'Vrai2000' returning birthdate || ':' || birth_year_known$s$, '2000-03-13:true'],
    ['inconnue → vraie 2000 (âge saisi)', 'A', $s$update birthdays set birthdate = '2000-04-02', birth_year_known = true where name = 'Inconnue' returning birthdate || ':' || birth_year_known$s$, '2000-04-02:true'],
    ['année effacée', 'A', $s$update birthdays set birth_year_known = false where name = 'Vieux1995' returning birthdate || ':' || birth_year_known$s$, '2000-06-04:false'],

    -- Envoi : le jour J d'une année inconnue reste envoyé
    ['anniversaire inconnu aujourd''hui', 'A', $s$insert into birthdays (user_id, name, birthdate, birth_year_known) values (auth.uid(), 'Auj', make_date(2000, extract(month from current_date)::int, extract(day from current_date)::int), false) returning 1$s$, '1'],
    ['envoyé', 'postgres', $s$select count(*) from (select create_birthday_today_notifications()) s$s$, '1'],
    ['rappel reçu', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-0000000000a1' and data->>'birthday_name' = 'Auj'$s$, '1']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-yk-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'A' then A end;
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
