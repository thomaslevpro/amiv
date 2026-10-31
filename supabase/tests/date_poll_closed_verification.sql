-- Vérification de 20261102250000 : quand l'organisateur choisit la date, le
-- sondage est clos pour tous les invités (sans réponse, acceptés avec ou sans
-- vote, refusés) : date et poll_closed lisibles, plus de vote possible,
-- rappels « Un sondage attend ta réponse » non lus passés en lus, texte de
-- l'invitation non lue mis à jour, l'invité sans réponse peut toujours
-- accepter. Un autre sondage encore ouvert n'est pas touché.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/date_poll_closed_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000061';
  A uuid := '00000000-0000-4000-a000-000000000062';
  B uuid := '00000000-0000-4000-a000-000000000063';
  C uuid := '00000000-0000-4000-a000-000000000064';
  D uuid := '00000000-0000-4000-a000-000000000065';
  cases text[][] := array[
    -- EV : sondage ouvert (2 dates) ; EV2 : autre sondage ouvert
    ['événements avec sondage', 'postgres', $s$with e as (insert into events(id, name, user_id, poll_closed) values ('00000000-0000-4000-e000-000000000061', 'Dry poll', '00000000-0000-4000-a000-000000000061', false), ('00000000-0000-4000-e000-000000000062', 'Dry poll 2', '00000000-0000-4000-a000-000000000061', false) returning id), o as (insert into event_date_options(id, event_id, proposed_date, proposed_time) select x.id, x.ev, x.d, '20:00' from e, (values ('00000000-0000-4000-f000-000000000061'::uuid, '00000000-0000-4000-e000-000000000061'::uuid, current_date + 10), ('00000000-0000-4000-f000-000000000062'::uuid, '00000000-0000-4000-e000-000000000061'::uuid, current_date + 11), ('00000000-0000-4000-f000-000000000063'::uuid, '00000000-0000-4000-e000-000000000062'::uuid, current_date + 12)) x(id, ev, d) where x.ev = e.id returning 1) select count(*) from o$s$, '3'],
    ['invitations EV (A B C D)', 'postgres', $s$with i as (insert into invitations(event_id, invited_user_id, invited_by, status) select '00000000-0000-4000-e000-000000000061', u, '00000000-0000-4000-a000-000000000061', 'pending' from unnest(array['00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000064', '00000000-0000-4000-a000-000000000065']::uuid[]) u returning 1) select count(*) from i$s$, '4'],
    ['invitation EV2 (A)', 'postgres', $s$with i as (insert into invitations(event_id, invited_user_id, invited_by, status) values ('00000000-0000-4000-e000-000000000062', '00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000061', 'pending') returning 1) select count(*) from i$s$, '1'],
    ['rsvps en attente', 'postgres', $s$with r as (insert into rsvps(event_id, user_id, status) select '00000000-0000-4000-e000-000000000061', u, 'pending' from unnest(array['00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000064', '00000000-0000-4000-a000-000000000065']::uuid[]) u returning 1) select count(*) from r$s$, '4'],
    ['invitations non lues « Vote pour tes disponibilités »', 'postgres', $s$select count(*) from notifications where type = 'event_invitation' and not read and body = 'Vote pour tes disponibilités sur Amiv' and data->>'event_id' = '00000000-0000-4000-e000-000000000061'$s$, '4'],

    -- B accepte sans voter, C accepte et vote, D refuse, A ne répond pas
    ['B accepte', 'B', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000061' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['C accepte', 'C', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000061' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['C vote', 'C', $s$insert into event_date_votes(option_id, user_id, available) values ('00000000-0000-4000-f000-000000000061', '00000000-0000-4000-a000-000000000064', true) returning 1$s$, '1'],
    ['D refuse', 'D', $s$with x as (update rsvps set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000061' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['rappels de sondage non lus (B sur EV, A sur EV2)', 'postgres', $s$with x as (insert into notifications(user_id, type, title, body, data, read) values ('00000000-0000-4000-a000-000000000063', 'poll_reminder', 'Un sondage attend ta réponse : Dry poll', 'x', '{"event_id":"00000000-0000-4000-e000-000000000061"}', false), ('00000000-0000-4000-a000-000000000062', 'poll_reminder', 'Un sondage attend ta réponse : Dry poll 2', 'x', '{"event_id":"00000000-0000-4000-e000-000000000062"}', false) returning 1) select count(*) from x$s$, '2'],
    ['A (sans réponse) voit le sondage ouvert', 'A', $s$select poll_closed::text || ',' || coalesce(date::text, 'null') from events where id = '00000000-0000-4000-e000-000000000061'$s$, 'false,null'],

    -- L'organisateur choisit la date (même requête que l'app)
    ['un invité ne peut pas clore le sondage', 'B', $s$with x as (update events set poll_closed = true where id = '00000000-0000-4000-e000-000000000061' returning 1) select count(*) from x$s$, '0'],
    ['O choisit la date', 'O', $s$with x as (update events set date = (current_date + 10) + time '19:00', poll_closed = true where id = '00000000-0000-4000-e000-000000000061' returning 1) select count(*) from x$s$, '1'],

    -- Tout le monde lit la date fixée
    ['A (sans réponse) lit la date fixée', 'A', $s$select poll_closed::text || ',' || (date is not null)::text from events where id = '00000000-0000-4000-e000-000000000061'$s$, 'true,true'],
    ['B (accepté sans vote) lit la date fixée', 'B', $s$select poll_closed::text || ',' || (date is not null)::text from events where id = '00000000-0000-4000-e000-000000000061'$s$, 'true,true'],
    ['C (a voté) lit la date fixée', 'C', $s$select poll_closed::text || ',' || (date is not null)::text from events where id = '00000000-0000-4000-e000-000000000061'$s$, 'true,true'],
    ['D (a refusé) lit la date fixée', 'D', $s$select poll_closed::text || ',' || (date is not null)::text from events where id = '00000000-0000-4000-e000-000000000061'$s$, 'true,true'],

    -- Notifications
    ['B : rappel de sondage passé en lu', 'postgres', $s$select read::text from notifications where type = 'poll_reminder' and user_id = '00000000-0000-4000-a000-000000000063'$s$, 'true'],
    ['A : rappel de l''autre sondage (ouvert) toujours non lu', 'postgres', $s$select read::text from notifications where type = 'poll_reminder' and user_id = '00000000-0000-4000-a000-000000000062'$s$, 'false'],
    ['A : invitation toujours non lue, nouveau texte', 'postgres', $s$select read::text || ',' || body from notifications where type = 'event_invitation' and user_id = '00000000-0000-4000-a000-000000000062' and data->>'event_id' = '00000000-0000-4000-e000-000000000061'$s$, 'false,Réponds à l’invitation sur Amiv'],
    ['A : invitation EV2 inchangée', 'postgres', $s$select body from notifications where type = 'event_invitation' and user_id = '00000000-0000-4000-a000-000000000062' and data->>'event_id' = '00000000-0000-4000-e000-000000000062'$s$, 'Vote pour tes disponibilités sur Amiv'],
    ['D : plus rien de non lu sur EV', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000065' and not read and data->>'event_id' = '00000000-0000-4000-e000-000000000061'$s$, '0'],
    ['plus aucun texte « Vote pour tes disponibilités » non lu sur EV', 'postgres', $s$select count(*) from notifications where not read and body = 'Vote pour tes disponibilités sur Amiv' and data->>'event_id' = '00000000-0000-4000-e000-000000000061'$s$, '0'],

    -- Plus de vote, et pas de rappel après coup
    ['A ne peut plus voter', 'A', $s$insert into event_date_votes(option_id, user_id, available) values ('00000000-0000-4000-f000-000000000062', '00000000-0000-4000-a000-000000000062', true) returning 1$s$, 'ERR 42501'],
    ['C ne peut plus changer son vote', 'C', $s$with x as (update event_date_votes set available = false where user_id = auth.uid() returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['A peut encore voter sur EV2 (ouvert)', 'A', $s$insert into event_date_votes(option_id, user_id, available) values ('00000000-0000-4000-f000-000000000063', '00000000-0000-4000-a000-000000000062', true) returning 1$s$, '1'],
    ['25 h passent', 'postgres', $s$with x as (update poll_reminders set accepted_at = now() - interval '25 hours' where event_id = '00000000-0000-4000-e000-000000000061' returning 1) select count(*) from x$s$, '2'],
    ['aucun rappel pour un sondage clos', 'postgres', $s$select count(*) from (select send_poll_reminders()) s, notifications n where n.type = 'poll_reminder' and n.data->>'event_id' = '00000000-0000-4000-e000-000000000061' and not n.read$s$, '0'],

    -- L'invité sans réponse accepte (ou refuse) avec la date fixée
    ['A accepte l''invitation', 'A', $s$with x as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A : rsvp going', 'A', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000061' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A : pas de suivi de sondage (clos)', 'postgres', $s$select count(*) from poll_reminders where event_id = '00000000-0000-4000-e000-000000000061' and user_id = '00000000-0000-4000-a000-000000000062'$s$, '0'],
    ['D change d''avis et revient', 'D', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000061' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],

    -- Le déclencheur ne repasse pas sur une autre modification
    ['rappel remis non lu à la main', 'postgres', $s$with x as (update notifications set read = false where type = 'poll_reminder' and user_id = '00000000-0000-4000-a000-000000000063' returning 1) select count(*) from x$s$, '1'],
    ['O renomme l''événement', 'O', $s$with x as (update events set name = 'Dry poll bis' where id = '00000000-0000-4000-e000-000000000061' returning 1) select count(*) from x$s$, '1'],
    ['rappel non touché par le renommage', 'postgres', $s$select read::text from notifications where type = 'poll_reminder' and user_id = '00000000-0000-4000-a000-000000000063'$s$, 'false'],
    ['A ne peut pas appeler on_date_poll_closed', 'A', 'select public.on_date_poll_closed()', 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-pc-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-pc-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-pc-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-pc-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-pc-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'C' then C when 'D' then D end;
    begin
      if who <> 'postgres' then
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
