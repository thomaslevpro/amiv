-- Vérification de 20261101210000 : « Comment me payer » de la cagnotte.
-- Coordinateur (dont guest_leader) seul à écrire ses coordonnées, lecture par
-- l'espace secret uniquement (jamais la personne fêtée), montants individuels
-- réservés à soi et aux coordinateurs, « Reçu » par les coordinateurs, message
-- système sans coordonnées, rappel unique 2 jours avant la date limite,
-- suppression 30 jours après l'événement et avec le compte du coordinateur.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/cagnotte_payment_info_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000091';
  G uuid := '00000000-0000-4000-a000-000000000092';
  A uuid := '00000000-0000-4000-a000-000000000093';
  B uuid := '00000000-0000-4000-a000-000000000094';
  P uuid := '00000000-0000-4000-a000-000000000095';
  M uuid := '00000000-0000-4000-a000-000000000096';
  X uuid := '00000000-0000-4000-a000-000000000097';
  cases text[][] := array[
    ['prénoms', 'postgres', $s$with u as (update profiles set first_name = case id when '00000000-0000-4000-a000-000000000091' then 'Olga' when '00000000-0000-4000-a000-000000000092' then 'Gaby' when '00000000-0000-4000-a000-000000000093' then 'Ali' when '00000000-0000-4000-a000-000000000094' then 'Bea' when '00000000-0000-4000-a000-000000000095' then 'Toto' else 'Max' end where id::text like '00000000-0000-4000-a000-00000000009%' returning 1) select count(*) from u$s$, '7'],
    ['anniversaire de Toto', 'postgres', $s$with e as (insert into events(id, name, type, user_id, birthday_person_user_id, date) values ('00000000-0000-4000-e000-000000000091', 'Anniv Toto', 'Anniversaire', '00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000095', now() + interval '5 days') returning 1) select count(*) from e$s$, '1'],
    ['O invite G A B P M', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000091', array['00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093', '00000000-0000-4000-a000-000000000094', '00000000-0000-4000-a000-000000000095', '00000000-0000-4000-a000-000000000096']::uuid[])) x$s$, '1'],
    ['G A B P acceptent', 'postgres', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000091' and invited_user_id in ('00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093', '00000000-0000-4000-a000-000000000094', '00000000-0000-4000-a000-000000000095') returning 1) select count(*) from i$s$, '4'],
    ['G coordinateur approuvé', 'postgres', $s$insert into event_organizers(event_id, user_id, role, status) values ('00000000-0000-4000-e000-000000000091', '00000000-0000-4000-a000-000000000092', 'guest_leader', 'approved') returning 1$s$, '1'],
    ['A n''est pas coordinateur', 'A', $s$select public.can_manage_cagnotte('00000000-0000-4000-e000-000000000091')::text$s$, 'false'],
    ['G est coordinateur', 'G', $s$select public.can_manage_cagnotte('00000000-0000-4000-e000-000000000091')::text$s$, 'true'],
    ['P (fêtée) n''est jamais coordinatrice', 'P', $s$select public.can_manage_cagnotte('00000000-0000-4000-e000-000000000091')::text$s$, 'false'],
    ['A ne peut pas créer la cagnotte', 'A', $s$insert into event_cagnottes(event_id, goal) values ('00000000-0000-4000-e000-000000000091', 150) returning 1$s$, 'ERR 42501'],
    ['G crée la cagnotte sans lien', 'G', $s$insert into event_cagnottes(event_id, goal) values ('00000000-0000-4000-e000-000000000091', 150) returning 1$s$, '1'],
    ['A ne peut pas écrire d''infos de paiement', 'A', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"wero","value":"+33 6 12 34 56 78"},{"type":"virement","value":"FR76 3000 6000 0112 3456 7890 189","holder":"Gaby Martin"},{"type":"especes"},{"type":"paypal","value":"https://paypal.me/gabym"}]') returning 1$s$, 'ERR 42501'],
    ['IBAN invalide refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"virement","value":"FR76 12","holder":"Gaby"}]') returning 1$s$, 'ERR 23514'],
    ['virement sans titulaire refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"virement","value":"FR7630006000011234567890189"}]') returning 1$s$, 'ERR 23514'],
    ['lien PayPal hors paypal.me refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"paypal","value":"https://evil.example/x"}]') returning 1$s$, 'ERR 23514'],
    ['lien Lydia hors lydia refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"lydia","value":"javascript:alert(1)"}]') returning 1$s$, 'ERR 23514'],
    ['moyen en double refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"especes"},{"type":"especes"}]') returning 1$s$, 'ERR 23514'],
    ['clé inconnue refusée', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"especes","x":"1"}]') returning 1$s$, 'ERR 23514'],
    ['aucun moyen refusé', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[]') returning 1$s$, 'ERR 23514'],
    ['G ne peut pas choisir le destinataire', 'G', $s$insert into event_cagnotte_payment_info(event_id, recipient_id, methods) values ('00000000-0000-4000-e000-000000000091', '00000000-0000-4000-a000-000000000093', '[{"type":"wero","value":"+33 6 12 34 56 78"},{"type":"virement","value":"FR76 3000 6000 0112 3456 7890 189","holder":"Gaby Martin"},{"type":"especes"},{"type":"paypal","value":"https://paypal.me/gabym"}]') returning 1$s$, 'ERR 42501'],
    ['G ajoute ses infos', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods, split_goal, message) values ('00000000-0000-4000-e000-000000000091', '[{"type":"wero","value":"+33 6 12 34 56 78"},{"type":"virement","value":"FR76 3000 6000 0112 3456 7890 189","holder":"Gaby Martin"},{"type":"especes"},{"type":"paypal","value":"https://paypal.me/gabym"}]', true, 'Merci avant le 15 !') returning recipient_id::text$s$, '00000000-0000-4000-a000-000000000092'],
    ['message système sans coordonnées', 'postgres', $s$select content || '|' || (content ~ '[0-9]')::text || '|' || (system_data->>'tab') from messages where event_id = '00000000-0000-4000-e000-000000000091' and system_type = 'cagnotte_payment_added'$s$, 'Gaby a ajouté les infos pour participer à la cagnotte|false|cagnotte'],
    ['aucune notification de message', 'postgres', $s$select count(*) from notifications where data->>'event_id' = '00000000-0000-4000-e000-000000000091' and type = 'message_received'$s$, '0'],
    ['A lit les infos', 'A', $s$select jsonb_array_length(methods) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091'$s$, '4'],
    ['P (fêtée) ne lit rien', 'P', $s$select (select count(*) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091') + (select count(*) from event_cagnottes where event_id = '00000000-0000-4000-e000-000000000091') + (select count(*) from get_event_messages('00000000-0000-4000-e000-000000000091', true))$s$, '0'],
    ['M en attente ne lit rien', 'M', $s$select count(*) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['X étranger ne lit rien', 'X', $s$select count(*) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['A ne peut pas modifier', 'A', $s$with u as (update event_cagnotte_payment_info set message = 'x' where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '0'],
    ['O organisateur ne modifie pas les coordonnées de G', 'O', $s$with u as (update event_cagnotte_payment_info set message = 'x' where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '0'],
    ['G ne change pas de destinataire', 'G', $s$update event_cagnotte_payment_info set recipient_id = '00000000-0000-4000-a000-000000000093' where event_id = '00000000-0000-4000-e000-000000000091' returning 1$s$, 'ERR 42501'],
    ['G modifie son message', 'G', $s$with u as (update event_cagnotte_payment_info set message = 'Merci !' where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '1'],
    ['A déclare 30 € par Wero', 'A', $s$insert into cagnotte_contributions(event_id, user_id, amount, method) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 30, 'wero') returning 1$s$, '1'],
    ['message de participation sans montant', 'postgres', $s$select content from messages where event_id = '00000000-0000-4000-e000-000000000091' and system_type = 'cagnotte_joined'$s$, 'Ali a participé à la cagnotte'],
    ['A ne se déclare pas reçu', 'A', $s$update cagnotte_contributions set received = true where event_id = '00000000-0000-4000-e000-000000000091' and user_id = auth.uid() returning 1$s$, 'ERR 42501'],
    ['A ne déclare pas pour B', 'A', $s$insert into cagnotte_contributions(event_id, user_id, amount) values ('00000000-0000-4000-e000-000000000091', '00000000-0000-4000-a000-000000000094', 10) returning 1$s$, 'ERR 42501'],
    ['moyen inconnu refusé', 'B', $s$insert into cagnotte_contributions(event_id, user_id, amount, method) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 20, 'bitcoin') returning 1$s$, 'ERR 23514'],
    ['montant négatif refusé', 'B', $s$insert into cagnotte_contributions(event_id, user_id, amount, method) values ('00000000-0000-4000-e000-000000000091', auth.uid(), -5, 'especes') returning 1$s$, 'ERR 23514'],
    ['B déclare 20 € en espèces', 'B', $s$insert into cagnotte_contributions(event_id, user_id, amount, method) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 20, 'especes') returning 1$s$, '1'],
    ['B ne voit que sa déclaration', 'B', $s$select count(*) from cagnotte_contributions where event_id = '00000000-0000-4000-e000-000000000091'$s$, '1'],
    ['B ne voit pas le montant de A', 'B', $s$select count(*) from cagnotte_contributions where event_id = '00000000-0000-4000-e000-000000000091' and user_id = '00000000-0000-4000-a000-000000000093'$s$, '0'],
    ['B voit le total et le nombre', 'B', $s$select participants || '|' || total from get_cagnotte_summary('00000000-0000-4000-e000-000000000091')$s$, '2|50'],
    ['P (fêtée) : total vide', 'P', $s$select participants || '|' || total from get_cagnotte_summary('00000000-0000-4000-e000-000000000091')$s$, '0|0'],
    ['P ne peut pas déclarer', 'P', $s$insert into cagnotte_contributions(event_id, user_id, amount) values ('00000000-0000-4000-e000-000000000091', auth.uid(), 5) returning 1$s$, 'ERR 42501'],
    ['G voit toutes les déclarations', 'G', $s$select count(*) || '|' || sum(amount) from cagnotte_contributions where event_id = '00000000-0000-4000-e000-000000000091'$s$, '2|50'],
    ['G coche « Reçu » pour A', 'G', $s$with u as (update cagnotte_contributions set received = true where event_id = '00000000-0000-4000-e000-000000000091' and user_id = '00000000-0000-4000-a000-000000000093' returning received, received_at) select received::text || '|' || (received_at is not null)::text from u$s$, 'true|true'],
    ['A modifie son montant : plus reçu', 'A', $s$with u as (update cagnotte_contributions set amount = 35 where event_id = '00000000-0000-4000-e000-000000000091' and user_id = auth.uid() returning received, received_at) select received::text || '|' || (received_at is null)::text from u$s$, 'false|true'],
    ['rappel : date limite demain', 'G', $s$with u as (update event_cagnotte_payment_info set deadline = (now() at time zone 'Europe/Paris')::date + 1 where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '1'],
    ['A ne lance pas les rappels', 'A', $s$select public.send_cagnotte_reminders()$s$, 'ERR 42501'],
    ['envoi des rappels', 'postgres', $s$select (public.send_cagnotte_reminders() >= 1)::text$s$, 'true'],
    ['rappel : seule O (sans déclaration, ni fêtée, ni coordinateur, ni en attente)', 'postgres', $s$select string_agg(p.first_name, ',' order by p.first_name) from notifications n join profiles p on p.id = n.user_id where n.type = 'cagnotte_reminder' and n.data->>'event_id' = '00000000-0000-4000-e000-000000000091'$s$, 'Olga'],
    ['rappel sans montant ni coordonnées', 'postgres', $s$select title || '|' || body from notifications where type = 'cagnotte_reminder' and data->>'event_id' = '00000000-0000-4000-e000-000000000091'$s$, 'Cagnotte : plus que 2 jours 🎁|Pense à participer au cadeau commun pour l’anniversaire de Toto'],
    ['rappel une seule fois', 'postgres', $s$select public.send_cagnotte_reminders()::text$s$, '0'],
    ['P (fêtée) : aucune notification', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000095' and data->>'event_id' = '00000000-0000-4000-e000-000000000091' and type not in ('event_invitation', 'invitation_received')$s$, '0'],
    ['nouvelle date limite : rappel réarmé', 'G', $s$with u as (update event_cagnotte_payment_info set deadline = (now() at time zone 'Europe/Paris')::date + 10 where event_id = '00000000-0000-4000-e000-000000000091' returning reminded_at) select (reminded_at is null)::text from u$s$, 'true'],
    ['O coupe les rappels de cagnotte', 'O', $s$with u as (update profiles set notif_cagnotte = false where id = auth.uid() returning 1) select count(*) from u$s$, '1'],
    ['push rappel suit notif_cagnotte', 'postgres', $s$select public.push_allowed('00000000-0000-4000-a000-000000000091', 'cagnotte_reminder')::text$s$, 'false'],
    ['O organisateur retire les infos de G', 'O', $s$with d as (delete from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from d$s$, '1'],
    ['message système retiré avec les infos', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000091' and system_type = 'cagnotte_payment_added'$s$, '0'],
    ['G remet ses infos', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"wero","value":"+33 6 12 34 56 78"},{"type":"virement","value":"FR76 3000 6000 0112 3456 7890 189","holder":"Gaby Martin"},{"type":"especes"},{"type":"paypal","value":"https://paypal.me/gabym"}]') returning 1$s$, '1'],
    ['événement passé de 31 jours', 'postgres', $s$with u as (update events set date = now() - interval '31 days' where id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '1'],
    ['nettoyage automatique', 'postgres', $s$select (public.run_data_retention()->>'cagnotte_payment_info')::int >= 1$s$, 'true'],
    ['infos supprimées après 30 jours', 'postgres', $s$select count(*) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['G remet ses infos (2)', 'G', $s$insert into event_cagnotte_payment_info(event_id, methods) values ('00000000-0000-4000-e000-000000000091', '[{"type":"especes"}]') returning 1$s$, '1'],
    ['compte de G supprimé', 'postgres', $s$with d as (delete from auth.users where id = '00000000-0000-4000-a000-000000000092' returning 1) select count(*) from d$s$, '1'],
    ['infos supprimées avec le compte', 'postgres', $s$select count(*) from event_cagnotte_payment_info where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['RPC total fermé à anon', 'anon', $s$select count(*) from get_cagnotte_summary('00000000-0000-4000-e000-000000000091')$s$, 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-cp-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (G, 'dry-cp-g@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-cp-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-cp-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (P, 'dry-cp-p@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (M, 'dry-cp-m@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-cp-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'G' then G when 'A' then A when 'B' then B when 'P' then P when 'M' then M when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-cp-' || lower(who) || '@amiv.test')::text, true);
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
