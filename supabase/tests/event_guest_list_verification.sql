-- Vérification de 20261101160000 : liste des invités et compteurs depuis la
-- même source, organisateur jamais invité, nom affiché (nom, @pseudo,
-- « Utilisateur Amiv »), relance une fois par 24 h, retrait d'une invitation.
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/event_guest_list_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées. Il insère de faux comptes dans
-- auth.users : à lancer sur staging uniquement.

do $dry$
declare
  O uuid := '00000000-0000-4000-a000-000000000061';
  A uuid := '00000000-0000-4000-a000-000000000062';
  B uuid := '00000000-0000-4000-a000-000000000063';
  C uuid := '00000000-0000-4000-a000-000000000064';
  D uuid := '00000000-0000-4000-a000-000000000065';
  E uuid := '00000000-0000-4000-a000-000000000066';
  F uuid := '00000000-0000-4000-a000-000000000067';
  X uuid := '00000000-0000-4000-a000-000000000068';
  cases text[][] := array[
    -- O organise EV. Profils : A nom « L » + pseudo, B rien, C nom complet.
    ['événement', 'postgres', $s$with e as (insert into events(id, name, user_id, invite_token) values ('00000000-0000-4000-e000-000000000061', 'Dry guests', '00000000-0000-4000-a000-000000000061', '00000000-0000-4000-c000-000000000061') returning 1) select count(*) from e$s$, '1'],
    ['profils', 'postgres', $s$with p as (update profiles set name = case id when '00000000-0000-4000-a000-000000000062' then 'L' when '00000000-0000-4000-a000-000000000064' then 'Chloé Martin' when '00000000-0000-4000-a000-000000000061' then 'Olivia' else '' end, first_name = null, username = case id when '00000000-0000-4000-a000-000000000062' then 'lea' else null end where id in ('00000000-0000-4000-a000-000000000061', '00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000064') returning 1) select count(*) from p$s$, '4'],
    ['F co-organisateur', 'postgres', $s$insert into event_organizers(event_id, user_id, role, status) values ('00000000-0000-4000-e000-000000000061', '00000000-0000-4000-a000-000000000067', 'co_organizer', 'approved') returning 1$s$, '1'],

    -- L'organisateur ne peut pas être invité
    ['O s''invite (insert) -> refusé', 'O', $s$insert into invitations(event_id, invited_user_id, invited_by, status) values ('00000000-0000-4000-e000-000000000061', '00000000-0000-4000-a000-000000000061', '00000000-0000-4000-a000-000000000061', 'pending') returning 1$s$, 'ERR 23514'],
    ['F invite O (insert) -> refusé', 'F', $s$insert into invitations(event_id, invited_user_id, invited_by, status) values ('00000000-0000-4000-e000-000000000061', '00000000-0000-4000-a000-000000000061', '00000000-0000-4000-a000-000000000067', 'pending') returning 1$s$, 'ERR 23514'],
    ['F invite O par email -> refusé', 'F', $s$insert into invitations(event_id, invited_email, invited_by, status) values ('00000000-0000-4000-e000-000000000061', 'dry-gl-o@amiv.test', '00000000-0000-4000-a000-000000000067', 'pending') returning 1$s$, 'ERR 23514'],
    ['F invite O (RPC) -> ignoré', 'F', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000061', array['00000000-0000-4000-a000-000000000061']::uuid[])) x where not exists (select 1 from invitations where event_id = '00000000-0000-4000-e000-000000000061')$s$, '1'],
    ['O invite O A B C D (RPC)', 'O', $s$select count(*) from (select public.invite_friends_to_event('00000000-0000-4000-e000-000000000061', array['00000000-0000-4000-a000-000000000061', '00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000064', '00000000-0000-4000-a000-000000000065']::uuid[])) x$s$, '1'],
    ['4 invitations, pas O', 'postgres', $s$select count(*) || ',' || count(*) filter (where invited_user_id = '00000000-0000-4000-a000-000000000061') from invitations where event_id = '00000000-0000-4000-e000-000000000061'$s$, '4,0'],
    ['A ne peut pas devenir O (update)', 'postgres', $s$update invitations set invited_user_id = '00000000-0000-4000-a000-000000000061' where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000062' returning 1$s$, 'ERR 23514'],

    -- Réponses
    ['A accepte', 'A', $s$with i as (update invitations set status = 'accepted' where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000061', auth.uid(), 'going') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['B peut-être', 'B', $s$with i as (update invitations set status = 'maybe' where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = auth.uid() returning 1), r as (insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000061', auth.uid(), 'pending') returning 1) select (select count(*) from i) + (select count(*) from r)$s$, '2'],
    ['C refuse (rsvp seul)', 'C', $s$insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000061', auth.uid(), 'declined') returning 1$s$, '1'],
    ['D ouvre sans répondre', 'D', $s$insert into rsvps(event_id, user_id, status) values ('00000000-0000-4000-e000-000000000061', auth.uid(), 'pending') returning 1$s$, '1'],
    ['E rejoint via le lien', 'E', $s$select (public.accept_invite_by_token('00000000-0000-4000-c000-000000000061', 'going') is not null)::text$s$, 'true'],
    ['invitation email sans compte', 'O', $s$insert into invitations(event_id, invited_email, invited_by, status) values ('00000000-0000-4000-e000-000000000061', 'personne@amiv.test', '00000000-0000-4000-a000-000000000061', 'pending') returning 1$s$, '1'],
    ['réponse via lien public', 'postgres', $s$insert into guest_rsvps(event_id, guest_name, guest_email, response) values ('00000000-0000-4000-e000-000000000061', 'Paul', 'paul@amiv.test', 'yes') returning 1$s$, '1'],

    -- Compteurs : O F A E Paul confirmés, B peut-être, D + email en attente, C décliné
    ['compteurs (O)', 'O', $s$select total || ',' || confirmed || ',' || maybe || ',' || pending || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '9,5,1,2,1'],
    ['compteurs (A invité) identiques', 'A', $s$select total || ',' || confirmed || ',' || maybe || ',' || pending || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '9,5,1,2,1'],
    ['compteurs (C a refusé) identiques', 'C', $s$select total || ',' || confirmed || ',' || maybe || ',' || pending || ',' || declined from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '9,5,1,2,1'],
    ['compteurs (X étranger) : rien', 'X', $s$select count(*) from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '0'],
    ['aperçu : 3 confirmés, O d''abord', 'A', $s$select jsonb_array_length(preview) || ',' || (preview->0->>'id') from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '3,00000000-0000-4000-a000-000000000061'],
    ['statuts internes inaccessibles', 'A', $s$select count(*) from event_guest_statuses(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, 'ERR 42501'],

    -- Liste
    ['liste (X étranger) : rien', 'X', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000061')$s$, '0'],
    ['liste (A) : 9 lignes', 'A', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000061')$s$, '9'],
    ['O une seule fois, organisateur confirmé', 'A', $s$select string_agg(role || ':' || status, ',') from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000061'$s$, 'owner:confirmed'],
    ['F co-organisateur confirmé', 'A', $s$select role || ':' || status from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000067'$s$, 'co_organizer:confirmed'],
    ['statuts A B C D E', 'A', $s$select string_agg(status, ',' order by user_id) from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id in ('00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000064', '00000000-0000-4000-a000-000000000065', '00000000-0000-4000-a000-000000000066')$s$, 'confirmed,maybe,declined,pending,confirmed'],
    ['nom « L » -> @pseudo', 'A', $s$select display_name from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000062'$s$, '@lea'],
    ['sans nom ni pseudo -> Utilisateur Amiv', 'A', $s$select display_name from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000063'$s$, 'Utilisateur Amiv'],
    ['nom complet', 'A', $s$select display_name from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000064'$s$, 'Chloé Martin'],
    ['email masqué pour A', 'A', $s$select display_name || ',' || status from get_event_guest_list('00000000-0000-4000-e000-000000000061') where role = 'email_guest'$s$, 'Invité par e-mail,pending'],
    ['email visible pour O', 'O', $s$select display_name from get_event_guest_list('00000000-0000-4000-e000-000000000061') where role = 'email_guest'$s$, 'personne@amiv.test'],
    ['invité via lien public', 'A', $s$select display_name || ',' || status from get_event_guest_list('00000000-0000-4000-e000-000000000061') where role = 'link_guest'$s$, 'Paul,confirmed'],
    ['A ne voit pas les invitation_id', 'A', $s$select count(invitation_id) from get_event_guest_list('00000000-0000-4000-e000-000000000061')$s$, '0'],
    ['O voit les invitation_id', 'O', $s$select count(invitation_id) from get_event_guest_list('00000000-0000-4000-e000-000000000061')$s$, '6'],

    -- Relance : une fois par 24 h
    ['O relance D', 'O', $s$select remind_invitations(array(select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065'), null)$s$, '1'],
    ['D notifié', 'postgres', $s$select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000065' and type = 'invitation_reminder'$s$, '1'],
    ['seconde relance immédiate -> rien', 'O', $s$select remind_invitations(array(select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065'), null)$s$, '0'],
    ['reminded_at visible pour O', 'O', $s$select (reminded_at is not null)::text from get_event_guest_list('00000000-0000-4000-e000-000000000061') where user_id = '00000000-0000-4000-a000-000000000065'$s$, 'true'],
    ['25 h passent', 'postgres', $s$with x as (update invitations set reminded_at = now() - interval '25 hours' where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065' returning 1) select count(*) from x$s$, '1'],
    ['relance possible après 24 h', 'O', $s$select remind_invitations(array(select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065'), null)$s$, '1'],
    ['A ne peut pas relancer', 'A', $s$select remind_invitations(array(select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = auth.uid()), null)$s$, 'ERR 42501'],

    -- Retrait
    ['A ne peut pas retirer', 'A', $s$select count(*) from (select remove_event_invitation((select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = auth.uid()))) x$s$, 'ERR 42501'],
    ['O retire D', 'O', $s$select count(*) from (select remove_event_invitation((select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065'))) x$s$, '1'],
    ['D : invitation, rsvp et notifs non lues supprimées', 'postgres', $s$select (select count(*) from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_user_id = '00000000-0000-4000-a000-000000000065') + (select count(*) from rsvps where event_id = '00000000-0000-4000-e000-000000000061' and user_id = '00000000-0000-4000-a000-000000000065') + (select count(*) from notifications where user_id = '00000000-0000-4000-a000-000000000065' and not read and data->>'event_id' = '00000000-0000-4000-e000-000000000061')$s$, '0'],
    ['D ne voit plus la liste', 'D', $s$select count(*) from get_event_guest_list('00000000-0000-4000-e000-000000000061')$s$, '0'],
    ['compteurs après retrait', 'O', $s$select total || ',' || pending from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '8,1'],
    ['O retire l''invitation email', 'O', $s$select count(*) from (select remove_event_invitation((select id from invitations where event_id = '00000000-0000-4000-e000-000000000061' and invited_email = 'personne@amiv.test'))) x$s$, '1'],
    ['compteurs : plus d''attente', 'A', $s$select total || ',' || pending from get_event_guest_counts(array['00000000-0000-4000-e000-000000000061']::uuid[])$s$, '7,0']
  ];
  i int; who text; who_id uuid; res text; out text := ''; fails int := 0;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-gl-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (A, 'dry-gl-a@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-gl-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-gl-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (D, 'dry-gl-d@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (E, 'dry-gl-e@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-gl-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (X, 'dry-gl-x@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    who_id := case who when 'O' then O when 'A' then A when 'B' then B when 'C' then C when 'D' then D when 'E' then E when 'F' then F when 'X' then X end;
    begin
      if who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', who_id, 'role', 'authenticated', 'email', 'dry-gl-' || lower(who) || '@amiv.test')::text, true);
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
