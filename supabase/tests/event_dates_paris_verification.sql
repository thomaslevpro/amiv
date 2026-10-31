-- Vérification de 20261102260000 et de la règle des heures d'événement
-- (lib/eventDate.js) autour des changements d'heure (25/10/2026, 28/03/2027) :
-- points du calendrier sur le jour de Paris, y compris entre minuit et 2 h et
-- le dernier jour du mois ; une chaîne sans fuseau (ancien « Modifier » /
-- confirmation de sondage) est lue en UTC par Postgres, d'où le décalage.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_dates_paris_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000071';
  G uuid := '00000000-0000-4000-a000-000000000072';
  cases text[][] := array[
    -- Événements de O : (instant UTC enregistré par l'app → jour de Paris attendu)
    ['événements', 'postgres', $s$with e as (insert into events(id, name, user_id, date) values
      ('00000000-0000-4000-e000-000000000071', 'Minuit et demie (hiver)', '00000000-0000-4000-a000-000000000071', '2026-10-24T22:30:00Z'),
      ('00000000-0000-4000-e000-000000000072', 'Minuit et demie (été)', '00000000-0000-4000-a000-000000000071', '2027-03-27T23:30:00Z'),
      ('00000000-0000-4000-e000-000000000073', '31 octobre 23:30', '00000000-0000-4000-a000-000000000071', '2026-10-31T22:30:00Z'),
      ('00000000-0000-4000-e000-000000000074', '1er décembre 00:30', '00000000-0000-4000-a000-000000000071', '2026-11-30T23:30:00Z'),
      ('00000000-0000-4000-e000-000000000075', 'Veille changement été 20:00', '00000000-0000-4000-a000-000000000071', '2027-03-27T19:00:00Z'),
      ('00000000-0000-4000-e000-000000000076', 'Jour changement été 20:00', '00000000-0000-4000-a000-000000000071', '2027-03-28T18:00:00Z')
      returning 1) select count(*) from e$s$, '6'],
    ['G invité (rsvp) sur deux événements', 'postgres', $s$with r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', '00000000-0000-4000-a000-000000000072', 'going'), ('00000000-0000-4000-e000-000000000072', '00000000-0000-4000-a000-000000000072', 'going') returning 1) select count(*) from r$s$, '2'],

    -- Points du calendrier
    ['O octobre 2026 : 25 (00:30) et 31 (23:30)', 'O', $s$select string_agg(event_date::text || ' ' || dot_type, ',' order by event_date) from get_calendar_dots('2026-10-01', '2026-10-31')$s$, '2026-10-25 own,2026-10-31 own'],
    ['O novembre 2026 : rien (le 1er décembre 00:30 n''est pas le 30/11)', 'O', $s$select count(*) from get_calendar_dots('2026-11-01', '2026-11-30')$s$, '0'],
    ['O décembre 2026 : le 1er', 'O', $s$select string_agg(event_date::text, ',') from get_calendar_dots('2026-12-01', '2026-12-31')$s$, '2026-12-01'],
    ['O mars 2027 : 27 (20:00) et 28 (00:30 et 20:00)', 'O', $s$select string_agg(event_date::text, ',' order by event_date) from get_calendar_dots('2027-03-01', '2027-03-31')$s$, '2027-03-27,2027-03-28,2027-03-28'],
    ['G : points « invited » sur le jour de Paris', 'G', $s$select string_agg(event_date::text || ' ' || dot_type, ',' order by event_date) from get_calendar_dots('2026-10-01', '2027-03-31')$s$, '2026-10-25 invited,2027-03-28 invited'],
    ['anon ne peut pas appeler get_calendar_dots', 'anon', $s$select count(*) from get_calendar_dots('2026-10-01', '2026-10-31')$s$, 'ERR 42501'],

    -- Heure affichée en Paris : 20:00 des deux côtés du changement d'heure
    ['20:00 veille / jour du changement d''heure', 'postgres', $s$select string_agg(to_char(date at time zone 'Europe/Paris', 'DD/MM HH24:MI'), ',' order by date) from events where id in ('00000000-0000-4000-e000-000000000075', '00000000-0000-4000-e000-000000000076')$s$, '27/03 20:00,28/03 20:00'],

    -- Ancien comportement : chaîne sans fuseau lue en UTC (session Supabase)
    ['ancien envoi « 2026-10-25T20:00 » → 21:00 à Paris', 'O', $s$with x as (update events set date = '2026-10-25T20:00' where id = '00000000-0000-4000-e000-000000000071' returning to_char(date at time zone 'Europe/Paris', 'HH24:MI')) select * from x$s$, '21:00'],
    ['ancien envoi « 2027-03-28T20:00 » → 22:00 à Paris', 'O', $s$with x as (update events set date = '2027-03-28T20:00' where id = '00000000-0000-4000-e000-000000000072' returning to_char(date at time zone 'Europe/Paris', 'HH24:MI')) select * from x$s$, '22:00'],
    ['nouvel envoi (ISO UTC de l''app) → 20:00 à Paris', 'O', $s$with x as (update events set date = '2026-10-25T19:00:00.000Z' where id = '00000000-0000-4000-e000-000000000071' returning to_char(date at time zone 'Europe/Paris', 'HH24:MI')) select * from x$s$, '20:00']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-dt-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (G, 'dry-dt-g@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'G' then G end;
    begin
      if who = 'anon' then
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
