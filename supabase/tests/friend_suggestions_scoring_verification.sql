-- Vérification des suggestions d'amis (score, raisons, exclusions, confidentialité)
-- et de la recherche search_people. Staging uniquement (crée de faux comptes) :
--   supabase db query --linked -f supabase/tests/friend_suggestions_scoring_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  A  uuid := '00000000-0000-4000-a000-000000000301'; -- moi (Paris)
  F1 uuid := '00000000-0000-4000-a000-000000000302'; -- ami de A
  F2 uuid := '00000000-0000-4000-a000-000000000303'; -- ami de A
  M2 uuid := '00000000-0000-4000-a000-000000000304'; -- ami de F1 et F2
  M1 uuid := '00000000-0000-4000-a000-000000000305'; -- ami de F1, même ville
  L  uuid := '00000000-0000-4000-a000-000000000306'; -- amie de A, organise E1
  S  uuid := '00000000-0000-4000-a000-000000000307'; -- invité·e acceptée à E1, Paris
  SO uuid := '00000000-0000-4000-a000-000000000308'; -- organise E2 où A a accepté
  I1 uuid := '00000000-0000-4000-a000-000000000309'; -- A l'a invité·e à E1 (en attente)
  I2 uuid := '00000000-0000-4000-a000-00000000030a'; -- a invité A à E3 (A n'a pas accepté)
  C  uuid := '00000000-0000-4000-a000-00000000030b'; -- même ville seulement
  P1 uuid := '00000000-0000-4000-a000-00000000030c'; -- demande A -> P1 en attente
  P2 uuid := '00000000-0000-4000-a000-00000000030d'; -- demande P2 -> A en attente
  X  uuid := '00000000-0000-4000-a000-00000000030e'; -- bloqué par A
  Y  uuid := '00000000-0000-4000-a000-00000000030f'; -- a bloqué A
  H  uuid := '00000000-0000-4000-a000-000000000310'; -- masqué par A
  E  uuid := '00000000-0000-4000-a000-000000000311'; -- ni nom ni pseudo
  Z  uuid := '00000000-0000-4000-a000-000000000312'; -- compte supprimé
  D  uuid := '00000000-0000-4000-a000-000000000313'; -- demande A -> D refusée
  R  uuid := '00000000-0000-4000-a000-000000000314'; -- participe à E3 (pas A)
  K  uuid := '00000000-0000-4000-a000-000000000315'; -- 22 amis en commun potentiels
  HB uuid := '00000000-0000-4000-a000-000000000316'; -- ami de K et des G
  B  uuid := '00000000-0000-4000-a000-000000000317'; -- autre utilisateur, sans lien
  T  uuid := '00000000-0000-4000-a000-000000000318'; -- invité·e acceptée à E1, sans ville
  E1 uuid := '00000000-0000-4000-a000-000000000391';
  E2 uuid := '00000000-0000-4000-a000-000000000392';
  E3 uuid := '00000000-0000-4000-a000-000000000393';
  all_users uuid[];
  mutual_with_f1 uuid[];
  sugg constant text := $s$select coalesce(string_agg(coalesce(username, '-') || ':' || reason || ':' || mutual_friends_count, ' | ' order by n), '') from get_friend_suggestions('00000000-0000-4000-a000-000000000301') with ordinality t(user_id, name, username, avatar_url, reason, mutual_friends_count, n)$s$;
  cases text[][] := array[
    -- Critères, raisons, ordre
    ['A : ordre et raisons', 'A', sugg,
      $e$dry3m2:2 amis en commun:2 | dry3m1:1 ami en commun:1 | dry3sofia:Organise Soirée de Sofia:0 | dry3sam:Invité·e à Anniv de Lola:0 | dry3aaron:Invité·e à Anniv de Lola:0 | dry3igor:T'a invité·e à un événement:0 | dry3ines:Tu l'as invité·e à Anniv de Lola:0$e$],
    ['nom affiché = prénom + nom', 'A', $s$select name from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000304'$s$, 'Mia Deux'],
    ['ville seule : jamais suggéré (C)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-00000000030b'$s$, '0'],
    ['événement où A ne participe pas : rien (R)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000314'$s$, '0'],
    ['nom d''un événement de I2 sans A : jamais dans une raison', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where reason ilike '%Secret%'$s$, '0'],
    ['I2 voit A avec le nom de son propre événement', 'I2', $s$select reason from get_friend_suggestions('00000000-0000-4000-a000-00000000030a') where user_id = '00000000-0000-4000-a000-000000000301'$s$, 'Tu l''as invité·e à Secret de Igor'],
    ['maximum 20 résultats (K a 22 candidats)', 'K', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000315')$s$, '20'],
    -- Exclusions
    ['A ne se voit pas lui-même', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000301'$s$, '0'],
    ['amis exclus (F1, F2, L)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id in ('00000000-0000-4000-a000-000000000302','00000000-0000-4000-a000-000000000303','00000000-0000-4000-a000-000000000306')$s$, '0'],
    ['demandes en attente exclues (P1, P2)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id in ('00000000-0000-4000-a000-00000000030c','00000000-0000-4000-a000-00000000030d')$s$, '0'],
    ['P1 ne voit pas A (demande en attente)', 'P1', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-00000000030c') where user_id = '00000000-0000-4000-a000-000000000301'$s$, '0'],
    ['bloqués dans les deux sens exclus (X, Y)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id in ('00000000-0000-4000-a000-00000000030e','00000000-0000-4000-a000-00000000030f')$s$, '0'],
    ['Y ne voit pas A', 'Y', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-00000000030f') where user_id = '00000000-0000-4000-a000-000000000301'$s$, '0'],
    ['masqué exclu (H)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000310'$s$, '0'],
    ['sans nom ni pseudo exclu (E)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000311'$s$, '0'],
    ['compte supprimé exclu (Z)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000312'$s$, '0'],
    ['demande refusée exclue (D)', 'A', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301') where user_id = '00000000-0000-4000-a000-000000000313'$s$, '0'],
    -- Confidentialité
    ['colonnes renvoyées', 'postgres', $s$select string_agg(parameter_name, ',' order by ordinal_position) from information_schema.parameters where specific_schema = 'public' and specific_name like 'get\_friend\_suggestions\_%' and parameter_mode = 'OUT'$s$, 'user_id,name,username,avatar_url,reason,mutual_friends_count'],
    ['B lit les suggestions de A', 'B', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301')$s$, '0'],
    ['anon appelle les suggestions', 'anon', $s$select count(*) from get_friend_suggestions('00000000-0000-4000-a000-000000000301')$s$, 'ERR 42501'],
    ['event_participants interdit à l''app', 'A', 'select count(*) from event_participants()', 'ERR 42501'],
    ['ville d''un autre illisible', 'A', $s$select city from profiles where id = '00000000-0000-4000-a000-000000000305'$s$, 'ERR 42501'],
    ['email d''un autre illisible', 'A', $s$select email from profiles where id = '00000000-0000-4000-a000-000000000305'$s$, 'ERR 42501'],
    ['date de naissance d''un autre illisible', 'A', $s$select birthday from profiles where id = '00000000-0000-4000-a000-000000000305'$s$, 'ERR 42501'],
    ['champs publics lisibles', 'A', $s$select username from profiles where id = '00000000-0000-4000-a000-000000000305'$s$, 'dry3m1'],
    ['A lit sa ville', 'A', 'select city from get_my_profile()', 'Paris'],
    ['A modifie sa ville', 'A', $s$with x as (update profiles set city = 'Lyon' where id = '00000000-0000-4000-a000-000000000301' returning 1) select count(*) from x$s$, '1'],
    ['A ne modifie pas la ville d''un autre', 'A', $s$with x as (update profiles set city = 'Lyon' where id = '00000000-0000-4000-a000-000000000305' returning 1) select count(*) from x$s$, '0'],
    ['anon lit profiles', 'anon', 'select count(*) from profiles', 'ERR 42501'],
    -- Recherche
    ['recherche : colonnes renvoyées', 'postgres', $s$select string_agg(parameter_name, ',' order by ordinal_position) from information_schema.parameters where specific_schema = 'public' and specific_name like 'search\_people\_%' and parameter_mode = 'OUT'$s$, 'user_id,name,username,avatar_url,is_friend'],
    ['recherche par pseudo', 'A', $s$select string_agg(username || ':' || is_friend, ',') from search_people('dry3m2')$s$, 'dry3m2:false'],
    ['recherche par prénom + nom', 'A', $s$select string_agg(username, ',') from search_people('Mia Deux')$s$, 'dry3m2'],
    ['recherche : amis avec is_friend', 'A', $s$select string_agg(username || ':' || is_friend, ',' order by username) from search_people('dry3f')$s$, 'dry3f1:true,dry3f2:true'],
    ['recherche : 1 caractère', 'A', $s$select count(*) from search_people('d')$s$, '0'],
    ['recherche : moi exclu', 'A', $s$select count(*) from search_people('dry3alice')$s$, '0'],
    ['recherche : demandes en attente exclues', 'A', $s$select count(*) from search_people('dry3p')$s$, '0'],
    ['recherche : bloqués exclus', 'A', $s$select (select count(*) from search_people('dry3x')) + (select count(*) from search_people('dry3y'))$s$, '0'],
    ['recherche : masqué exclu', 'A', $s$select count(*) from search_people('dry3h')$s$, '0'],
    ['recherche : compte supprimé exclu', 'A', $s$select count(*) from search_people('dry3z')$s$, '0'],
    ['recherche : sans nom ni pseudo exclu', 'A', $s$select count(*) from search_people('dry-s3e@amiv.test')$s$, '0'],
    ['recherche : demande refusée retrouvable', 'A', $s$select string_agg(username, ',') from search_people('dry3d')$s$, 'dry3d'],
    ['recherche : email exact', 'A', $s$select string_agg(username, ',') from search_people('DRY-S3M2@amiv.test')$s$, 'dry3m2'],
    ['recherche : email partiel', 'A', $s$select count(*) from search_people('dry-s3m2@amiv')$s$, '0'],
    ['recherche : anon', 'anon', $s$select count(*) from search_people('dry3m2')$s$, 'ERR 42501']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
begin
  all_users := array[A, F1, F2, M2, M1, L, S, SO, I1, I2, C, P1, P2, X, Y, H, E, Z, D, R, K, HB, B, T];
  for i in 1 .. 22 loop
    all_users := all_users || ('00000000-0000-4000-a000-0000000004' || lpad(i::text, 2, '0'))::uuid;
  end loop;

  insert into auth.users (id, email, aud, role, instance_id, deleted_at)
  select u, 'dry-s3' || right(u::text, 3) || '@amiv.test', 'authenticated', 'authenticated',
    '00000000-0000-0000-0000-000000000000', case when u = Z then now() end
  from unnest(all_users) u;
  -- Emails lisibles pour les tests de recherche.
  update auth.users set email = 'dry-s3m2@amiv.test' where id = M2;
  update auth.users set email = 'dry-s3e@amiv.test' where id = E;

  insert into profiles (id, email, first_name, name, username, city)
  select v.id, u.email, v.first_name, v.name, v.username, v.city
  from (values
    (A,  'Alice', 'Dry', 'dry3alice', 'Paris'),
    (F1, 'Fanny', 'Dry', 'dry3f1', null),
    (F2, 'Fred', 'Dry', 'dry3f2', null),
    (M2, 'Mia', 'Deux', 'dry3m2', null),
    (M1, 'Maé', 'Dry', 'dry3m1', ' paris '),
    (L,  'Lola', 'Dry', 'dry3lola', null),
    (S,  'Sam', 'Dry', 'dry3sam', 'PARIS'),
    (SO, 'Sofia', 'Dry', 'dry3sofia', null),
    (I1, 'Inès', 'Dry', 'dry3ines', null),
    (I2, 'Igor', 'Dry', 'dry3igor', null),
    (C,  'Clara', 'Dry', 'dry3clara', 'Paris'),
    (P1, 'Paul', 'Dry', 'dry3p1', null),
    (P2, 'Pia', 'Dry', 'dry3p2', null),
    (X,  'Xavier', 'Dry', 'dry3x', null),
    (Y,  'Yann', 'Dry', 'dry3y', null),
    (H,  'Hugo', 'Dry', 'dry3h', null),
    (E,  null, '  ', null, null),
    (Z,  'Zoé', 'Dry', 'dry3z', null),
    (D,  'Dan', 'Dry', 'dry3d', null),
    (R,  'Rémi', 'Dry', 'dry3r', null),
    (K,  'Kim', 'Dry', 'dry3k', null),
    (HB, 'Centre', 'Dry', 'dry3centre', null),
    (B,  'Bob', 'Dry', 'dry3b', null),
    (T,  'Aaron', 'Dry', 'dry3aaron', null)
  ) v(id, first_name, name, username, city)
  join auth.users u on u.id = v.id
  on conflict (id) do update
    set first_name = excluded.first_name, name = excluded.name, username = excluded.username, city = excluded.city;
  insert into profiles (id, email, first_name, name, username)
  select u, 'dry-s3' || right(u::text, 3) || '@amiv.test', 'G' || right(u::text, 2), 'Dry', 'dry3g' || right(u::text, 2)
  from unnest(all_users[25:46]) u
  on conflict (id) do update set first_name = excluded.first_name, name = excluded.name, username = excluded.username;

  mutual_with_f1 := array[M2, M1, P1, P2, X, Y, H, E, Z, D];
  insert into friendships (requester_id, addressee_id, status) values
    (A, F1, 'accepted'), (F2, A, 'accepted'), (A, L, 'accepted'),
    (F2, M2, 'accepted'),
    (A, P1, 'pending'), (P2, A, 'pending'), (A, D, 'declined'),
    (K, HB, 'accepted');
  insert into friendships (requester_id, addressee_id, status)
  select F1, u, 'accepted' from unnest(mutual_with_f1) u;
  insert into friendships (requester_id, addressee_id, status)
  select HB, u, 'accepted' from unnest(all_users[25:46]) u;

  insert into user_blocks (blocker_id, blocked_id) values (A, X), (Y, A);
  insert into suggestion_dismissals (user_id, dismissed_user_id) values (A, H);

  insert into events (id, name, type, user_id, date) values
    (E1, 'Anniv de Lola', 'birthday', L, now() + interval '10 days'),
    (E2, 'Soirée de Sofia', 'party', SO, now() + interval '5 days'),
    (E3, 'Secret de Igor', 'party', I2, now() + interval '3 days');
  insert into rsvps (event_id, user_id, status) values (E1, A, 'going'), (E3, R, 'going');
  insert into invitations (event_id, invited_by, invited_user_id, status) values
    (E1, L, S, 'accepted'),
    (E1, L, T, 'accepted'),
    (E1, A, I1, 'pending'),
    (E2, SO, A, 'accepted'),
    (E3, I2, A, 'pending');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'A' then A when 'B' then B when 'K' then K when 'I2' then I2 when 'P1' then P1 when 'Y' then Y end;
    begin
      if who = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', uid::text, true);
        execute 'set local role authenticated';
      end if;
      execute cases[i][3] into res;
      res := coalesce(res, 'NULL');
      execute 'reset role';
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
