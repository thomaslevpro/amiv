-- Vérification de 20261102140000 : un +1 accepté compte comme un participant
-- (compteurs, liste « +1 de … », écran d'invitation reçue) et disparaît quand
-- l'organisateur le retire ou quand la personne qui l'amène décline.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/plus_one_guests_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000071';
  A uuid := '00000000-0000-4000-a000-000000000072';
  B uuid := '00000000-0000-4000-a000-000000000073';
  F uuid := '00000000-0000-4000-a000-000000000074';
  X uuid := '00000000-0000-4000-a000-000000000075';
  cases text[][] := array[
    -- O organise EV, invite A (Lola Martin) et B ; F co-organisateur.
    ['événement', 'postgres', $s$with e as (insert into events(id, name, user_id, invite_token) values ('00000000-0000-4000-e000-000000000071', 'Dry +1', '00000000-0000-4000-a000-000000000071', '00000000-0000-4000-c000-000000000071') returning 1) select count(*) from e$s$, '1'],
    ['profils', 'postgres', $s$with p as (update profiles set first_name = case id when '00000000-0000-4000-a000-000000000072' then 'Lola' when '00000000-0000-4000-a000-000000000073' then 'Bruno' else 'Olivia' end, name = case id when '00000000-0000-4000-a000-000000000072' then 'Martin' else '' end where id in ('00000000-0000-4000-a000-000000000071', '00000000-0000-4000-a000-000000000072', '00000000-0000-4000-a000-000000000073', '00000000-0000-4000-a000-000000000074') returning 1) select count(*) from p$s$, '4'],
    ['F co-organisateur', 'postgres', $s$insert into event_organizers(event_id, user_id, role, status) values ('00000000-0000-4000-e000-000000000071', '00000000-0000-4000-a000-000000000074', 'co_organizer', 'approved') returning 1$s$, '1'],
    ['O invite A B', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000071', array['00000000-0000-4000-a000-000000000072', '00000000-0000-4000-a000-000000000073']::uuid[])) x$s$, '1'],
    ['A accepte', 'A', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'going') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['B accepte', 'B', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'going') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],

    -- Demande en attente : pas encore comptée
    ['A demande un +1 (Marc)', 'A', $s$with r as (update rsvps set plus_one_requested = true, plus_one_status = 'pending', plus_one_name = 'Marc', plus_one_message = 'Mon copain' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = auth.uid() returning 1) select count(*) from r$s$, '1'],
    ['O notifié de la demande', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000071' and type = 'plus_one_request' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['notification : Prénom Nom', 'postgres', $s$select title from notifications where user_id = '00000000-0000-4000-a000-000000000071' and type = 'plus_one_request' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, 'Lola Martin veut amener un +1'],
    ['en attente : pas compté', 'O', $s$select total || ',' || confirmed from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '4,4'],
    ['en attente : pas dans la liste', 'O', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, '0'],
    ['A ne peut pas accepter son +1', 'A', $s$update rsvps set plus_one_status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = auth.uid() returning 1$s$, 'ERR 42501'],

    -- L'organisateur accepte
    ['O accepte le +1', 'O', $s$with r as (update rsvps set plus_one_status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = '00000000-0000-4000-a000-000000000072' returning 1) select count(*) from r$s$, '1'],
    ['A notifiée : accepté', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'plus_one_response' and data->>'status' = 'accepted'$s$, '1'],
    ['compteurs (O) : +1 compté', 'O', $s$select total || ',' || confirmed || ',' || maybe || ',' || pending || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '5,5,0,0,0'],
    ['compteurs (B invité) identiques', 'B', $s$select total || ',' || confirmed || ',' || maybe || ',' || pending || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '5,5,0,0,0'],
    ['aperçu : comptes seulement', 'B', $s$select jsonb_array_length(preview) || ',' || count(*) filter (where (preview->0->>'id') is null) from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[]) group by preview$s$, '3,0'],
    ['liste (B) : ligne +1', 'B', $s$select (guest_key like 'plus1_%') || ',' || display_name || ',' || plus_one_of || ',' || status || ',' || plus_one_host_key || ',' || plus_one_source || ',' || coalesce(plus_one_rsvp_id::text, 'masqué') || ',' || coalesce(user_id::text, 'sans compte') from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, 'true,Marc,Lola,confirmed,00000000-0000-4000-a000-000000000072,rsvps,masqué,sans compte'],
    ['liste (O) : id du +1 visible', 'O', $s$select (plus_one_rsvp_id = (select id from rsvps where event_id = '00000000-0000-4000-e000-000000000071' and user_id = '00000000-0000-4000-a000-000000000072'))::text from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, 'true'],
    ['liste (F co-org) : id visible', 'F', $s$select count(plus_one_rsvp_id) from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, '1'],
    ['guest_key uniques', 'O', $s$select (count(*) = count(distinct guest_key))::text from get_event_guest_list('00000000-0000-4000-e000-000000000071')$s$, 'true'],
    ['écran invitation reçue : 5 confirmés', 'anon', $s$select confirmed_count from get_event_by_share_token('00000000-0000-4000-c000-000000000071')$s$, '5'],
    ['X étranger : rien', 'X', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000071')$s$, '0'],
    ['statuts internes inaccessibles', 'A', $s$select count(*) from event_guest_statuses(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, 'ERR 42501'],
    ['chat : le +1 n''y est pas', 'postgres', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000071') g where g.role = 'plus_one' and g.user_id is not null$s$, '0'],

    -- Le +1 suit le statut de la personne qui l'amène
    ['A passe à peut-être', 'A', $s$with i as (update invitations set status = 'maybe' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (update rsvps set status = 'pending' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = auth.uid() returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['+1 peut-être aussi', 'O', $s$select total || ',' || confirmed || ',' || maybe from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '5,3,2'],
    ['A décline', 'A', $s$with r as (update rsvps set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = auth.uid() returning 1) select count(*) from r$s$, '1'],
    ['A décline : +1 disparu', 'O', $s$select total || ',' || confirmed || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '4,3,1'],
    ['A décline : liste sans +1', 'B', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, '0'],
    ['A décline : invitation reçue 3', 'anon', $s$select confirmed_count from get_event_by_share_token('00000000-0000-4000-c000-000000000071')$s$, '3'],
    ['A revient', 'A', $s$with r as (update rsvps set status = 'going' where event_id = '00000000-0000-4000-e000-000000000071' and user_id = auth.uid() returning 1) select count(*) from r$s$, '1'],
    ['A revient : +1 de retour', 'O', $s$select total || ',' || confirmed from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '5,5'],

    -- L'organisateur retire le +1
    ['F retire le +1', 'F', $s$with r as (update rsvps set plus_one_status = 'declined' where id = (select plus_one_rsvp_id from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one') returning 1) select count(*) from r$s$, '1'],
    ['retiré : plus compté', 'B', $s$select total || ',' || confirmed from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '4,4'],
    ['retiré : A notifiée', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'plus_one_response' and data->>'status' = 'declined'$s$, '1'],

    -- +1 sans prénom (effacé par la rétention) : « +1 de Lola »
    ['+1 accepté sans prénom', 'postgres', $s$with r as (update rsvps set plus_one_status = 'accepted', plus_one_name = null where event_id = '00000000-0000-4000-e000-000000000071' and user_id = '00000000-0000-4000-a000-000000000072' returning 1) select count(*) from r$s$, '1'],
    ['nom de repli', 'B', $s$select display_name from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, '+1 de Lola'],

    -- +1 d'une personne venue par le lien public
    ['Paul (lien) vient avec Julie', 'postgres', $s$insert into guest_rsvps(event_id, guest_name, guest_email, response, plus_one_requested, plus_one_status, plus_one_name) values ('00000000-0000-4000-e000-000000000071', 'Paul', 'paul@amiv.test', 'yes', true, 'accepted', 'Julie') returning 1$s$, '1'],
    ['Julie dans la liste', 'B', $s$select display_name || ',' || plus_one_of || ',' || plus_one_source || ',' || (plus_one_host_key like 'link_%') from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one' and plus_one_of = 'Paul'$s$, 'Julie,Paul,guest_rsvps,true'],
    ['compteurs avec Paul + Julie', 'O', $s$select total || ',' || confirmed from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '7,7'],
    ['Paul ne vient plus', 'postgres', $s$with g as (update guest_rsvps set response = 'no' where event_id = '00000000-0000-4000-e000-000000000071' returning 1) select count(*) from g$s$, '1'],
    ['Julie disparaît', 'O', $s$select total || ',' || confirmed || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '6,5,1'],

    -- Retirer l'invitation de A retire aussi son +1
    ['O retire A', 'O', $s$select count(*) from (select remove_event_invitation((select id from invitations where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = '00000000-0000-4000-a000-000000000072'))) x$s$, '1'],
    ['plus de +1', 'O', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000071') where role = 'plus_one'$s$, '0'],
    ['compteurs finaux', 'O', $s$select total || ',' || confirmed || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000071']::uuid[])$s$, '4,3,1']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-po-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-po-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-po-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-po-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-po-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'F' then F when 'X' then X end;
    begin
      if who = 'anon' then
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-po-' || lower(who) || '@amiv.test')::text, true);
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
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
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
