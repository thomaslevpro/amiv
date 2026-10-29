-- Vérification de 20261101140000 : une personne qui refuse un événement ne
-- reçoit plus ses notifications (ni push) et ses notifications non lues
-- passent en lues ; une nouvelle acceptation
-- rétablit tout. Rappel de sondage : un seul, 24 h après l'acceptation,
-- seulement si le sondage est ouvert, sans vote et réglage invitations activé.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/declined_events_poll_reminders_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000051';
  A uuid := '00000000-0000-4000-a000-000000000052';
  B uuid := '00000000-0000-4000-a000-000000000053';
  C uuid := '00000000-0000-4000-a000-000000000054';
  D uuid := '00000000-0000-4000-a000-000000000055';
  E uuid := '00000000-0000-4000-a000-000000000056';
  cases text[][] := array[
    -- Événement EV (sondage ouvert, 2 dates) ; A B C D E invités en attente
    ['événement avec sondage', 'postgres', $s$with e as (insert into events(id, name, user_id, poll_closed) values ('00000000-0000-4000-e000-000000000051', 'Dry poll', '00000000-0000-4000-a000-000000000051', false) returning id), o as (insert into event_date_options(id, event_id, proposed_date) select x.id, e.id, x.d from e, (values ('00000000-0000-4000-f000-000000000051'::uuid, current_date + 10), ('00000000-0000-4000-f000-000000000052'::uuid, current_date + 11)) x(id, d) returning 1) select count(*) from o$s$, '2'],
    ['invitations', 'postgres', $s$with i as (insert into invitations(event_id, invited_user_id, invited_by, status) select '00000000-0000-4000-e000-000000000051', u, '00000000-0000-4000-a000-000000000051', 'pending' from unnest(array['00000000-0000-4000-a000-000000000052', '00000000-0000-4000-a000-000000000053', '00000000-0000-4000-a000-000000000054', '00000000-0000-4000-a000-000000000055', '00000000-0000-4000-a000-000000000056']::uuid[]) u returning 1) select count(*) from i$s$, '5'],
    ['rsvps en attente', 'postgres', $s$with r as (insert into rsvps(event_id, user_id, status) select '00000000-0000-4000-e000-000000000051', u, 'pending' from unnest(array['00000000-0000-4000-a000-000000000052', '00000000-0000-4000-a000-000000000053', '00000000-0000-4000-a000-000000000054', '00000000-0000-4000-a000-000000000055', '00000000-0000-4000-a000-000000000056']::uuid[]) u returning 1) select count(*) from r$s$, '5'],
    ['B a une invitation non lue', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000053' and not read and data->>'event_id' = '00000000-0000-4000-e000-000000000051'$s$, '1'],
    ['aucun suivi de sondage avant acceptation', 'postgres', $s$select count(*) from poll_reminders where event_id = '00000000-0000-4000-e000-000000000051'$s$, '0'],

    -- Acceptation
    ['A accepte', 'A', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A : suivi de sondage créé', 'postgres', $s$select count(*) from poll_reminders where event_id = '00000000-0000-4000-e000-000000000051' and user_id = '00000000-0000-4000-a000-000000000052' and reminded_at is null$s$, '1'],
    ['A ne lit pas poll_reminders', 'A', 'select count(*) from poll_reminders', 'ERR 42501'],
    ['A ne peut pas lancer les rappels', 'A', 'select send_poll_reminders()', 'ERR 42501'],
    ['A ne peut pas appeler has_declined_event', 'A', $s$select has_declined_event('00000000-0000-4000-a000-000000000053', '00000000-0000-4000-e000-000000000051')$s$, 'ERR 42501'],
    ['D accepte', 'D', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['E accepte', 'E', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['C répond peut-être', 'C', $s$with x as (update rsvps set status = 'pending' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],

    -- Refus
    ['B refuse', 'B', $s$with x as (update rsvps set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['B : invitation passée en lue', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000053' and not read and data->>'event_id' = '00000000-0000-4000-e000-000000000051'$s$, '0'],
    ['B a refusé', 'postgres', $s$select has_declined_event('00000000-0000-4000-a000-000000000053', '00000000-0000-4000-e000-000000000051')$s$, 'true'],
    ['C (peut-être) n''a pas refusé', 'postgres', $s$select has_declined_event('00000000-0000-4000-a000-000000000054', '00000000-0000-4000-e000-000000000051')$s$, 'false'],
    ['l''organisateur n''a jamais refusé', 'postgres', $s$select has_declined_event('00000000-0000-4000-a000-000000000051', '00000000-0000-4000-e000-000000000051')$s$, 'false'],
    ['O écrit dans le chat général', 'postgres', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000051', '00000000-0000-4000-a000-000000000051', 'Coucou', false) returning 1$s$, '1'],
    ['message : B et C (peut-être, depuis 20261101180000) rien, A D E notifiés', 'postgres', $s$select string_agg(right(user_id::text, 2), ',' order by user_id) from notifications where type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000051'$s$, '52,55,56'],
    ['autre notif d''événement pour B -> bloquée', 'postgres', $s$with x as (insert into notifications(user_id, type, title, data) values ('00000000-0000-4000-a000-000000000053', 'invitation_reminder', 'Test', '{"event_id":"00000000-0000-4000-e000-000000000051"}') returning 1) select count(*) from x$s$, '0'],
    ['notif hors événement pour B -> créée', 'postgres', $s$with x as (insert into notifications(user_id, type, title) values ('00000000-0000-4000-a000-000000000053', 'friend_accepted', 'Test') returning 1) select count(*) from x$s$, '1'],
    ['event_id invalide -> créée', 'postgres', $s$with x as (insert into notifications(user_id, type, title, data) values ('00000000-0000-4000-a000-000000000053', 'event_updated', 'Test', '{"event_id":"pas-un-uuid"}') returning 1) select count(*) from x$s$, '1'],
    ['B : pas de suivi de sondage', 'postgres', $s$select count(*) from poll_reminders where user_id = '00000000-0000-4000-a000-000000000053'$s$, '0'],
    ['B change d''avis et accepte', 'B', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['B de nouveau notifié', 'postgres', $s$with x as (insert into notifications(user_id, type, title, data) values ('00000000-0000-4000-a000-000000000053', 'invitation_reminder', 'Test', '{"event_id":"00000000-0000-4000-e000-000000000051"}') returning 1) select count(*) from x$s$, '1'],

    -- Rappel de sondage
    ['D coupe « Nouvelles invitations »', 'D', $s$with x as (update profiles set notif_invitations = false where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['E vote (indisponible)', 'E', $s$insert into event_date_votes(option_id, user_id, available) values ('00000000-0000-4000-f000-000000000051', '00000000-0000-4000-a000-000000000056', false) returning 1$s$, '1'],
    ['avant 24 h : aucun rappel', 'postgres', 'select send_poll_reminders()', '0'],
    ['25 h passent', 'postgres', $s$with x as (update poll_reminders set accepted_at = now() - interval '25 hours' where event_id = '00000000-0000-4000-e000-000000000051' returning 1) select count(*) from x$s$, '4'],
    ['rappels envoyés à A et B', 'postgres', 'select send_poll_reminders()', '2'],
    ['destinataires du rappel', 'postgres', $s$select string_agg(right(user_id::text, 2), ',' order by user_id) from notifications where type = 'poll_reminder'$s$, '52,53'],
    ['D sans push de rappel', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000055', 'poll_reminder')$s$, 'false'],
    ['A avec push de rappel', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000052', 'poll_reminder')$s$, 'true'],
    ['un seul rappel', 'postgres', 'select send_poll_reminders()', '0'],
    ['A refuse', 'A', $s$with x as (update rsvps set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A réaccepte', 'A', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A : 25 h passent encore', 'postgres', $s$with x as (update poll_reminders set accepted_at = now() - interval '25 hours' where user_id = '00000000-0000-4000-a000-000000000052' returning 1) select count(*) from x$s$, '1'],
    ['toujours un seul rappel pour A', 'postgres', 'select send_poll_reminders()', '0'],

    -- Personne qui n'est plus « going » / sondage clos entre-temps
    ['C accepte', 'C', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['C repasse en peut-être', 'C', $s$with x as (update rsvps set status = 'pending' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['C : 25 h passent', 'postgres', $s$with x as (update poll_reminders set accepted_at = now() - interval '25 hours' where user_id = '00000000-0000-4000-a000-000000000054' returning 1) select count(*) from x$s$, '1'],
    ['C plus going : aucun rappel', 'postgres', 'select send_poll_reminders()', '0'],
    ['C : suivi conservé', 'postgres', $s$select count(*) from poll_reminders where user_id = '00000000-0000-4000-a000-000000000054' and reminded_at is null$s$, '1'],
    ['C réaccepte', 'C', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['sondage clos', 'postgres', $s$with x as (update events set poll_closed = true where id = '00000000-0000-4000-e000-000000000051' returning 1) select count(*) from x$s$, '1'],
    ['C : 25 h passent à nouveau', 'postgres', $s$with x as (update poll_reminders set accepted_at = now() - interval '25 hours' where user_id = '00000000-0000-4000-a000-000000000054' returning 1) select count(*) from x$s$, '1'],
    ['sondage clos : aucun rappel', 'postgres', 'select send_poll_reminders()', '0'],
    ['C : suivi traité', 'postgres', $s$select count(*) from poll_reminders where user_id = '00000000-0000-4000-a000-000000000054' and reminded_at is not null$s$, '1'],
    ['E repasse en attente (suivi effacé)', 'postgres', $s$with x as (delete from poll_reminders where user_id = '00000000-0000-4000-a000-000000000056' returning 1), y as (update rsvps set status = 'pending' where user_id = '00000000-0000-4000-a000-000000000056' returning 1) select count(*) from x, y$s$, '1'],
    ['E accepte un sondage clos', 'E', $s$with x as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000051' and user_id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['E : aucun suivi créé', 'postgres', $s$select count(*) from poll_reminders where user_id = '00000000-0000-4000-a000-000000000056'$s$, '0'],
    ['tâche planifiée active', 'postgres', $s$select schedule || ':' || active from cron.job where jobname = 'poll-reminders'$s$, '*/15 * * * *:true']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-pr-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-pr-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-pr-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-pr-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-pr-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-pr-e@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'A' then A when 'B' then B when 'C' then C when 'D' then D when 'E' then E end;
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
