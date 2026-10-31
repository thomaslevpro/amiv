-- Vérification de 20261102210000 + 20261102220000 : anniversaires des amis
-- Amiv (une ligne birthdays par ami accepté, suivie de la date de profil ;
-- une ligne manuelle convertie redevient manuelle quand l'amitié prend fin).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/friend_birthdays_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000091';
  B uuid := '00000000-0000-4000-a000-000000000092';
  C uuid := '00000000-0000-4000-a000-000000000093';
  D uuid := '00000000-0000-4000-a000-000000000094';
  E uuid := '00000000-0000-4000-a000-000000000095';
  F uuid := '00000000-0000-4000-a000-000000000096';
  cases text[][] := array[
    -- Profils : B sans année (1896), C sans date
    ['profils', 'postgres', $s$with x as (update profiles set first_name = v.f, birthday = v.b from (values
        ('00000000-0000-4000-a000-000000000091'::uuid, 'Alice', '1990-05-10'::date),
        ('00000000-0000-4000-a000-000000000092'::uuid, 'Bob', '1896-06-15'::date),
        ('00000000-0000-4000-a000-000000000093'::uuid, 'Chloé', null::date),
        ('00000000-0000-4000-a000-000000000094'::uuid, 'Dan', '1985-03-03'::date),
        ('00000000-0000-4000-a000-000000000095'::uuid, 'Emma', '2000-07-07'::date),
        ('00000000-0000-4000-a000-000000000096'::uuid, 'Fanny', '1993-08-08'::date)) v(id, f, b)
      where profiles.id = v.id returning 1) select count(*) from x$s$, '6'],

    -- Garde-fous côté app
    ['A lie à la main un anniversaire à Dan', 'A', $s$insert into birthdays (user_id, name, birthdate, linked_profile_id) values (auth.uid(), 'Dany', '1985-01-01', '00000000-0000-4000-a000-000000000094') returning 1$s$, '1'],
    ['A lie à la main un anniversaire à Fanny', 'A', $s$insert into birthdays (user_id, name, birthdate, linked_profile_id) values (auth.uid(), 'Fifi', '1993-01-01', '00000000-0000-4000-a000-000000000096') returning 1$s$, '1'],
    ['friend_user_id ignoré à l''insertion', 'A', $s$insert into birthdays (user_id, name, birthdate, friend_user_id) values (auth.uid(), 'Pirate', '2000-01-01', '00000000-0000-4000-a000-000000000095') returning friend_user_id is null$s$, 'true'],
    ['friend_user_id ignoré en mise à jour', 'A', $s$update birthdays set friend_user_id = '00000000-0000-4000-a000-000000000095' where name = 'Pirate' returning friend_user_id is null$s$, 'true'],

    -- Amitiés
    ['amitiés', 'postgres', $s$with x as (insert into friendships (requester_id, addressee_id, status) values
        ('00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000092', 'pending'),
        ('00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000093', 'pending'),
        ('00000000-0000-4000-a000-000000000094', '00000000-0000-4000-a000-000000000091', 'accepted'),
        ('00000000-0000-4000-a000-000000000095', '00000000-0000-4000-a000-000000000091', 'accepted'),
        ('00000000-0000-4000-a000-000000000096', '00000000-0000-4000-a000-000000000091', 'accepted') returning 1) select count(*) from x$s$, '5'],
    ['demande en attente : aucune ligne', 'postgres', $s$select count(*) from birthdays where friend_user_id in ('00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000092') and user_id in ('00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000092')$s$, '0'],
    ['lien manuel converti, pas de 2e ligne', 'postgres', $s$select count(*) || ':' || max(name) || ':' || max(birthdate::text) || ':' || bool_and(friend_user_id = linked_profile_id) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and linked_profile_id = '00000000-0000-4000-a000-000000000094'$s$, '1:Dany:1985-03-03:true'],
    ['ligne convertie marquée manuelle', 'postgres', $s$select was_manual::text from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000094'$s$, 'true'],
    ['ligne créée non marquée manuelle', 'postgres', $s$select was_manual::text from birthdays where user_id = '00000000-0000-4000-a000-000000000094' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, 'false'],
    ['vraie naissance en 2000 : année connue', 'postgres', $s$select birthdate || ':' || birth_year_known from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000095'$s$, '2000-07-07:true'],
    ['Dan a la ligne d''Alice', 'postgres', $s$select name || ':' || birthdate || ':' || array_to_string(reminder_days, ',') || '|' || reminder_enabled from birthdays where user_id = '00000000-0000-4000-a000-000000000094' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, 'Alice:1990-05-10:|true'],
    ['B accepte', 'postgres', $s$with x as (update friendships set status = 'accepted' where requester_id = '00000000-0000-4000-a000-000000000091' and addressee_id = '00000000-0000-4000-a000-000000000092' returning 1) select count(*) from x$s$, '1'],
    ['année inconnue → 2000, inconnue', 'postgres', $s$select name || ':' || birthdate || ':' || birth_year_known from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000092'$s$, 'Bob:2000-06-15:false'],
    ['B a la ligne d''Alice', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000092' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, '1'],
    ['C accepte (sans date)', 'postgres', $s$with x as (update friendships set status = 'accepted' where requester_id = '00000000-0000-4000-a000-000000000091' and addressee_id = '00000000-0000-4000-a000-000000000093' returning 1) select count(*) from x$s$, '1'],
    ['pas de date : pas de ligne chez A', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '0'],
    ['C a la ligne d''Alice', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000093' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, '1'],

    -- Date de profil
    ['C renseigne sa date', 'C', $s$with x as (update profiles set birthday = '1995-09-09' where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne créée chez A', 'postgres', $s$select name || ':' || birthdate from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, 'Chloé:1995-09-09'],
    ['C change sa date', 'C', $s$with x as (update profiles set birthday = '1995-09-10' where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne mise à jour chez A', 'postgres', $s$select birthdate::text from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '1995-09-10'],
    ['A ne peut pas changer la date liée, mais le nom oui', 'A', $s$update birthdays set birthdate = '2000-01-01', name = 'Chlo' where friend_user_id = '00000000-0000-4000-a000-000000000093' returning name || ':' || birthdate$s$, 'Chlo:1995-09-10'],
    ['B efface sa date', 'B', $s$with x as (update profiles set birthday = null where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne de Bob supprimée chez A', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000092'$s$, '0'],
    ['B remet sa date', 'B', $s$with x as (update profiles set birthday = '1896-06-16' where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne de Bob recréée', 'postgres', $s$select birthdate::text from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000092'$s$, '2000-06-16'],

    -- Suppression par l'utilisateur
    ['A supprime la ligne de Chloé', 'A', $s$with x as (delete from birthdays where friend_user_id = '00000000-0000-4000-a000-000000000093' returning 1) select count(*) from x$s$, '1'],
    ['amitié A–C intacte', 'postgres', $s$select status from friendships where requester_id = '00000000-0000-4000-a000-000000000091' and addressee_id = '00000000-0000-4000-a000-000000000093'$s$, 'accepted'],
    ['trace de suppression', 'postgres', $s$select count(*) from birthday_friend_dismissals where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '1'],
    ['C change sa date : pas recréée', 'C', $s$with x as (update profiles set birthday = '1995-09-11' where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['toujours absente chez A', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '0'],
    ['rattrapage : toujours absente', 'postgres', $s$select count(*) from (select sync_friend_birthday(f.requester_id, f.addressee_id), sync_friend_birthday(f.addressee_id, f.requester_id) from friendships f where f.status = 'accepted') s$s$, '5'],
    ['après rattrapage, absente', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '0'],
    ['C garde la ligne d''Alice', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000093' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, '1'],

    -- Rattrapage
    ['ligne de Dan perdue', 'postgres', $s$with x as (delete from birthdays where user_id = '00000000-0000-4000-a000-000000000094' returning 1) select count(*) from x$s$, '1'],
    ['pas de trace (suppression hors app)', 'postgres', $s$select count(*) from birthday_friend_dismissals where user_id = '00000000-0000-4000-a000-000000000094'$s$, '0'],
    ['rattrapage', 'postgres', $s$select count(*) from (select sync_friend_birthday(f.requester_id, f.addressee_id), sync_friend_birthday(f.addressee_id, f.requester_id) from friendships f where f.status = 'accepted') s$s$, '5'],
    ['Dan retrouve la ligne d''Alice', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000094' and friend_user_id = '00000000-0000-4000-a000-000000000091'$s$, '1'],

    -- Fin d'amitié
    ['A–B refusée', 'postgres', $s$with x as (update friendships set status = 'declined' where requester_id = '00000000-0000-4000-a000-000000000091' and addressee_id = '00000000-0000-4000-a000-000000000092' returning 1) select count(*) from x$s$, '1'],
    ['lignes A–B supprimées des deux côtés', 'postgres', $s$select count(*) from birthdays where (user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000092') or (user_id = '00000000-0000-4000-a000-000000000092' and friend_user_id = '00000000-0000-4000-a000-000000000091')$s$, '0'],
    ['A–C supprimée', 'postgres', $s$with x as (delete from friendships where requester_id = '00000000-0000-4000-a000-000000000091' and addressee_id = '00000000-0000-4000-a000-000000000093' returning 1) select count(*) from x$s$, '1'],
    ['ligne d''Alice supprimée chez C, trace effacée', 'postgres', $s$select (select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000093' and friend_user_id = '00000000-0000-4000-a000-000000000091') || ':' || (select count(*) from birthday_friend_dismissals where user_id = '00000000-0000-4000-a000-000000000091')$s$, '0:0'],
    ['A–C à nouveau amis', 'postgres', $s$insert into friendships (requester_id, addressee_id, status) values ('00000000-0000-4000-a000-000000000093', '00000000-0000-4000-a000-000000000091', 'accepted') returning 1$s$, '1'],
    ['ligne de Chloé recréée chez A', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000093'$s$, '1'],

    -- Ligne convertie : date effacée puis remise
    ['Dan efface sa date', 'D', $s$with x as (update profiles set birthday = null where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne convertie gardée, manuelle, liée', 'postgres', $s$select count(*) || ':' || max(birthdate::text) || ':' || bool_and(friend_user_id is null) || ':' || bool_and(was_manual = false) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and linked_profile_id = '00000000-0000-4000-a000-000000000094'$s$, '1:1985-03-03:true:true'],
    ['Dan remet sa date', 'D', $s$with x as (update profiles set birthday = '1985-03-04' where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['ligne reconvertie', 'postgres', $s$select count(*) || ':' || max(birthdate::text) || ':' || bool_and(friend_user_id is not null) || ':' || bool_and(was_manual) from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and linked_profile_id = '00000000-0000-4000-a000-000000000094'$s$, '1:1985-03-04:true:true'],

    -- Envoi et blocage
    ['Dan et Emma : anniversaire aujourd''hui', 'postgres', $s$with x as (update profiles set birthday = make_date(1990, extract(month from current_date)::int, extract(day from current_date)::int) where id in ('00000000-0000-4000-a000-000000000094', '00000000-0000-4000-a000-000000000095') returning 1) select count(*) from x$s$, '2'],
    ['A bloque Emma', 'postgres', $s$insert into user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-a000-000000000091', '00000000-0000-4000-a000-000000000095') returning 1$s$, '1'],
    ['envoi', 'postgres', $s$select inserted_count >= 1 from create_birthday_today_notifications()$s$, 'true'],
    ['A prévenue pour Dan seulement', 'postgres', $s$select string_agg(data->>'birthday_name', ',') from notifications where user_id = '00000000-0000-4000-a000-000000000091' and type = 'birthday_reminder'$s$, 'Dany'],

    -- Fin d'amitié avec une ligne convertie
    ['A–D supprimée', 'postgres', $s$with x as (delete from friendships where requester_id = '00000000-0000-4000-a000-000000000094' and addressee_id = '00000000-0000-4000-a000-000000000091' returning 1) select count(*) from x$s$, '1'],
    ['Dany redevient manuelle, déliée, dernière date', 'postgres', $s$select name || ':' || birthdate || ':' || (friend_user_id is null) || ':' || (linked_profile_id is null) || ':' || was_manual from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and name = 'Dany'$s$, 'Dany:' || make_date(1990, extract(month from current_date)::int, extract(day from current_date)::int)::text || ':true:true:false'],
    ['ligne automatique d''Alice supprimée chez Dan', 'postgres', $s$select count(*) from birthdays where user_id = '00000000-0000-4000-a000-000000000094'$s$, '0'],
    ['A modifie la date de Dany', 'A', $s$update birthdays set birthdate = '1985-01-01' where name = 'Dany' returning birthdate::text$s$, '1985-01-01'],

    -- Droits
    ['A ne lit pas les traces', 'A', 'select count(*) from birthday_friend_dismissals', 'ERR 42501'],
    ['A ne lance pas la synchro', 'A', $s$select sync_friend_birthday(auth.uid(), '00000000-0000-4000-a000-000000000094')$s$, 'ERR 42501'],
    ['trace sans amitié refusée', 'A', $s$select count(*) from (select record_friend_birthday_dismissal('00000000-0000-4000-a000-000000000092')) s$s$, '1'],
    ['… et sans effet', 'postgres', $s$select count(*) from birthday_friend_dismissals where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000092'$s$, '0'],

    -- Compte supprimé
    ['compte d''Emma supprimé', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000095' returning 1) select count(*) from x$s$, '1'],
    ['ligne d''Emma supprimée chez A', 'postgres', $s$select count(*) from birthdays where friend_user_id = '00000000-0000-4000-a000-000000000095'$s$, '0'],
    ['Fifi convertie', 'postgres', $s$select birthdate || ':' || was_manual from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and friend_user_id = '00000000-0000-4000-a000-000000000096'$s$, '1993-08-08:true'],
    ['compte de Fanny supprimé', 'postgres', $s$with x as (delete from auth.users where id = '00000000-0000-4000-a000-000000000096' returning 1) select count(*) from x$s$, '1'],
    ['Fifi redevient manuelle, déliée, dernière date', 'postgres', $s$select name || ':' || birthdate || ':' || (friend_user_id is null) || ':' || (linked_profile_id is null) || ':' || was_manual from birthdays where user_id = '00000000-0000-4000-a000-000000000091' and name = 'Fifi'$s$, 'Fifi:1993-08-08:true:true:false'],

    -- Ancien rappel J-7
    ['tâche friend-birthday-reminders supprimée', 'postgres', $s$select count(*) from cron.job where jobname = 'friend-birthday-reminders'$s$, '0'],
    ['fonction supprimée', 'postgres', $s$select to_regprocedure('public.send_friend_birthday_reminders()') is null$s$, 'true']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-fb-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-fb-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-fb-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-fb-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-fb-e@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-fb-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'A' then A when 'B' then B when 'C' then C when 'D' then D when 'E' then E when 'F' then F end;
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
