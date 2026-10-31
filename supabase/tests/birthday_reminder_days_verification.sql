-- Vérification de 20261102190000 : rappels d'anniversaire (jour J par défaut,
-- J-30 supprimé, rappels J-1/J-3/J-7/J-14 envoyés, pas de doublon).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/birthday_reminder_days_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000081';
  B uuid := '00000000-0000-4000-a000-000000000082';
  cases text[][] := array[
    -- Valeurs autorisées
    ['défaut = jour J seul', 'A', $s$insert into birthdays (user_id, name, birthdate) values (auth.uid(), 'Défaut', '2000-01-01') returning array_to_string(reminder_days, ',') || '|'$s$, '|'],
    ['ancienne app : J-30 devient J-14, trié, sans doublon', 'A', $s$insert into birthdays (user_id, name, birthdate, reminder_days) values (auth.uid(), 'Vieux', '2000-01-02', '{30,7,30}') returning array_to_string(reminder_days, ',')$s$, '7,14'],
    ['J-30 en mise à jour devient J-14', 'A', $s$update birthdays set reminder_days = '{30}' where name = 'Défaut' returning array_to_string(reminder_days, ',')$s$, '14'],
    ['null devient vide', 'A', $s$update birthdays set reminder_days = null where name = 'Défaut' returning array_to_string(reminder_days, ',') || '|'$s$, '|'],
    ['J-5 refusé', 'A', $s$insert into birthdays (user_id, name, birthdate, reminder_days) values (auth.uid(), 'X', '2000-01-03', '{5}') returning 1$s$, 'ERR 23514'],
    ['0 refusé (le jour J est implicite)', 'A', $s$insert into birthdays (user_id, name, birthdate, reminder_days) values (auth.uid(), 'X', '2000-01-03', '{0}') returning 1$s$, 'ERR 23514'],
    ['défaut de la colonne', 'postgres', $s$select column_default || ':' || is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'birthdays' and column_name = 'reminder_days'$s$, '''{}''::integer[]:NO'],

    -- Données d'envoi (année 2000, bissextile)
    ['anniversaires de A', 'A', $s$with x as (insert into birthdays (user_id, name, last_name, birthdate, reminder_days, reminder_enabled) values
        (auth.uid(), 'Jour', 'J', make_date(2000, extract(month from current_date)::int, extract(day from current_date)::int), '{}', true),
        (auth.uid(), 'Demain', null, make_date(2000, extract(month from current_date + 1)::int, extract(day from current_date + 1)::int), '{1,7}', true),
        (auth.uid(), 'Trois', null, make_date(2000, extract(month from current_date + 3)::int, extract(day from current_date + 3)::int), '{3}', true),
        (auth.uid(), 'Sept', null, make_date(2000, extract(month from current_date + 7)::int, extract(day from current_date + 7)::int), '{7,14}', true),
        (auth.uid(), 'Quatorze', null, make_date(2000, extract(month from current_date + 14)::int, extract(day from current_date + 14)::int), '{1,14}', true),
        (auth.uid(), 'SeptNonChoisi', null, make_date(2000, extract(month from current_date + 7)::int, extract(day from current_date + 7)::int), '{}', true),
        (auth.uid(), 'Desactive', null, make_date(2000, extract(month from current_date)::int, extract(day from current_date)::int), '{}', false),
        (auth.uid(), 'Deux', null, make_date(2000, extract(month from current_date + 2)::int, extract(day from current_date + 2)::int), '{1,3}', true)
      returning 1) select count(*) from x$s$, '8'],
    ['anniversaire de B aujourd''hui', 'B', $s$insert into birthdays (user_id, name, birthdate) values (auth.uid(), 'ChezB', make_date(2000, extract(month from current_date)::int, extract(day from current_date)::int)) returning 1$s$, '1'],

    -- Droits
    ['sans compte : refusé', 'anon', 'select inserted_count from create_birthday_today_notifications()', 'ERR 42501'],
    ['connecté : refusé', 'A', 'select inserted_count from create_birthday_today_notifications()', 'ERR 42501'],

    -- Envoi
    ['1er passage : 6 rappels', 'postgres', $s$select inserted_count || ':' || skipped_count from create_birthday_today_notifications()$s$, '6:0'],
    ['2e passage le même jour : rien', 'postgres', $s$select inserted_count || ':' || skipped_count from create_birthday_today_notifications()$s$, '0:6'],
    ['rappels de A', 'postgres', $s$select string_agg(data->>'birthday_name' || '=' || (data->>'reminder_day'), ',' order by (data->>'reminder_day')::int, data->>'birthday_name') from notifications where user_id = '00000000-0000-4000-a000-000000000081' and type = 'birthday_reminder'$s$, 'Jour J=0,Demain=1,Trois=3,Sept=7,Quatorze=14'],
    ['B : jour J', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000082' and type = 'birthday_reminder'$s$, '1'],
    ['titre jour J', 'postgres', $s$select title from notifications where data->>'birthday_name' = 'Jour J'$s$, 'C''est l''anniversaire de Jour J aujourd''hui !'],
    ['titre J-1', 'postgres', $s$select title from notifications where data->>'birthday_name' = 'Demain'$s$, 'L''anniversaire de Demain est demain 🎂'],
    ['titre J-7', 'postgres', $s$select title || ' | ' || body || ' | ' || (data->>'birthday_date') from notifications where data->>'birthday_name' = 'Sept'$s$, 'L''anniversaire de Sept est dans 7 jours 🎂 | Il est encore temps de préparer une surprise. | ' || (current_date + 7)::text],
    ['A voit ses rappels', 'A', $s$select count(*) from notifications where type = 'birthday_reminder'$s$, '5'],

    -- Nettoyage
    ['ancienne fonction supprimée', 'postgres', $s$select to_regprocedure('public.generate_birthday_notifications()') is null$s$, 'true'],
    ['lien /anniv : plus de {7} en dur', 'postgres', $s$select pg_get_functiondef('public.submit_birthday_request(text, text, integer, integer, integer)'::regprocedure) not like '%array[7]%'$s$, 'true']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-rd-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-rd-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

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
