-- Vérification de 20261101220000 : album photo partagé d'un événement.
-- Accès (organisateurs et participants ayant accepté, personne fêtée dès
-- qu'elle a accepté ; ni en attente, ni peut-être, ni refusé, ni étranger),
-- blocages, limite de 10 photos par personne, chemins fixés par la base,
-- policies du bucket, notification groupée, signalement, suppression (auteur
-- ou organisateur) et file d'effacement des fichiers (photo, compte,
-- événement, envois abandonnés).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_photos_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées (y compris les appels pg_net).
-- Il insère de faux comptes dans auth.users et de fausses lignes dans
-- storage.objects : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-0000000000a1';
  C uuid := '00000000-0000-4000-a000-0000000000a2';
  A uuid := '00000000-0000-4000-a000-0000000000a3';
  B uuid := '00000000-0000-4000-a000-0000000000a4';
  P uuid := '00000000-0000-4000-a000-0000000000a5';
  M uuid := '00000000-0000-4000-a000-0000000000a6';
  D uuid := '00000000-0000-4000-a000-0000000000a7';
  W uuid := '00000000-0000-4000-a000-0000000000a8';
  X uuid := '00000000-0000-4000-a000-0000000000a9';
  cases text[][] := array[
    ['prénoms', 'postgres', $s$with u as (update profiles set first_name = case id when '00000000-0000-4000-a000-0000000000a1' then 'Olga' when '00000000-0000-4000-a000-0000000000a2' then 'Cleo' when '00000000-0000-4000-a000-0000000000a3' then 'Ali' when '00000000-0000-4000-a000-0000000000a4' then 'Bea' when '00000000-0000-4000-a000-0000000000a5' then 'Toto' else 'Max' end where id::text like '00000000-0000-4000-a000-0000000000a%' returning 1) select count(*) from u$s$, '9'],
    ['événement de O, fête de Toto', 'postgres', $s$with e as (insert into events(id, name, type, user_id, birthday_person_user_id, date) values ('00000000-0000-4000-e000-0000000000a1', 'Anniv Toto', 'Anniversaire', '00000000-0000-4000-a000-0000000000a1', '00000000-0000-4000-a000-0000000000a5', now() + interval '5 days') returning 1) select count(*) from e$s$, '1'],
    ['O invite C A B P M D W', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-0000000000a1', array['00000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-a000-0000000000a3', '00000000-0000-4000-a000-0000000000a4', '00000000-0000-4000-a000-0000000000a5', '00000000-0000-4000-a000-0000000000a6', '00000000-0000-4000-a000-0000000000a7', '00000000-0000-4000-a000-0000000000a8']::uuid[])) x$s$, '1'],
    ['A B acceptent, M peut-être, D refuse', 'postgres', $s$with i as (update invitations set status = case invited_user_id when '00000000-0000-4000-a000-0000000000a6' then 'maybe' when '00000000-0000-4000-a000-0000000000a7' then 'declined' else 'accepted' end where event_id = '00000000-0000-4000-e000-0000000000a1' and invited_user_id in ('00000000-0000-4000-a000-0000000000a3', '00000000-0000-4000-a000-0000000000a4', '00000000-0000-4000-a000-0000000000a6', '00000000-0000-4000-a000-0000000000a7') returning 1) select count(*) from i$s$, '4'],
    ['C co-organisateur approuvé', 'postgres', $s$insert into event_organizers(event_id, user_id, role, status) values ('00000000-0000-4000-e000-0000000000a1', '00000000-0000-4000-a000-0000000000a2', 'co_organizer', 'approved') returning 1$s$, '1'],
    ['O voit l''album', 'O', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'true'],
    ['C voit l''album', 'C', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'true'],
    ['A voit l''album', 'A', $s$select (public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view') || '|' || (public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_manage')$s$, 'true|false'],
    ['P (fêtée, en attente) ne voit pas', 'P', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')::text$s$, '{"can_view": false}'],
    ['M peut-être ne voit pas', 'M', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'false'],
    ['D refusé ne voit pas', 'D', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'false'],
    ['W en attente ne voit pas', 'W', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'false'],
    ['X étranger ne voit pas', 'X', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'can_view'$s$, 'false'],
    ['M ne peut pas ajouter', 'M', $s$insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning 1$s$, 'ERR 42501'],
    ['W ne peut pas ajouter', 'W', $s$insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning 1$s$, 'ERR 42501'],
    ['A ne choisit pas l''auteur', 'A', $s$insert into event_photos(event_id, user_id) values ('00000000-0000-4000-e000-0000000000a1', '00000000-0000-4000-a000-0000000000a4') returning 1$s$, 'ERR 42501'],
    ['A ne choisit pas le chemin', 'A', $s$insert into event_photos(event_id, path, thumb_path) values ('00000000-0000-4000-e000-0000000000a1', 'x', 'y') returning 1$s$, 'ERR 42501'],
    ['A ajoute une photo : chemins fixés', 'A', $s$insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning (path like '00000000-0000-4000-e000-0000000000a1/00000000-0000-4000-a000-0000000000a3/%.jpg' and thumb_path = replace(path, '.jpg', '_thumb.jpg') and user_id = auth.uid())::text$s$, 'true'],
    ['A en ajoute 9 de plus', 'A', $s$with i as (insert into event_photos(event_id) select '00000000-0000-4000-e000-0000000000a1' from generate_series(1, 9) returning 1) select count(*) from i$s$, '9'],
    ['11e photo refusée', 'A', $s$insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning 1$s$, 'ERR 23514'],
    ['compteur 10, aucune photo complète', 'A', $s$select (public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'my_count') || '|' || jsonb_array_length(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos')$s$, '10|0'],
    ['A envoie les fichiers de 3 photos', 'A', $s$with x as (insert into storage.objects(bucket_id, name, owner_id) select 'event-photos', n, auth.uid()::text from (select unnest(array[path, thumb_path]) n from (select path, thumb_path from event_photos where user_id = auth.uid() order by id limit 3) p) q returning 1) select count(*) from x$s$, '6'],
    ['A ne peut pas envoyer un chemin non réservé', 'A', $s$insert into storage.objects(bucket_id, name, owner_id) values ('event-photos', '00000000-0000-4000-e000-0000000000a1/00000000-0000-4000-a000-0000000000a3/autre.jpg', auth.uid()::text) returning 1$s$, 'ERR 42501'],
    ['B ne peut pas écrire sur un chemin de A', 'B', $s$insert into storage.objects(bucket_id, name, owner_id) select 'event-photos', path, auth.uid()::text from event_photos where user_id = '00000000-0000-4000-a000-0000000000a3' order by id desc limit 1 returning 1$s$, 'ERR 42501'],
    ['B voit 3 photos signées Ali', 'B', $s$select jsonb_array_length(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos') || '|' || (public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos'->0->>'author_name')$s$, '3|Ali'],
    ['B lit les 6 fichiers', 'B', $s$select count(*) from storage.objects where bucket_id = 'event-photos' and name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '6'],
    ['M ne lit aucun fichier', 'M', $s$select count(*) from storage.objects where bucket_id = 'event-photos' and name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '0'],
    ['X ne lit aucun fichier', 'X', $s$select count(*) from storage.objects where bucket_id = 'event-photos' and name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '0'],
    ['M ne lit aucune ligne', 'M', $s$select count(*) from event_photos where event_id = '00000000-0000-4000-e000-0000000000a1'$s$, '0'],
    ['A annonce ses photos', 'A', $s$select public.notify_event_photos_added('00000000-0000-4000-e000-0000000000a1')::text$s$, '3'],
    ['notification : O C B seulement', 'postgres', $s$select string_agg(p.first_name, ',' order by p.first_name) from notifications n join profiles p on p.id = n.user_id where n.type = 'event_photos_added' and n.data->>'event_id' = '00000000-0000-4000-e000-0000000000a1'$s$, 'Bea,Cleo,Olga'],
    ['texte de la notification', 'postgres', $s$select distinct title || '|' || body || '|' || (data->>'count') from notifications where type = 'event_photos_added' and data->>'event_id' = '00000000-0000-4000-e000-0000000000a1'$s$, 'Ali a ajouté 3 photos|Anniv Toto|3'],
    ['pas de seconde annonce', 'A', $s$select public.notify_event_photos_added('00000000-0000-4000-e000-0000000000a1')::text$s$, '0'],
    ['P (fêtée) accepte', 'postgres', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-0000000000a1' and invited_user_id = '00000000-0000-4000-a000-0000000000a5' returning 1) select count(*) from i$s$, '1'],
    ['P voit maintenant les photos', 'P', $s$select jsonb_array_length(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos')::text$s$, '3'],
    ['A bloque B', 'A', $s$insert into user_blocks(blocked_id) values ('00000000-0000-4000-a000-0000000000a4') returning 1$s$, '1'],
    ['B ne voit plus les photos de A', 'B', $s$select jsonb_array_length(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos')::text$s$, '0'],
    ['B ne lit plus les fichiers de A', 'B', $s$select count(*) from storage.objects where bucket_id = 'event-photos' and name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '0'],
    ['O voit toujours 3 photos', 'O', $s$select jsonb_array_length(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos')::text$s$, '3'],
    ['B ne trouve pas la photo de A à signaler', 'B', $s$insert into reports(target_type, target_id, reason) select 'event_photo', id, 'spam' from event_photos where user_id = '00000000-0000-4000-a000-0000000000a3' order by id limit 1 returning 1$s$, 'NULL'],
    ['O signale une photo de A', 'O', $s$with r as (insert into reports(target_type, target_id, reason) select 'event_photo', p.id, 'inappropriate' from (select (x->>'id')::uuid id from jsonb_array_elements(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos') x limit 1) p returning 1) select count(*) from r$s$, '1'],
    ['signalement figé', 'postgres', $s$select (reported_user_id = '00000000-0000-4000-a000-0000000000a3')::text || '|' || (event_id = '00000000-0000-4000-e000-0000000000a1')::text || '|' || (content_snapshot like 'event-photos/%')::text from reports where target_type = 'event_photo' and reporter_id = '00000000-0000-4000-a000-0000000000a1'$s$, 'true|true|true'],
    ['A ne peut pas se signaler', 'A', $s$insert into reports(target_type, target_id, reason) select 'event_photo', id, 'spam' from event_photos where user_id = auth.uid() order by id limit 1 returning 1$s$, 'ERR 22023'],
    ['P ne supprime pas la photo de A', 'P', $s$with d as (delete from event_photos where user_id = '00000000-0000-4000-a000-0000000000a3' returning 1) select count(*) from d$s$, '0'],
    ['C co-organisateur supprime une photo de A', 'C', $s$with d as (delete from event_photos where id = (select id from event_photos where user_id = '00000000-0000-4000-a000-0000000000a3' order by id limit 1) returning 1) select count(*) from d$s$, '1'],
    ['ses 2 fichiers en file d''effacement', 'postgres', $s$select count(*) from storage_deletion_queue where bucket_id = 'event-photos' and name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '2'],
    ['appel immédiat à purge-storage', 'postgres', $s$select (count(*) >= 1)::text from net.http_request_queue where url like '%/functions/v1/purge-storage'$s$, 'true'],
    ['fichiers encore présents : restent en file', 'postgres', $s$select (public.confirm_storage_deletions() >= 2)::text || '|' || (select count(*) from storage_deletion_queue where name like '00000000-0000-4000-e000-0000000000a1/%')$s$, 'true|2'],
    ['A supprime une de ses photos', 'A', $s$with d as (delete from event_photos where id = (select id from event_photos where user_id = auth.uid() order by id desc limit 1) returning 1) select count(*) from d$s$, '1'],
    ['place libérée : 8/10', 'A', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->>'my_count'$s$, '8'],
    ['A peut en rajouter', 'A', $s$with i as (insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning 1) select count(*) from i$s$, '1'],
    ['confirmation des effacements', 'postgres', $s$select (public.confirm_storage_deletions() >= 2)::text$s$, 'true'],
    ['fichiers jamais envoyés : retirés de la file', 'postgres', $s$select count(*) from storage_deletion_queue where name like '00000000-0000-4000-e000-0000000000a1/%'$s$, '2'],
    ['B ajoute une photo', 'B', $s$with i as (insert into event_photos(event_id) values ('00000000-0000-4000-e000-0000000000a1') returning 1) select count(*) from i$s$, '1'],
    ['B envoie ses fichiers', 'B', $s$with x as (insert into storage.objects(bucket_id, name, owner_id) select 'event-photos', unnest(array[path, thumb_path]), auth.uid()::text from event_photos where user_id = auth.uid() returning 1) select count(*) from x$s$, '2'],
    ['A ne voit pas la photo de B (blocage)', 'A', $s$select count(*) from jsonb_array_elements(public.get_event_photos('00000000-0000-4000-e000-0000000000a1')->'photos') x where x->>'user_id' = '00000000-0000-4000-a000-0000000000a4'$s$, '0'],
    ['B annonce : ni A (blocage) ni M', 'B', $s$select public.notify_event_photos_added('00000000-0000-4000-e000-0000000000a1')::text$s$, '1'],
    ['destinataires de B', 'postgres', $s$select string_agg(p.first_name, ',' order by p.first_name) from notifications n join profiles p on p.id = n.user_id where n.type = 'event_photos_added' and n.data->>'sender_id' = '00000000-0000-4000-a000-0000000000a4'$s$, 'Cleo,Olga,Toto'],
    ['C coupe le réglage Photos', 'C', $s$with u as (update profiles set notif_photos = false where id = auth.uid() returning 1) select count(*) from u$s$, '1'],
    ['push suit notif_photos', 'postgres', $s$select public.push_allowed('00000000-0000-4000-a000-0000000000a2', 'event_photos_added')::text || '|' || public.push_allowed('00000000-0000-4000-a000-0000000000a1', 'event_photos_added')::text$s$, 'false|true'],
    ['compte de B supprimé', 'postgres', $s$with d as (delete from auth.users where id = '00000000-0000-4000-a000-0000000000a4' returning 1) select count(*) from d$s$, '1'],
    ['photo de B supprimée, fichiers en file', 'postgres', $s$select (select count(*) from event_photos where user_id = '00000000-0000-4000-a000-0000000000a4') || '|' || (select count(*) from storage_deletion_queue where name like '00000000-0000-4000-e000-0000000000a1/00000000-0000-4000-a000-0000000000a4/%')$s$, '0|2'],
    ['envois abandonnés depuis plus d''une heure', 'postgres', $s$with u as (update event_photos set created_at = now() - interval '2 hours' where event_id = '00000000-0000-4000-e000-0000000000a1' returning 1) select count(*) from u$s$, '9'],
    ['maintenance : lignes incomplètes supprimées', 'postgres', $s$select public.run_event_photos_maintenance()::text$s$, '7'],
    ['restent les 2 photos complètes', 'postgres', $s$select count(*) from event_photos where event_id = '00000000-0000-4000-e000-0000000000a1'$s$, '2'],
    ['A ne lance pas la maintenance', 'A', $s$select public.run_event_photos_maintenance()$s$, 'ERR 42501'],
    ['A ne lit pas la file', 'A', $s$select count(*) from storage_deletion_queue$s$, 'ERR 42501'],
    ['événement supprimé', 'postgres', $s$with d as (delete from events where id = '00000000-0000-4000-e000-0000000000a1' returning 1) select count(*) from d$s$, '1'],
    ['plus aucune ligne, tous les fichiers en file', 'postgres', $s$select (select count(*) from event_photos where event_id = '00000000-0000-4000-e000-0000000000a1') || '|' || (select count(*) from storage.objects o where o.bucket_id = 'event-photos' and o.name like '00000000-0000-4000-e000-0000000000a1/%' and not exists (select 1 from storage_deletion_queue q where q.bucket_id = o.bucket_id and q.name = o.name))$s$, '0|0'],
    ['RPC fermée à anon', 'anon', $s$select public.get_event_photos('00000000-0000-4000-e000-0000000000a1')::text$s$, 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-ph-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-ph-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-ph-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-ph-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (P, 'dry-ph-p@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (M, 'dry-ph-m@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-ph-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (W, 'dry-ph-w@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-ph-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'C' then C when 'A' then A when 'B' then B when 'P' then P when 'M' then M when 'D' then D when 'W' then W when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-ph-' || lower(who) || '@amiv.test')::text, true);
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
