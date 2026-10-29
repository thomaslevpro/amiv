-- Vérification des réglages de notification (20261101130000) : tous
-- activés pour les comptes existants et pour un nouveau compte, valeur vide
-- refusée, un utilisateur peut toujours les couper.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/notification_settings_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère un faux compte dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  A uuid := '00000000-0000-4000-a000-000000000041';
  cases text[][] := array[
    ['aucun compte avec un réglage coupé ou vide', 'postgres', $s$select count(*) from profiles where notif_birthdays is not true or notif_invitations is not true or notif_messages is not true$s$, '0'],
    ['colonnes NOT NULL, défaut true', 'postgres', $s$select string_agg(column_name || ':' || is_nullable || ':' || column_default, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('notif_birthdays', 'notif_invitations', 'notif_messages')$s$, 'notif_birthdays:NO:true,notif_invitations:NO:true,notif_messages:NO:true'],
    ['nouveau compte : profil créé', 'postgres', $s$select count(*) from profiles where id = '00000000-0000-4000-a000-000000000041'$s$, '1'],
    ['nouveau compte : trois réglages activés', 'postgres', $s$select notif_birthdays::text || notif_invitations::text || notif_messages::text from profiles where id = '00000000-0000-4000-a000-000000000041'$s$, 'truetruetrue'],
    ['nouveau compte : push message autorisé', 'postgres', $s$select push_allowed('00000000-0000-4000-a000-000000000041', 'message_received')$s$, 'true'],
    ['A coupe les messages', 'A', $s$with x as (update profiles set notif_messages = false where id = '00000000-0000-4000-a000-000000000041' returning 1) select count(*) from x$s$, '1'],
    ['choix de A conservé', 'postgres', $s$select notif_messages from profiles where id = '00000000-0000-4000-a000-000000000041'$s$, 'false'],
    ['valeur vide refusée', 'A', $s$update profiles set notif_birthdays = null where id = '00000000-0000-4000-a000-000000000041' returning 1$s$, 'ERR 23502']
  ];
  i int; who text; res text; out text := ''; fails int := 0;
begin
  -- Staging n'a pas le trigger de création de profil (schéma auth non
  -- copié) : on l'ajoute le temps du test, comme en prod.
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (A, 'dry-ns@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    begin
      if who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', A::text, true);
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
