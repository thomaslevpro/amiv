-- Vérification de 20261101180000 + 20261101200000 : la conversation d'un
-- événement est réservée aux organisateurs et aux invités qui ont accepté ou
-- répondu « peut-être ». Invitation en attente ou refus : pas de conversation dans la messagerie,
-- messages illisibles, écriture refusée, aucune notification de message
-- (donc aucun push). Seule l'invitation notifie.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_chat_members_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000071';
  A uuid := '00000000-0000-4000-a000-000000000072';
  B uuid := '00000000-0000-4000-a000-000000000073';
  M uuid := '00000000-0000-4000-a000-000000000074';
  D uuid := '00000000-0000-4000-a000-000000000075';
  F uuid := '00000000-0000-4000-a000-000000000076';
  X uuid := '00000000-0000-4000-a000-000000000077';
  cases text[][] := array[
    ['événement (anniversaire)', 'postgres', $s$with e as (insert into events(id, name, type, user_id) values ('00000000-0000-4000-e000-000000000071', 'Dry chat', 'Anniversaire', '00000000-0000-4000-a000-000000000071') returning 1) select count(*) from e$s$, '1'],
    ['F co-organisateur', 'postgres', $s$insert into event_organizers(event_id, user_id, role, status) values ('00000000-0000-4000-e000-000000000071', '00000000-0000-4000-a000-000000000076', 'co_organizer', 'approved') returning 1$s$, '1'],
    ['O invite A B M D', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000071', array['00000000-0000-4000-a000-000000000072', '00000000-0000-4000-a000-000000000073', '00000000-0000-4000-a000-000000000074', '00000000-0000-4000-a000-000000000075']::uuid[])) x$s$, '1'],
    ['A notifié de l''invitation', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'event_invitation' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['O écrit (1er message)', 'O', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'avant', false) returning 1$s$, '1'],
    ['A en attente : aucune notification de message', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['A en attente : pas de conversation', 'A', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['A en attente : messages illisibles (table)', 'A', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071' and is_secret = false$s$, '0'],
    ['A en attente : messages illisibles (RPC)', 'A', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000071', false)$s$, '0'],
    ['A en attente : chat fermé', 'A', $s$select public.can_access_event_chat('00000000-0000-4000-e000-000000000071')::text$s$, 'false'],
    ['A en attente : ne peut pas écrire', 'A', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'intrus', false) returning 1$s$, 'ERR 42501'],
    ['A en attente : espace secret fermé', 'A', $s$select public.can_access_secret_space('00000000-0000-4000-e000-000000000071')::text$s$, 'false'],
    ['D ouvre sans répondre (rsvp pending)', 'D', $s$insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'pending') returning 1$s$, '1'],
    ['D : pas de conversation', 'D', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['D : messages illisibles', 'D', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071' and is_secret = false$s$, '0'],
    ['notification de message forcée pour A -> ignorée', 'postgres', $s$with n as (insert into notifications(user_id, type, title, body, data, read) values ('00000000-0000-4000-a000-000000000072', 'message_received', 't', 'b', jsonb_build_object('event_id', '00000000-0000-4000-e000-000000000071'), false) returning 1) select count(*) from n$s$, '0'],
    ['invitation forcée pour A -> gardée', 'postgres', $s$with n as (insert into notifications(user_id, type, title, body, data, read) values ('00000000-0000-4000-a000-000000000072', 'event_invitation', 't', 'b', jsonb_build_object('event_id', '00000000-0000-4000-e000-000000000071'), false) returning 1) select count(*) from n$s$, '1'],
    ['O : conversation visible', 'O', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['F co-organisateur : conversation visible', 'F', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['F : messages lisibles', 'F', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071' and is_secret = false$s$, '1'],
    ['F notifié du 1er message', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000076' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['A accepte', 'A', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'going') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['A : conversation visible', 'A', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['A : historique lisible (table)', 'A', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071' and is_secret = false$s$, '1'],
    ['A : historique lisible (RPC)', 'A', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000071', false)$s$, '1'],
    ['A : chat ouvert', 'A', $s$select public.can_access_event_chat('00000000-0000-4000-e000-000000000071')::text$s$, 'true'],
    ['A : espace secret ouvert', 'A', $s$select public.can_access_secret_space('00000000-0000-4000-e000-000000000071')::text$s$, 'true'],
    ['A écrit', 'A', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'merci', false) returning 1$s$, '1'],
    ['B refuse', 'B', $s$with i as (update invitations set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'declined') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['M peut-être', 'M', $s$with i as (update invitations set status = 'maybe' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'pending') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['O écrit (2e message)', 'O', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'apres', false) returning 1$s$, '1'],
    ['A notifié du 2e message seulement', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000072' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['O notifié du message de A', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000071' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['B refus : aucune notification', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000073' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['M peut-être : notifié du 2e message', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000074' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['D en attente : aucune notification', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000075' and type = 'message_received' and data->>'event_id' = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['B refus : pas de conversation', 'B', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['B refus : messages illisibles', 'B', $s$select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071' and is_secret = false$s$, '0'],
    ['B refus : ne peut pas écrire', 'B', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'x', false) returning 1$s$, 'ERR 42501'],
    ['M peut-être : conversation visible', 'M', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['M peut-être : historique lisible', 'M', $s$select count(*) from get_event_messages('00000000-0000-4000-e000-000000000071', false)$s$, '3'],
    ['M peut-être : chat ouvert', 'M', $s$select public.can_access_event_chat('00000000-0000-4000-e000-000000000071')::text$s$, 'true'],
    ['M peut-être : espace secret ouvert', 'M', $s$select public.can_access_secret_space('00000000-0000-4000-e000-000000000071')::text$s$, 'true'],
    ['M peut-être : écrit', 'M', $s$insert into messages(event_id, user_id, content, is_secret) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'peut-etre', false) returning 1$s$, '1'],
    ['M peut-être puis refuse', 'M', $s$with i as (update invitations set status = 'declined' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'declined') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['M refus : conversation retirée', 'M', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '0'],
    ['X étranger : rien', 'X', $s$select (select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071') + (select count(*) from messages where event_id = '00000000-0000-4000-e000-000000000071')$s$, '0'],
    ['A passe en peut-être', 'A', $s$with i as (update invitations set status = 'maybe' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'pending') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['A peut-être : conversation gardée', 'A', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['A réaccepte', 'A', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000071', auth.uid(), 'going') on conflict (event_id, user_id) do update set status = excluded.status returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['A : conversation revenue', 'A', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['D accepte via invitation seule (sans rsvps)', 'postgres', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000071' and invited_user_id = '00000000-0000-4000-a000-000000000075' returning 1), r as (delete from rsvps where event_id = '00000000-0000-4000-e000-000000000071' and user_id = '00000000-0000-4000-a000-000000000075' returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['D : conversation visible', 'D', $s$select count(*) from get_my_event_conversation_ids() x where x = '00000000-0000-4000-e000-000000000071'$s$, '1'],
    ['fonction interne inaccessible', 'A', $s$select public.is_event_chat_member('00000000-0000-4000-e000-000000000071', '00000000-0000-4000-a000-000000000072')::text$s$, 'ERR 42501']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-ch-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-ch-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-ch-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (M, 'dry-ch-m@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-ch-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-ch-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-ch-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'M' then M when 'D' then D when 'F' then F when 'X' then X end;
    begin
      if who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-ch-' || lower(who) || '@amiv.test')::text, true);
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
