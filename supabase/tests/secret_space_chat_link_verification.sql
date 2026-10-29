-- Vérification de 20261101190000 : messages système de l'espace secret dans
-- le chat Secret (souvenir, idée cadeau, cagnotte sans montant, relance) et
-- relance remind_secret_space_guest. Jamais visibles ni notifiés pour la
-- personne fêtée, jamais pour un anniversaire sans personne fêtée.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/secret_space_chat_link_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000081';
  A uuid := '00000000-0000-4000-a000-000000000082';
  B uuid := '00000000-0000-4000-a000-000000000083';
  P uuid := '00000000-0000-4000-a000-000000000084';
  M uuid := '00000000-0000-4000-a000-000000000085';
  X uuid := '00000000-0000-4000-a000-000000000086';
  cases text[][] := array[
    ['prénoms', 'postgres', $s$with u as (update profiles set first_name = case id when '00000000-0000-4000-a000-000000000081' then 'Olga' when '00000000-0000-4000-a000-000000000082' then 'Camille' when '00000000-0000-4000-a000-000000000083' then 'Lucas' when '00000000-0000-4000-a000-000000000084' then 'Toto' else 'Max' end where id::text like '00000000-0000-4000-a000-00000000008%' returning 1) select count(*) from u$s$, '6'],
    ['anniversaire de Toto', 'postgres', $s$with e as (insert into events(id, name, type, user_id, birthday_person_user_id, date) values ('00000000-0000-4000-e000-000000000081', 'Anniv Toto', 'Anniversaire', '00000000-0000-4000-a000-000000000081', '00000000-0000-4000-a000-000000000084', now() + interval '20 days') returning 1) select count(*) from e$s$, '1'],
    ['anniversaire sans personne fêtée', 'postgres', $s$with e as (insert into events(id, name, type, user_id) values ('00000000-0000-4000-e000-000000000082', 'Anniv sans', 'Anniversaire', '00000000-0000-4000-a000-000000000081') returning 1) select count(*) from e$s$, '1'],
    ['O invite A B P M', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000081', array['00000000-0000-4000-a000-000000000082', '00000000-0000-4000-a000-000000000083', '00000000-0000-4000-a000-000000000084', '00000000-0000-4000-a000-000000000085']::uuid[])) x$s$, '1'],
    ['O invite A (sans personne fêtée)', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000082', array['00000000-0000-4000-a000-000000000082']::uuid[])) x$s$, '1'],
    ['A B P acceptent', 'postgres', $s$with i as (update invitations set status = 'accepted' where (event_id = '00000000-0000-4000-e000-000000000081' and invited_user_id in ('00000000-0000-4000-a000-000000000082', '00000000-0000-4000-a000-000000000083', '00000000-0000-4000-a000-000000000084')) or (event_id = '00000000-0000-4000-e000-000000000082' and invited_user_id = '00000000-0000-4000-a000-000000000082') returning 1) select count(*) from i$s$, '4'],
    ['cartes', 'postgres', $s$with c as (insert into collective_cards(id, event_id) values ('00000000-0000-4000-c000-000000000081', '00000000-0000-4000-e000-000000000081'), ('00000000-0000-4000-c000-000000000082', '00000000-0000-4000-e000-000000000082') returning 1) select count(*) from c$s$, '2'],
    ['notifications avant activité (référence)', 'postgres', $s$select count(*) from notifications where data->>'event_id' = '00000000-0000-4000-e000-000000000081' and type not in ('event_invitation', 'invitation_received')$s$, '0'],
    ['A ajoute un souvenir', 'A', $s$insert into collective_memories(id, card_id, event_id, contributor_id, text) values ('00000000-0000-4000-d000-000000000081', '00000000-0000-4000-c000-000000000081', '00000000-0000-4000-e000-000000000081', auth.uid(), 'coucou') returning 1$s$, '1'],
    ['message système souvenir', 'postgres', $s$select content || '|' || (system_data->>'tab') || '|' || (system_data->>'item_id') || '|' || user_id from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'memory_added' and is_secret$s$, 'Camille a ajouté un souvenir|flashback|00000000-0000-4000-d000-000000000081|00000000-0000-4000-a000-000000000082'],
    ['B lit le message système (RPC)', 'B', $s$select system_type || '|' || (system_data->>'tab') from get_event_messages('00000000-0000-4000-e000-000000000081', true)$s$, 'memory_added|flashback'],
    ['B lit le message système (table)', 'B', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000081' and is_secret and system_type is not null$s$, '1'],
    ['A ne peut pas écrire un message système', 'A', $s$insert into messages(event_id, user_id, content, is_secret, system_type, system_data) values ('00000000-0000-4000-e000-000000000081', auth.uid(), 'faux', true, 'memory_added', '{}') returning 1$s$, 'ERR 42501'],
    ['A ne peut pas écrire de system_data', 'A', $s$insert into messages(event_id, user_id, content, is_secret, system_data) values ('00000000-0000-4000-e000-000000000081', auth.uid(), 'faux', true, '{}') returning 1$s$, 'ERR 42501'],
    ['A écrit un message secret normal', 'A', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000081', auth.uid(), 'chut', true) returning 1$s$, '1'],
    ['message système dans le général : refusé', 'postgres', $s$insert into messages(event_id, user_id, content, is_secret, system_type) values ('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000082', 'x', false, 'memory_added') returning 1$s$, 'ERR 23514'],
    ['B ajoute une idée cadeau', 'B', $s$insert into gift_items(id, event_id, label, added_by) values ('00000000-0000-4000-d000-000000000082', '00000000-0000-4000-e000-000000000081', 'Vélo', auth.uid()) returning 1$s$, '1'],
    ['message système idée cadeau', 'postgres', $s$select content || '|' || (system_data->>'tab') from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'gift_added'$s$, 'Lucas a ajouté une idée cadeau|gifts'],
    ['B participe à la cagnotte (35 €)', 'B', $s$insert into cagnotte_contributions(id, event_id, user_id, amount) values ('00000000-0000-4000-d000-000000000083', '00000000-0000-4000-e000-000000000081', auth.uid(), 35) returning 1$s$, '1'],
    ['message système cagnotte, sans montant', 'postgres', $s$select content || '|' || (system_data->>'tab') || '|' || (system_data::text like '%35%')::text from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'cagnotte_joined'$s$, 'Lucas a participé à la cagnotte|cagnotte|false'],
    ['aucune notification de message (secret)', 'postgres', $s$select count(*) from notifications where data->>'event_id' = '00000000-0000-4000-e000-000000000081' and type = 'message_received'$s$, '0'],
    ['P personne fêtée : rien (RPC)', 'P', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000081', true)$s$, '0'],
    ['P personne fêtée : rien (table)', 'P', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000081' and (is_secret or system_type is not null)$s$, '0'],
    ['P personne fêtée : aucune notification', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000084' and data->>'event_id' = '00000000-0000-4000-e000-000000000081' and type not in ('event_invitation', 'invitation_received')$s$, '0'],
    ['M en attente : rien', 'M', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000081', true)$s$, '0'],
    ['A sans personne fêtée : souvenir', 'A', $s$insert into collective_memories(card_id, event_id, contributor_id, text) values ('00000000-0000-4000-c000-000000000082', '00000000-0000-4000-e000-000000000082', auth.uid(), 'x') returning 1$s$, '1'],
    ['sans personne fêtée : aucun message système', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000082'$s$, '0'],
    ['A supprime son souvenir', 'A', $s$delete from collective_memories where id = '00000000-0000-4000-d000-000000000081' returning 1$s$, '1'],
    ['message système du souvenir retiré', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'memory_added'$s$, '0'],
    ['les autres restent', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000081' and is_secret$s$, '3'],
    ['O relance B', 'O', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000083')$s$, 'sent'],
    ['message de relance', 'postgres', $s$select content || '|' || (system_data->>'target_id') || '|' || user_id from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'secret_reminder'$s$, 'Olga a relancé Lucas pour le Flashback|00000000-0000-4000-a000-000000000083|00000000-0000-4000-a000-000000000081'],
    ['B notifié de la relance', 'postgres', $s$select type || '|' || body from notifications where user_id = '00000000-0000-4000-a000-000000000083' and type = 'secret_space_reminder' and data->>'event_id' = '00000000-0000-4000-e000-000000000081'$s$, 'secret_space_reminder|Olga attend ton souvenir pour l’anniversaire de Toto'],
    ['A relance B juste après : trop tôt', 'A', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000083')$s$, 'too_soon'],
    ['une seule relance', 'postgres', $s$select (select count(*) from messages where system_type = 'secret_reminder' and event_id = '00000000-0000-4000-e000-000000000081') + (select count(*) from notifications where type = 'secret_space_reminder' and data->>'event_id' = '00000000-0000-4000-e000-000000000081')$s$, '2'],
    ['relancer la personne fêtée : refusé', 'A', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000084')$s$, 'ERR 22023'],
    ['relancer quelqu''un en attente : refusé', 'A', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000085')$s$, 'ERR 22023'],
    ['se relancer soi-même : refusé', 'A', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', auth.uid())$s$, 'ERR 22023'],
    ['la personne fêtée ne peut pas relancer', 'P', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000082')$s$, 'ERR 42501'],
    ['un étranger ne peut pas relancer', 'X', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000081', '00000000-0000-4000-a000-000000000082')$s$, 'ERR 42501'],
    ['relance sans personne fêtée : refusée', 'O', $s$select public.remind_secret_space_guest('00000000-0000-4000-e000-000000000082', '00000000-0000-4000-a000-000000000082')$s$, 'ERR 42501'],
    ['P : toujours rien après la relance', 'P', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000081', true)$s$, '0'],
    ['P : aucune notification après la relance', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000084' and data->>'event_id' = '00000000-0000-4000-e000-000000000081' and type not in ('event_invitation', 'invitation_received')$s$, '0'],
    ['B retire sa participation', 'B', $s$delete from cagnotte_contributions where id = '00000000-0000-4000-d000-000000000083' returning 1$s$, '1'],
    ['message cagnotte retiré', 'postgres', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000081' and system_type = 'cagnotte_joined'$s$, '0'],
    ['B coupe les rappels', 'postgres', $s$with u as (update profiles set notif_invitations = false where id = '00000000-0000-4000-a000-000000000083' returning 1) select count(*) from u$s$, '1'],
    ['push relance suit notif_invitations', 'postgres', $s$select public.push_allowed('00000000-0000-4000-a000-000000000083', 'secret_space_reminder')::text$s$, 'false'],
    ['fonction interne inaccessible', 'A', $s$select public.post_secret_system_message('00000000-0000-4000-e000-000000000081', auth.uid(), 'memory_added', 'x', '{}')::text$s$, 'ERR 42501'],
    ['prénom interne inaccessible', 'A', $s$select public.secret_display_first_name(auth.uid())$s$, 'ERR 42501'],
    ['RPC lecture fermée à anon', 'anon', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000081', true)$s$, 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-sc-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-sc-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-sc-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (P, 'dry-sc-p@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (M, 'dry-sc-m@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-sc-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'P' then P when 'M' then M when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-sc-' || lower(who) || '@amiv.test')::text, true);
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
