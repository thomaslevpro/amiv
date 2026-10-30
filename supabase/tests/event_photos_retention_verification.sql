-- Vérification de 20261101230000 : durée de conservation de l'album photo.
-- Avertissement 1 mois après l'événement (personnes qui voient l'album,
-- une seule fois, seulement s'il y a des photos), suppression 2 mois après
-- l'événement et au moins 30 jours après l'avertissement, fichiers mis en
-- file d'effacement, album fermé ensuite, événements sans date conservés.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_photos_retention_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users et de fausses lignes dans storage.objects : à lancer sur
-- staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-0000000000b1';
  A uuid := '00000000-0000-4000-a000-0000000000b2';
  M uuid := '00000000-0000-4000-a000-0000000000b3';
  cases text[][] := array[
    ['prénoms', 'postgres', $s$with u as (update profiles set first_name = case id when '00000000-0000-4000-a000-0000000000b1' then 'Olga' when '00000000-0000-4000-a000-0000000000b2' then 'Ali' else 'Max' end where id in ('00000000-0000-4000-a000-0000000000b1', '00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000b3') returning 1) select count(*) from u$s$, '3'],
    ['événement d''il y a 40 jours', 'postgres', $s$with e as (insert into events(id, name, type, user_id, date) values ('00000000-0000-4000-e000-0000000000b1', 'Soirée photos', 'Soirée', '00000000-0000-4000-a000-0000000000b1', now() - interval '40 days'), ('00000000-0000-4000-e000-0000000000b2', 'Date à choisir', 'Soirée', '00000000-0000-4000-a000-0000000000b1', null), ('00000000-0000-4000-e000-0000000000b3', 'Sans photo', 'Soirée', '00000000-0000-4000-a000-0000000000b1', now() - interval '40 days') returning 1) select count(*) from e$s$, '3'],
    ['A accepte, M peut-être', 'postgres', $s$with i as (insert into invitations(event_id, invited_user_id, status) values ('00000000-0000-4000-e000-0000000000b1', '00000000-0000-4000-a000-0000000000b2', 'accepted'), ('00000000-0000-4000-e000-0000000000b1', '00000000-0000-4000-a000-0000000000b3', 'maybe') returning 1) select count(*) from i$s$, '2'],
    ['A ajoute une photo', 'A', $s$with i as (insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000b1') returning 1) select count(*) from i$s$, '1'],
    ['A envoie ses fichiers', 'A', $s$with x as (insert into storage.objects(bucket_id, name, owner_id) select 'event-photos', unnest(array[path, thumb_path]), auth.uid()::text from event_photos where user_id = auth.uid() returning 1) select count(*) from x$s$, '2'],
    ['O ajoute une photo sans date', 'O', $s$with i as (insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000b2') returning 1) select count(*) from i$s$, '1'],
    ['date de suppression affichée', 'A', $s$select (public.get_event_photos('00000000-0000-4000-e000-0000000000b1')->>'expires_at' is not null)::text$s$, 'true'],
    ['pas de date sans date d''événement', 'O', $s$select coalesce(public.get_event_photos('00000000-0000-4000-e000-0000000000b2')->>'expires_at', 'null')$s$, 'null'],
    ['A ne lance pas les avertissements', 'A', $s$select public.send_event_photos_expiry_warnings()$s$, 'ERR 42501'],
    ['avertissement envoyé', 'postgres', $s$select public.send_event_photos_expiry_warnings()::text$s$, '1'],
    ['seul l''album avec photos et date est averti', 'postgres', $s$select string_agg(e.name, ',') from event_photos_expiry_warnings w join events e on e.id = w.event_id where w.event_id in ('00000000-0000-4000-e000-0000000000b1', '00000000-0000-4000-e000-0000000000b2', '00000000-0000-4000-e000-0000000000b3')$s$, 'Soirée photos'],
    ['avertis : O et A, pas M', 'postgres', $s$select string_agg(p.first_name, ',' order by p.first_name) from notifications n join profiles p on p.id = n.user_id where n.type = 'event_photos_expiring' and n.data->>'event_id' = '00000000-0000-4000-e000-0000000000b1'$s$, 'Ali,Olga'],
    ['texte de l''avertissement', 'postgres', $s$select distinct (title = 'Photos bientôt supprimées 📸' and body like 'Les photos de « Soirée photos » seront supprimées le __/__/____. Pense à enregistrer celles que tu veux garder.')::text from notifications where type = 'event_photos_expiring' and data->>'event_id' = '00000000-0000-4000-e000-0000000000b1'$s$, 'true'],
    ['une seule fois', 'postgres', $s$select public.send_event_photos_expiry_warnings()::text$s$, '0'],
    ['suppression au moins 30 jours après l''avertissement', 'postgres', $s$select (public.event_photos_expires_at('00000000-0000-4000-e000-0000000000b1') >= now() + interval '29 days')::text$s$, 'true'],
    ['nuit suivante : rien supprimé', 'postgres', $s$select public.run_data_retention()->>'event_photos'$s$, '0'],
    ['avertissement il y a 31 jours, événement il y a 40 jours', 'postgres', $s$with u as (update event_photos_expiry_warnings set warned_at = now() - interval '31 days' where event_id = '00000000-0000-4000-e000-0000000000b1' returning 1) select count(*) from u$s$, '1'],
    ['pas avant 2 mois après l''événement', 'postgres', $s$select public.run_data_retention()->>'event_photos'$s$, '0'],
    ['événement il y a 70 jours', 'postgres', $s$with u as (update events set date = now() - interval '70 days' where id = '00000000-0000-4000-e000-0000000000b1' returning 1) select count(*) from u$s$, '1'],
    ['nettoyage : photo supprimée', 'postgres', $s$select public.run_data_retention()->>'event_photos'$s$, '1'],
    ['fichiers en file d''effacement', 'postgres', $s$select count(*) from storage_deletion_queue where name like '00000000-0000-4000-e000-0000000000b1/%'$s$, '2'],
    ['album fermé : A ne peut plus ajouter', 'A', $s$insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000b1') returning 1$s$, 'ERR 23514'],
    ['événement sans date : photo conservée', 'postgres', $s$select count(*) from event_photos where event_id = '00000000-0000-4000-e000-0000000000b2'$s$, '1'],
    ['push de l''avertissement suit notif_photos', 'postgres', $s$with u as (update profiles set notif_photos = false where id = '00000000-0000-4000-a000-0000000000b2' returning 1) select count(*) from u$s$, '1'],
    ['push de l''avertissement coupé', 'postgres', $s$select public.push_allowed('00000000-0000-4000-a000-0000000000b2', 'event_photos_expiring')::text$s$, 'false']
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
    (M, 'dry-pr-m@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'M' then M end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-pr-' || lower(who) || '@amiv.test')::text, true);
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
