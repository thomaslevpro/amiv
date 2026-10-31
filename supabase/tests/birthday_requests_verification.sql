-- Vérification de 20261101170000 + 20261101170100 : liens « Demander son anniversaire ».
-- Création limitée (20 / 24 h), lecture et réponse sans compte, un seul
-- usage, expiration, rappel + notification créés chez le demandeur, RLS,
-- limite par adresse IP, cascade à la suppression du compte, nettoyage.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/birthday_requests_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000061';
  B uuid := '00000000-0000-4000-a000-000000000062';
  cases text[][] := array[
    ['prénom de A', 'postgres', $s$with x as (update profiles set first_name = 'Thomas' where id = '00000000-0000-4000-a000-000000000061' returning 1) select count(*) from x$s$, '1'],

    -- Création
    ['sans compte : création refusée', 'anon', $s$select create_birthday_request('Lola')$s$, 'ERR 42501'],
    ['A crée un lien', 'A', $s$select (create_birthday_request('  Lola  ')->>'code') ~ '^[A-Za-z0-9_-]{32}$'$s$, 'true'],
    ['prénom nettoyé', 'A', $s$select friend_name || ':' || status || ':' || (expires_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour') from birthday_requests$s$, 'Lola:pending:true'],
    ['A sans prénom', 'A', $s$select create_birthday_request(null) ? 'code'$s$, 'true'],
    ['B ne voit pas les demandes de A', 'B', 'select count(*) from birthday_requests', '0'],
    ['A ne peut pas écrire directement', 'A', $s$insert into birthday_requests(user_id, code) values (auth.uid(), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') returning 1$s$, 'ERR 42501'],
    ['A ne peut pas modifier', 'A', $s$update birthday_requests set status = 'received' returning 1$s$, 'ERR 42501'],
    ['sans compte : lecture de la table refusée', 'anon', 'select count(*) from birthday_requests', 'ERR 42501'],
    ['lien fixe P (Lola)', 'postgres', $s$insert into birthday_requests(user_id, code, friend_name) values ('00000000-0000-4000-a000-000000000061', 'DryRunPendingCode_0000000000000P', 'Lola') returning 1$s$, '1'],

    -- Lecture publique
    ['sans compte : lien en attente', 'anon', $s$select concat_ws(',', j->>'status', j->>'requester_first_name', j->>'friend_name', coalesce(j->>'requester_id', 'null'), j->>'is_own') from get_birthday_request('DryRunPendingCode_0000000000000P') j$s$, 'pending,Thomas,Lola,null,false'],
    ['code inconnu', 'anon', $s$select get_birthday_request('DryRunUnknownCode_000000000000ZZ')->>'status'$s$, 'not_found'],
    ['code mal formé', 'anon', $s$select get_birthday_request('court')->>'status'$s$, 'not_found'],
    ['B connecté : requester_id visible', 'B', $s$select get_birthday_request('DryRunPendingCode_0000000000000P')->>'requester_id'$s$, '00000000-0000-4000-a000-000000000061'],
    ['A : c''est son lien', 'A', $s$select get_birthday_request('DryRunPendingCode_0000000000000P')->>'is_own'$s$, 'true'],

    -- Réponse
    ['31 février refusé', 'anon', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', 'Lola', 31, 2)->>'status'$s$, 'invalid'],
    ['année future refusée', 'anon', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', 'Lola', 1, 1, extract(year from current_date)::int + 1)->>'status'$s$, 'invalid'],
    ['prénom vide refusé', 'anon', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', '   ', 12, 3)->>'status'$s$, 'invalid'],
    ['A ne répond pas à son propre lien', 'A', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', 'Moi', 12, 3)->>'status'$s$, 'own_request'],
    ['sans compte : Lola répond', 'anon', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', ' Lola ', 12, 3)::text$s$, '{"status": "ok", "requester_id": null}'],
    ['rappel créé chez A', 'postgres', $s$select name || ':' || birthdate || ':' || array_to_string(reminder_days, ',') || ':' || coalesce(linked_profile_id::text, 'null') from birthdays where user_id = '00000000-0000-4000-a000-000000000061'$s$, 'Lola:2000-03-12::null'],
    ['notification pour A', 'postgres', $s$select title from notifications where user_id = '00000000-0000-4000-a000-000000000061' and type = 'birthday_shared'$s$, 'Lola t''a donné sa date d''anniversaire : 12 mars'],
    ['A voit la demande reçue', 'A', $s$select status || ':' || responder_name || ':' || (birthday_id is not null) from birthday_requests where code = 'DryRunPendingCode_0000000000000P'$s$, 'received:Lola:true'],
    ['deuxième réponse refusée', 'anon', $s$select submit_birthday_request('DryRunPendingCode_0000000000000P', 'Lola', 13, 3)->>'status'$s$, 'used'],
    ['lien utilisé', 'anon', $s$select concat_ws(',', j->>'status', coalesce(j->>'friend_name', 'null')) from get_birthday_request('DryRunPendingCode_0000000000000P') j$s$, 'used,null'],
    ['toujours un seul rappel', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000061'$s$, '1'],

    -- Expiration
    ['lien expiré E', 'postgres', $s$insert into birthday_requests(user_id, code, created_at, expires_at) values ('00000000-0000-4000-a000-000000000061', 'DryRunExpiredCode_0000000000000E', now() - interval '31 days', now() - interval '1 day') returning 1$s$, '1'],
    ['lecture : expiré', 'anon', $s$select get_birthday_request('DryRunExpiredCode_0000000000000E')->>'status'$s$, 'expired'],
    ['réponse : expiré', 'anon', $s$select submit_birthday_request('DryRunExpiredCode_0000000000000E', 'Lola', 12, 3)->>'status'$s$, 'expired'],

    -- Personne connectée
    ['lien Q', 'postgres', $s$insert into birthday_requests(user_id, code) values ('00000000-0000-4000-a000-000000000061', 'DryRunConnectedCode_00000000000Q') returning 1$s$, '1'],
    ['B connecté répond', 'B', $s$select submit_birthday_request('DryRunConnectedCode_00000000000Q', 'Bob', 1, 1, 1995)->>'requester_id'$s$, '00000000-0000-4000-a000-000000000061'],
    ['rappel lié au profil de B', 'postgres', $s$select birthdate || ':' || linked_profile_id from birthdays where user_id = '00000000-0000-4000-a000-000000000061' and name = 'Bob'$s$, '1995-01-01:00000000-0000-4000-a000-000000000062'],
    ['« 1er janvier »', 'postgres', $s$select title from notifications where user_id = '00000000-0000-4000-a000-000000000061' and type = 'birthday_shared' and title like 'Bob%'$s$, 'Bob t''a donné sa date d''anniversaire : 1er janvier'],
    ['B ne voit toujours rien', 'B', 'select count(*) from birthday_requests', '0'],

    -- Push
    ['push autorisé par défaut', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000061', 'birthday_shared')$s$, 'true'],
    ['A coupe « Nouvelles invitations »', 'A', $s$with x as (update profiles set notif_invitations = false where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['push bloqué', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000061', 'birthday_shared')$s$, 'false'],

    -- Limite par utilisateur : A en est à 4 liens sur 24 h (E créé il y a 31 j)
    ['A : 16 liens de plus', 'postgres', $s$with x as (insert into birthday_requests(user_id, code) select '00000000-0000-4000-a000-000000000061', 'DryRunBulkCode_' || lpad(g::text, 17, '0') from generate_series(1, 16) g returning 1) select count(*) from x$s$, '16'],
    ['21e lien refusé', 'A', $s$select create_birthday_request('Max')$s$, 'ERR P0001'],
    ['B peut encore créer', 'B', $s$select create_birthday_request('Max') ? 'code'$s$, 'true'],

    -- Limite par adresse IP : 10 envois par heure
    ['IP 203.0.113.7', 'postgres', $s$select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true) <> ''$s$, 'true'],
    ['11e et 12e envois bloqués', 'anon', $s$with t as materialized (select g, submit_birthday_request('DryRunUnknownCode_000000000000ZZ', 'X', 1, 1)->>'status' s from generate_series(1, 12) g) select string_agg(s, ',' order by g) from t where g >= 10$s$, 'not_found,rate_limited,rate_limited'],
    ['empreinte seulement, pas l''IP', 'postgres', $s$select count(*) || ':' || bool_and(ip_hash = encode(extensions.digest('203.0.113.7', 'sha256'), 'hex')) from birthday_request_attempts where attempted_at > now() - interval '1 minute'$s$, '10:true'],
    ['autre IP non bloquée', 'postgres', $s$select set_config('request.headers', '{"x-forwarded-for":"198.51.100.4"}', true) <> ''$s$, 'true'],
    ['autre IP : envoi traité', 'anon', $s$select submit_birthday_request('DryRunUnknownCode_000000000000ZZ', 'X', 1, 1)->>'status'$s$, 'not_found'],
    ['sans compte : pas de lecture des tentatives', 'anon', 'select count(*) from birthday_request_attempts', 'ERR 42501'],

    -- Nettoyage
    ['sans compte : purge refusée', 'anon', 'select purge_birthday_requests()', 'ERR 42501'],
    ['demande de B vieille de 91 j', 'postgres', $s$with x as (update birthday_requests set created_at = now() - interval '91 days' where user_id = '00000000-0000-4000-a000-000000000062' returning 1) select count(*) from x$s$, '1'],
    ['tentative vieille de 2 j', 'postgres', $s$insert into birthday_request_attempts(ip_hash, attempted_at) values ('dry', now() - interval '2 days') returning 1$s$, '1'],
    ['purge', 'postgres', 'select purge_birthday_requests() >= 1', 'true'],
    ['demande de B supprimée', 'postgres', $s$select count(*) from birthday_requests where user_id = '00000000-0000-4000-a000-000000000062'$s$, '0'],
    ['tentative ancienne supprimée', 'postgres', $s$select count(*) from birthday_request_attempts where ip_hash = 'dry'$s$, '0'],
    ['demandes de A conservées', 'postgres', $s$select count(*) from birthday_requests where user_id = '00000000-0000-4000-a000-000000000061'$s$, '21'],
    ['tâche planifiée active', 'postgres', $s$select schedule || ':' || active from cron.job where jobname = 'birthday-requests-cleanup'$s$, '17 3 * * *:true'],

    -- Suppression du compte
    ['suppression du compte de A', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000061' returning 1) select count(*) from x$s$, '1'],
    ['demandes de A supprimées', 'postgres', $s$select count(*) from birthday_requests where user_id = '00000000-0000-4000-a000-000000000061'$s$, '0']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-br-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-br-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

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
