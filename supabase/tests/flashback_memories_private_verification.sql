-- Vérification de 20261102120000 : avant la révélation, seul l'auteur lit le
-- contenu d'un souvenir (ligne et image) ; les autres membres de l'espace
-- secret n'ont que id + auteur + date via get_flashback_entries. La personne
-- fêtée lit tout à partir du jour de l'événement (inchangé).
-- Et de 20261102130000 : seul l'auteur modifie, supprime ou remplace son souvenir,
-- avant la révélation ; l'image retirée part dans storage_deletion_queue
-- (purge-storage l'efface ensuite, hors de ce test). Les deux migrations
-- doivent être appliquées.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/flashback_memories_private_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000091';
  A uuid := '00000000-0000-4000-a000-000000000092';
  B uuid := '00000000-0000-4000-a000-000000000093';
  P uuid := '00000000-0000-4000-a000-000000000094';
  X uuid := '00000000-0000-4000-a000-000000000095';
  cases text[][] := array[
    ['anniversaire de P', 'postgres', $s$with e as (insert into events(id, name, type, user_id, birthday_person_user_id, date) values ('00000000-0000-4000-e000-000000000091', 'Anniv P', 'Anniversaire', '00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000094', now() + interval '20 days') returning 1) select count(*) from e$s$, '1'],
    ['autre anniversaire (X)', 'postgres', $s$with e as (insert into events(id, name, type, user_id, date) values ('00000000-0000-4000-e000-000000000092', 'Anniv X', 'Anniversaire', '00000000-0000-4000-a000-000000000095', now() + interval '20 days') returning 1) select count(*) from e$s$, '1'],
    ['O invite A B P', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000091', array['00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093', '00000000-0000-4000-a000-000000000094']::uuid[])) x$s$, '1'],
    ['A B P acceptent', 'postgres', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000091' and invited_user_id in ('00000000-0000-4000-a000-000000000092', '00000000-0000-4000-a000-000000000093', '00000000-0000-4000-a000-000000000094') returning 1) select count(*) from i$s$, '3'],
    ['carte', 'postgres', $s$with c as (insert into collective_cards(id, event_id) values ('00000000-0000-4000-c000-000000000091', '00000000-0000-4000-e000-000000000091') returning 1) select count(*) from c$s$, '1'],
    ['A ajoute un souvenir avec image', 'A', $s$insert into collective_memories(id, card_id, event_id, contributor_id, text, emoji, image_url) values ('00000000-0000-4000-d000-000000000091', '00000000-0000-4000-c000-000000000091', '00000000-0000-4000-e000-000000000091', auth.uid(), 'secret de A', '🥳', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a.jpg') returning 1$s$, '1'],
    ['B ajoute un souvenir avec image', 'B', $s$insert into collective_memories(id, card_id, event_id, contributor_id, text, image_url) values ('00000000-0000-4000-d000-000000000092', '00000000-0000-4000-c000-000000000091', '00000000-0000-4000-e000-000000000091', auth.uid(), 'secret de B', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000093/b.jpg') returning 1$s$, '1'],
    ['fichiers des images', 'postgres', $s$with o as (insert into storage.objects(bucket_id, name, owner) values ('memory-images', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a.jpg', '00000000-0000-4000-a000-000000000092'), ('memory-images', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000093/b.jpg', '00000000-0000-4000-a000-000000000093') returning 1) select count(*) from o$s$, '2'],
    ['bucket privé', 'postgres', $s$select public::text from storage.buckets where id = 'memory-images'$s$, 'false'],

    ['A lit son souvenir', 'A', $s$select string_agg(text, ',') from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, 'secret de A'],
    ['A ne lit pas celui de B', 'A', $s$select count(*) from collective_memories where id = '00000000-0000-4000-d000-000000000092'$s$, '0'],
    ['B ne lit que le sien', 'B', $s$select string_agg(text, ',') from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, 'secret de B'],
    ['organisateur : aucun contenu', 'O', $s$select count(*) from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['étranger : aucun contenu', 'X', $s$select count(*) from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],
    ['P avant le jour : aucun contenu', 'P', $s$select count(*) from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, '0'],

    ['A : liste complète sans contenu', 'A', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '2'],
    ['O : liste complète', 'O', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '2'],
    ['liste : colonnes id, auteur, date seulement', 'B', $s$select string_agg(distinct k, ',') from get_flashback_entries('00000000-0000-4000-e000-000000000091') e, jsonb_object_keys(to_jsonb(e)) k$s$, 'contributor_id,created_at,id'],
    ['liste : auteurs', 'B', $s$select string_agg(contributor_id::text, ',' order by contributor_id) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '00000000-0000-4000-a000-000000000092,00000000-0000-4000-a000-000000000093'],
    ['P avant le jour : liste vide', 'P', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '0'],
    ['étranger : liste vide', 'X', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '0'],
    ['anon : liste refusée', 'anon', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, 'ERR 42501'],
    ['anon : table refusée', 'anon', $s$select count(*) from collective_memories$s$, 'ERR 42501'],

    ['A voit son image', 'A', $s$select count(*) from storage.objects where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '1'],
    ['B ne voit pas l''image de A', 'B', $s$select count(*) from storage.objects where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/%'$s$, '0'],
    ['organisateur : aucune image', 'O', $s$select count(*) from storage.objects where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '0'],
    ['B ne peut pas envoyer dans le dossier de A', 'B', $s$insert into storage.objects(bucket_id, name) values ('memory-images', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/x.jpg') returning 1$s$, 'ERR 42501'],

    ['A modifie son texte', 'A', $s$with u as (update collective_memories set text = 'secret de A bis' where id = '00000000-0000-4000-d000-000000000091' returning 1) select count(*) from u$s$, '1'],
    ['A ne peut pas déplacer son souvenir', 'A', $s$with u as (update collective_memories set event_id = '00000000-0000-4000-e000-000000000092' where id = '00000000-0000-4000-d000-000000000091' returning 1) select count(*) from u$s$, 'ERR 42501'],
    ['B ne peut pas modifier celui de A', 'B', $s$with u as (update collective_memories set text = 'pirate' where id = '00000000-0000-4000-d000-000000000091' returning 1) select count(*) from u$s$, '0'],
    ['message système sans contenu', 'B', $s$select content from messages where event_id = '00000000-0000-4000-e000-000000000091' and system_type = 'memory_added' and system_data->>'item_id' = '00000000-0000-4000-d000-000000000091'$s$, 'Camille a ajouté un souvenir'],

    ['A ajoute un souvenir à supprimer', 'A', $s$insert into collective_memories(id, card_id, event_id, contributor_id, text, image_url) values ('00000000-0000-4000-d000-000000000093', '00000000-0000-4000-c000-000000000091', '00000000-0000-4000-e000-000000000091', auth.uid(), 'à supprimer', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/c.jpg') returning 1$s$, '1'],
    ['fichiers c.jpg et a2.jpg', 'postgres', $s$with o as (insert into storage.objects(bucket_id, name, owner) values ('memory-images', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/c.jpg', '00000000-0000-4000-a000-000000000092'), ('memory-images', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a2.jpg', '00000000-0000-4000-a000-000000000092') returning 1) select count(*) from o$s$, '2'],
    ['B ne peut pas supprimer le souvenir de A', 'B', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['organisateur ne peut pas supprimer', 'O', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['personne fêtée ne peut pas supprimer', 'P', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['étranger ne peut pas supprimer', 'X', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, '0'],
    ['anon ne peut pas supprimer', 'anon', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, 'ERR 42501'],
    ['rien en file avant suppression', 'postgres', $s$select count(*) from storage_deletion_queue where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '0'],
    ['A supprime son souvenir', 'A', $s$with d as (delete from collective_memories where id = '00000000-0000-4000-d000-000000000093' returning 1) select count(*) from d$s$, '1'],
    ['image supprimée mise en file', 'postgres', $s$select string_agg(name, ',') from storage_deletion_queue where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/c.jpg'],
    ['message système du souvenir supprimé retiré', 'postgres', $s$select count(*) from messages where system_type = 'memory_added' and system_data->>'item_id' = '00000000-0000-4000-d000-000000000093'$s$, '0'],
    ['liste : plus que 2 souvenirs', 'B', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '2'],
    ['A ne peut pas référencer l''image de B', 'A', $s$insert into collective_memories(card_id, event_id, contributor_id, image_url) values ('00000000-0000-4000-c000-000000000091', '00000000-0000-4000-e000-000000000091', auth.uid(), '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000093/b.jpg') returning 1$s$, 'ERR 23514'],
    ['B ne peut pas remplacer le souvenir de A', 'B', $s$select public.replace_flashback_memory('00000000-0000-4000-d000-000000000091', 'pirate', null, null, null)::text$s$, 'ERR P0002'],
    ['remplacement vide refusé', 'A', $s$select public.replace_flashback_memory('00000000-0000-4000-d000-000000000091', ' ', '', null, null)::text$s$, 'ERR 22023'],
    ['A remplace en gardant son image', 'A', $s$select length(public.replace_flashback_memory('00000000-0000-4000-d000-000000000091', 'nouveau texte', '🎂', '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a.jpg', '#eeedfe')::text)::text$s$, '36'],
    ['ancien souvenir remplacé', 'A', $s$select string_agg(text || '|' || emoji || '|' || bg_color, ',') from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, 'nouveau texte|🎂|#eeedfe'],
    ['image gardée : pas en file', 'postgres', $s$select count(*) from storage_deletion_queue where name = '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a.jpg'$s$, '0'],
    ['un seul message système pour A', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000091' and system_type = 'memory_added' and user_id = '00000000-0000-4000-a000-000000000092'$s$, '1'],
    ['A remplace avec une nouvelle image', 'A', $s$select length(public.replace_flashback_memory((select id from collective_memories where contributor_id = auth.uid() and event_id = '00000000-0000-4000-e000-000000000091'), 'avec a2', null, '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a2.jpg', null)::text)::text$s$, '36'],
    ['ancienne image mise en file', 'postgres', $s$select count(*) from storage_deletion_queue where name = '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a.jpg'$s$, '1'],
    ['nouvelle image gardée', 'postgres', $s$select count(*) from storage_deletion_queue where name = '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/a2.jpg'$s$, '0'],
    ['B : toujours 2 souvenirs', 'B', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '2'],

    ['jour de l''anniversaire', 'postgres', $s$with u as (update events set date = now() where id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '1'],
    ['P lit tout', 'P', $s$select count(*) from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, '2'],
    ['P : liste complète', 'P', $s$select count(*) from get_flashback_entries('00000000-0000-4000-e000-000000000091')$s$, '2'],
    ['P voit les images', 'P', $s$select count(*) from storage.objects where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '2'],
    ['A : toujours le sien seulement (pas de révélation aux invités)', 'A', $s$select count(*) from collective_memories where event_id = '00000000-0000-4000-e000-000000000091'$s$, '1'],
    ['B : toujours pas l''image de A', 'B', $s$select count(*) from storage.objects where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/00000000-0000-4000-a000-000000000092/%'$s$, '0'],
    ['après révélation : A ne peut plus supprimer', 'A', $s$with d as (delete from collective_memories where contributor_id = auth.uid() and event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from d$s$, '0'],
    ['après révélation : A ne peut plus remplacer', 'A', $s$select public.replace_flashback_memory((select id from collective_memories where contributor_id = auth.uid() and event_id = '00000000-0000-4000-e000-000000000091'), 'trop tard', null, null, null)::text$s$, 'ERR 42501'],
    ['après révélation : A ne peut plus modifier', 'A', $s$with u as (update collective_memories set text = 'trop tard' where contributor_id = auth.uid() and event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '0'],
    ['après révélation : A ne peut plus changer son image', 'A', $s$with u as (update collective_memories set image_url = null where contributor_id = auth.uid() and event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from u$s$, '0'],
    ['après révélation : souvenir de A intact', 'P', $s$select string_agg(text, ',') from collective_memories where contributor_id = '00000000-0000-4000-a000-000000000092'$s$, 'avec a2'],
    ['après révélation : P ne peut pas supprimer', 'P', $s$with d as (delete from collective_memories where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from d$s$, '0'],
    ['après révélation : organisateur ne peut pas supprimer', 'O', $s$with d as (delete from collective_memories where event_id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from d$s$, '0'],
    ['suppression de l''événement', 'postgres', $s$with d as (delete from events where id = '00000000-0000-4000-e000-000000000091' returning 1) select count(*) from d$s$, '1'],
    ['événement supprimé : toutes ses images en file', 'postgres', $s$select count(*) from storage_deletion_queue where bucket_id = 'memory-images' and name like '00000000-0000-4000-e000-000000000091/%'$s$, '4']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-fb-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-fb-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-fb-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (P, 'dry-fb-p@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-fb-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update profiles set first_name = 'Camille' where id = A;

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'P' then P when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-fb-' || lower(who) || '@amiv.test')::text, true);
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
