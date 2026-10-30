-- Vérification de 20261102100000 : carte « Bien démarrer » masquable et
-- rappel aux amis 7 jours avant un anniversaire.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/onboarding_getting_started_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000071';
  B uuid := '00000000-0000-4000-a000-000000000072';
  C uuid := '00000000-0000-4000-a000-000000000073';
  D uuid := '00000000-0000-4000-a000-000000000074';
  E uuid := '00000000-0000-4000-a000-000000000075';
  cases text[][] := array[
    -- Carte « Bien démarrer »
    ['A masque la carte', 'A', $s$with x as (update profiles set getting_started_dismissed_at = now() where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['A ne masque pas celle de B', 'A', $s$with x as (update profiles set getting_started_dismissed_at = now() where id = '00000000-0000-4000-a000-000000000072' returning 1) select count(*) from x$s$, '0'],
    ['lecture via get_my_profile', 'A', $s$select getting_started_dismissed_at is not null from get_my_profile()$s$, 'true'],
    ['colonne privée (pas de select direct)', 'B', $s$select getting_started_dismissed_at from profiles where id = '00000000-0000-4000-a000-000000000071'$s$, 'ERR 42501'],

    -- Données : anniversaire de A dans 7 jours, année inconnue (1896)
    ['prénoms', 'postgres', $s$with x as (update profiles set first_name = case id when '00000000-0000-4000-a000-000000000071' then 'Alice' when '00000000-0000-4000-a000-000000000075' then 'Emma' else 'Ami' end where id in ('00000000-0000-4000-a000-000000000071','00000000-0000-4000-a000-000000000072','00000000-0000-4000-a000-000000000073','00000000-0000-4000-a000-000000000074','00000000-0000-4000-a000-000000000075') returning 1) select count(*) from x$s$, '5'],
    ['A : anniversaire dans 7 jours', 'postgres', $s$with x as (update profiles set birthday = make_date(1896, extract(month from current_date + 7)::int, extract(day from current_date + 7)::int) where id = '00000000-0000-4000-a000-000000000071' returning 1) select count(*) from x$s$, '1'],
    ['E : anniversaire dans 8 jours', 'postgres', $s$with x as (update profiles set birthday = (current_date + 8 - interval '30 years')::date where id = '00000000-0000-4000-a000-000000000075' returning 1) select count(*) from x$s$, '1'],
    ['amitiés', 'postgres', $s$with x as (insert into friendships (requester_id, addressee_id, status) values
        ('00000000-0000-4000-a000-000000000071', '00000000-0000-4000-a000-000000000072', 'accepted'),
        ('00000000-0000-4000-a000-000000000073', '00000000-0000-4000-a000-000000000071', 'pending'),
        ('00000000-0000-4000-a000-000000000074', '00000000-0000-4000-a000-000000000071', 'accepted'),
        ('00000000-0000-4000-a000-000000000075', '00000000-0000-4000-a000-000000000072', 'accepted') returning 1) select count(*) from x$s$, '4'],
    ['A bloque D', 'postgres', $s$insert into user_blocks (blocker_id, blocked_id) values ('00000000-0000-4000-a000-000000000071', '00000000-0000-4000-a000-000000000074') returning 1$s$, '1'],

    -- Droits
    ['sans compte : refusé', 'anon', 'select send_friend_birthday_reminders()', 'ERR 42501'],
    ['connecté : refusé', 'B', 'select send_friend_birthday_reminders()', 'ERR 42501'],

    -- Envoi
    ['un seul rappel (B)', 'postgres', 'select send_friend_birthday_reminders()', '1'],
    ['B prévenu pour Alice', 'postgres', $s$select title || ' | ' || (data->>'reminder_day') || ' | ' || (data->>'reminder_date') from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'birthday_reminder'$s$, 'L''anniversaire de Alice est dans 7 jours 🎂 | 7 | ' || (current_date + 7)::text],
    ['C (demande en attente) non prévenu', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000073' and type = 'birthday_reminder'$s$, '0'],
    ['D (bloqué) non prévenu', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000074' and type = 'birthday_reminder'$s$, '0'],
    ['A non prévenu de son propre anniversaire', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000071' and type = 'birthday_reminder'$s$, '0'],
    ['pas de doublon au 2e passage', 'postgres', 'select send_friend_birthday_reminders()', '0'],
    ['B voit sa notification', 'B', $s$select count(*) from notifications where type = 'birthday_reminder'$s$, '1'],
    ['push suit notif_birthdays', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000072', 'birthday_reminder')$s$, 'true'],
    ['B coupe les anniversaires', 'B', $s$with x as (update profiles set notif_birthdays = false where id = auth.uid() returning 1) select count(*) from x$s$, '1'],
    ['push bloqué', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000072', 'birthday_reminder')$s$, 'false'],

    ['tâche planifiée active', 'postgres', $s$select schedule || ':' || active from cron.job where jobname = 'friend-birthday-reminders'$s$, '0 8 * * *:true']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-ob-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-ob-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-ob-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-ob-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-ob-e@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

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
