-- Vérification wishlist : réservation / annulation, « Via la cagnotte »,
-- suppression des cadeaux collectifs (migration 20261102240000).
-- Run against the linked database with:
--   supabase db query --linked -f supabase/tests/wishlist_via_cagnotte_verification.sql
--
-- Le bloc se termine toujours par une exception (DRYRUN ... échec(s)) :
-- toutes les données de test sont annulées.

do $dry$
declare
  O  uuid := '00000000-0000-4000-a000-000000000001'; -- owner
  C  uuid := '00000000-0000-4000-a000-000000000002'; -- co-organisateur approuvé
  B  uuid := '00000000-0000-4000-a000-000000000003'; -- invité "going"
  B2 uuid := '00000000-0000-4000-a000-000000000006'; -- autre invité "going"
  L  uuid := '00000000-0000-4000-a000-000000000007'; -- coordinateur (guest_leader approuvé)
  T  uuid := '00000000-0000-4000-a000-000000000004'; -- compte tiers
  F  uuid := '00000000-0000-4000-a000-000000000005'; -- personne fêtée (co-org sur EV, owner de EV3)
  EV  uuid := '00000000-0000-4000-b000-000000000001';
  EV3 uuid := '00000000-0000-4000-b000-000000000003';
  G  uuid := '00000000-0000-4000-c000-000000000001';
  G2 uuid := '00000000-0000-4000-c000-000000000002';
  G3 uuid := '00000000-0000-4000-c000-000000000003';
  I1 uuid := '00000000-0000-4000-d000-000000000001';
  I2 uuid := '00000000-0000-4000-d000-000000000002';
  I3 uuid := '00000000-0000-4000-d000-000000000003';
  I4 uuid := '00000000-0000-4000-d000-000000000004';
  cases text[][] := array[
    -- label, who, sql, expected
    -- Je prends en charge / Annuler
    ['B prend I1', 'B', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000003' where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '1'],
    ['B2 prend I1 déjà pris', 'B2', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000006' where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['B2 annule la réservation de B', 'B2', $s$with x as (update gift_items set claimed_by=null where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['organisateur annule la réservation de B', 'O', $s$with x as (update gift_items set claimed_by=null where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['I1 toujours à B', 'postgres', $s$select count(*) from gift_items where id='00000000-0000-4000-d000-000000000001' and claimed_by='00000000-0000-4000-a000-000000000003'$s$, '1'],
    ['B réserve I2 pour B2', 'B', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000006' where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['B renomme I2', 'B', $s$with x as (update gift_items set label='x' where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['B pose collective_gift_id', 'B', $s$with x as (update gift_items set collective_gift_id='00000000-0000-4000-c000-000000000001' where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['fêtée prend I2', 'F', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000005' where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, '0'],
    ['anon prend I2', 'anon', $s$with x as (update gift_items set claimed_by=null where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, 'ERR 42501'],
    ['B annule I1', 'B', $s$with x as (update gift_items set claimed_by=null where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '1'],
    ['I1 libre', 'postgres', $s$select count(*) from gift_items where id='00000000-0000-4000-d000-000000000001' and claimed_by is null$s$, '1'],
    ['B2 prend I1 libéré', 'B2', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000006' where id='00000000-0000-4000-d000-000000000001' returning 1) select count(*) from x$s$, '1'],
    -- Via la cagnotte
    ['B prend I2', 'B', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000003' where id='00000000-0000-4000-d000-000000000002' returning 1) select count(*) from x$s$, '1'],
    ['cagnotte sur I2 déjà pris', 'B2', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000002')) x$s$, 'ERR 55000'],
    ['fêtée passe I4 en cagnotte', 'F', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000004')) x$s$, 'ERR 42501'],
    ['tiers passe I4 en cagnotte', 'T', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000004')) x$s$, 'ERR 42501'],
    ['anon passe I4 en cagnotte', 'anon', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000004')) x$s$, 'ERR 42501'],
    ['B2 passe I3 en cagnotte', 'B2', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000003')) x$s$, '1'],
    ['cadeau collectif créé depuis I3', 'postgres', $s$select count(*) from gifts g join gift_items i on i.collective_gift_id=g.id where i.id='00000000-0000-4000-d000-000000000003' and g.event_id=i.event_id and g.name='Casque' and g.price=120 and g.needs_contribution and g.added_by='00000000-0000-4000-a000-000000000003'$s$, '1'],
    ['visible par B dans Cadeaux collectifs', 'B', $s$select count(*) from gifts where name='Casque'$s$, '1'],
    ['I3 deux fois en cagnotte', 'B2', $s$select count(*) from (select public.move_gift_item_to_cagnotte('00000000-0000-4000-d000-000000000003')) x$s$, 'ERR 55000'],
    ['B prend I3 passé en cagnotte', 'B', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000003' where id='00000000-0000-4000-d000-000000000003' returning 1) select count(*) from x$s$, '0'],
    ['B2 détache I3 de la cagnotte', 'B2', $s$with x as (update gift_items set collective_gift_id=null where id='00000000-0000-4000-d000-000000000003' returning 1) select count(*) from x$s$, 'ERR 42501'],
    -- Suppression d'un cadeau collectif
    ['auteur (invité) supprime G', 'B', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['invité supprime le cadeau de I3', 'B2', $s$with x as (delete from gifts where name='Casque' returning 1) select count(*) from x$s$, '0'],
    ['tiers supprime G', 'T', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000001' returning 1) select count(*) from x$s$, '0'],
    -- Staging accorde delete à anon (dump) : la policy (to authenticated) filtre tout
    ['anon supprime G', 'anon', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['fêtée co-org supprime G', 'F', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000001' returning 1) select count(*) from x$s$, '0'],
    ['fêtée owner supprime G3 (son événement)', 'F', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000003' returning 1) select count(*) from x$s$, '0'],
    ['G3 toujours là', 'postgres', $s$select count(*) from gifts where id='00000000-0000-4000-c000-000000000003'$s$, '1'],
    ['co-org supprime le cadeau de I3', 'C', $s$with x as (delete from gifts where name='Casque' returning 1) select count(*) from x$s$, '1'],
    ['I3 revient dans la wishlist', 'postgres', $s$select count(*) from gift_items where id='00000000-0000-4000-d000-000000000003' and collective_gift_id is null$s$, '1'],
    ['B prend I3 revenu', 'B', $s$with x as (update gift_items set claimed_by='00000000-0000-4000-a000-000000000003' where id='00000000-0000-4000-d000-000000000003' returning 1) select count(*) from x$s$, '1'],
    ['coordinateur supprime G', 'L', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000001' returning 1) select count(*) from x$s$, '1'],
    ['owner supprime G2', 'O', $s$with x as (delete from gifts where id='00000000-0000-4000-c000-000000000002' returning 1) select count(*) from x$s$, '1'],
    -- Suppression de compte : la réservation se libère toujours
    ['delete auth.users B2', 'postgres', $s$with x as (delete from auth.users where id='00000000-0000-4000-a000-000000000006' returning 1) select count(*) from x$s$, '1'],
    ['I1 libéré avec le compte', 'postgres', $s$select count(*) from gift_items where id='00000000-0000-4000-d000-000000000001' and claimed_by is null$s$, '1']
  ];
  i int; who text; uid uuid; res text; out text := ''; fails int := 0;
begin
  -- Staging n'a pas le trigger de création de profil (schéma auth non copié)
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  insert into auth.users (id, email, aud, role, instance_id) values
    (O, 'dry-o@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (C, 'dry-c@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B, 'dry-b@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (B2, 'dry-b2@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (L, 'dry-l@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (T, 'dry-t@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (F, 'dry-f@amiv.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into events (id, name, type, user_id, birthday_person_user_id, date) values
    (EV, 'Dry anniv', 'Anniversaire', O, F, now() + interval '30 days'),
    (EV3, 'Dry anniv de F', 'Anniversaire', F, F, now() + interval '30 days');
  insert into event_organizers (event_id, user_id, role, status) values
    (EV, O, 'owner', 'approved'), (EV, C, 'co_organizer', 'approved'), (EV, F, 'co_organizer', 'approved'),
    (EV, L, 'guest_leader', 'approved'), (EV3, F, 'owner', 'approved');
  insert into invitations (event_id, invited_user_id, invited_by, status) values
    (EV, B, O, 'accepted'), (EV, B2, O, 'accepted'), (EV, L, O, 'accepted'), (EV, F, O, 'accepted');
  insert into rsvps (event_id, user_id, status) values
    (EV, B, 'going'), (EV, B2, 'going'), (EV, L, 'going'), (EV, F, 'going');
  insert into gifts (id, event_id, name, added_by) values
    (G, EV, 'Cadeau', B), (G2, EV, 'Autre', O), (G3, EV3, 'Cadeau de F', F);
  insert into gift_items (id, event_id, label, price_estimate, added_by) values
    (I1, EV, 'Livre', 20, O), (I2, EV, 'Vinyle', 35, O), (I3, EV, 'Casque', 120, B), (I4, EV, 'Plante', 15, O);

  for i in 1 .. array_length(cases, 1) loop
    who := cases[i][2];
    uid := case who when 'O' then O when 'C' then C when 'B' then B when 'B2' then B2 when 'L' then L when 'T' then T when 'F' then F end;
    begin
      if who = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('request.jwt.claim.sub', '', true);
        execute 'set local role anon';
      elsif who <> 'postgres' then
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', 'dry-' || lower(who) || '@amiv.test')::text, true);
        perform set_config('request.jwt.claim.sub', uid::text, true);
        execute 'set local role authenticated';
      end if;
      execute cases[i][3] into res;
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
