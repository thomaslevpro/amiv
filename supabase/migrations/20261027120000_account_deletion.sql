-- Suppression de compte (App Store 5.1.1(v)).
-- 1. Aligne les clés étrangères sur la politique de suppression :
--    - messages d'événement et messages privés : auteur anonymisé (NULL)
--    - checklist, dépenses, révélation de carte, cadeaux, invitations : référence mise à NULL
--    - souvenirs et leurs réactions : supprimés
--    - tout ce qui dépend d'un événement : supprimé avec lui (CASCADE)
-- 2. Crée prepare_account_deletion(), appelée par l'Edge Function delete-account
--    (service role uniquement) avant auth.admin.deleteUser.
-- 3. Vérifie le résultat : la migration échoue (et rien n'est appliqué) si une
--    clé étrangère peut encore bloquer une suppression de compte.

-- ── Clés étrangères vers auth.users / profiles ─────────────────────────────

-- Messages d'événement : conservés, auteur "Utilisateur supprimé"
alter table public.messages alter column user_id drop not null;
alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.messages
  add constraint messages_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Messages privés : conservés, auteur "Utilisateur supprimé"
alter table public.direct_messages alter column sender_id drop not null;
alter table public.direct_messages drop constraint if exists direct_messages_sender_id_fkey;
alter table public.direct_messages
  add constraint direct_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete set null;

-- Checklist et dépenses : NO ACTION bloquait la suppression du profil
-- (colonnes déjà nullable d'après Q1 ; le drop not null est un garde-fou sans effet)
alter table public.checklist_items alter column assigned_to drop not null;
alter table public.checklist_items drop constraint if exists checklist_items_assigned_to_fkey;
alter table public.checklist_items
  add constraint checklist_items_assigned_to_fkey
  foreign key (assigned_to) references public.profiles(id) on delete set null;

alter table public.checklist_items alter column created_by drop not null;
alter table public.checklist_items drop constraint if exists checklist_items_created_by_fkey;
alter table public.checklist_items
  add constraint checklist_items_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.event_expenses alter column created_by drop not null;
alter table public.event_expenses drop constraint if exists event_expenses_created_by_fkey;
alter table public.event_expenses
  add constraint event_expenses_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Carte de groupe : NO ACTION bloquait la suppression du profil
alter table public.group_cards alter column revealed_by drop not null;
alter table public.group_cards drop constraint if exists group_cards_revealed_by_fkey;
alter table public.group_cards
  add constraint group_cards_revealed_by_fkey
  foreign key (revealed_by) references public.profiles(id) on delete set null;

-- Cadeaux : ON DELETE SET NULL sur une colonne NOT NULL faisait échouer la suppression
alter table public.gift_items alter column added_by drop not null;

-- Invitations : CASCADE sur invited_by supprimait les invités des événements
-- transférés au co-organisateur (et des événements des autres)
alter table public.invitations alter column invited_by drop not null;
alter table public.invitations drop constraint if exists invitations_invited_by_fkey;
alter table public.invitations
  add constraint invitations_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

-- Souvenirs : NO ACTION bloquait la suppression de l'utilisateur
alter table public.collective_memories drop constraint if exists collective_memories_contributor_id_fkey;
alter table public.collective_memories
  add constraint collective_memories_contributor_id_fkey
  foreign key (contributor_id) references auth.users(id) on delete cascade;

alter table public.memory_reactions drop constraint if exists memory_reactions_user_id_fkey;
alter table public.memory_reactions
  add constraint memory_reactions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ── Clés étrangères vers public.events : NO ACTION / RESTRICT → CASCADE ─────
-- Le schéma distant n'est pas entièrement versionné : on corrige dynamiquement
-- toute FK vers events qui bloquerait sa suppression (chaque correction est signalée).
-- Les FK en SET NULL sont conservées (friendships.event_context_id,
-- availability_posts.converted_event_id) : supprimer un événement ne doit pas
-- supprimer les lignes qui y font seulement référence.

do $$
declare
  fk record;
begin
  for fk in
    select c.conname,
           c.conrelid::regclass as table_name,
           c.confdeltype,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as ref_cols
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.events'::regclass
      and c.confdeltype in ('a', 'r')
  loop
    raise notice 'FK % sur % (on delete %) → CASCADE', fk.conname, fk.table_name, fk.confdeltype;
    execute format('alter table %s drop constraint %I', fk.table_name, fk.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%s) references public.events (%s) on delete cascade',
      fk.table_name, fk.conname, fk.cols, fk.ref_cols
    );
  end loop;
end $$;

-- ── prepare_account_deletion ────────────────────────────────────────────────
-- Transfère ou supprime les événements de l'utilisateur, notifie les invités
-- des événements annulés à venir, nettoie les tables sans clé étrangère, et
-- renvoie la liste des fichiers Storage à supprimer. Le reste (profil, amitiés,
-- RSVP, notifications, anonymisation des messages…) est fait par les clés
-- étrangères lors de auth.admin.deleteUser.
-- Idempotente : peut être rejouée si une étape suivante a échoué.

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event record;
  v_new_owner uuid;
  v_transferred uuid[] := array[]::uuid[];
  v_deleted uuid[] := array[]::uuid[];
  v_files jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  for v_event in
    select e.id, e.name, e.date, e.birthday_person_user_id
    from public.events e
    where e.user_id = p_user_id
    for update
  loop
    select o.user_id
      into v_new_owner
    from public.event_organizers o
    where o.event_id = v_event.id
      and o.role = 'co_organizer'
      and o.user_id <> p_user_id
    order by o.created_at
    limit 1;

    if v_new_owner is not null then
      update public.events set user_id = v_new_owner where id = v_event.id;
      update public.event_organizers
        set role = 'owner'
        where event_id = v_event.id and user_id = v_new_owner;
      delete from public.event_organizers
        where event_id = v_event.id and user_id = p_user_id;
      v_transferred := v_transferred || v_event.id;
    else
      -- Événement à venir (aujourd'hui inclus, ou date encore en sondage) :
      -- prévenir les invités. ::date fonctionne que la colonne soit date ou
      -- timestamptz. La personne fêtée est exclue pour ne pas révéler une surprise.
      if v_event.date is null or v_event.date::date >= current_date then
        insert into public.notifications (user_id, type, title, body, data)
        select recipient_id,
               'event_updated',
               coalesce(nullif(trim(v_event.name), ''), 'Un événement') || ' est annulé',
               'L''organisateur a supprimé son compte Amiv.',
               jsonb_build_object('cancelled', true, 'event_name', v_event.name)
        from (
          select r.user_id as recipient_id from public.rsvps r where r.event_id = v_event.id
          union
          select i.invited_user_id from public.invitations i where i.event_id = v_event.id
          union
          select o.user_id from public.event_organizers o where o.event_id = v_event.id
        ) recipients
        where recipient_id is not null
          and recipient_id <> p_user_id
          and recipient_id is distinct from v_event.birthday_person_user_id;
      end if;

      delete from public.events where id = v_event.id;
      v_deleted := v_deleted || v_event.id;
    end if;
  end loop;

  -- Colonnes sans clé étrangère
  update public.events set cagnotte_created_by = null where cagnotte_created_by = p_user_id;
  delete from public.group_card_reactions where user_id = p_user_id;
  delete from public.calendar_feed_items where user_id = p_user_id;

  -- Mots de carte d'anniversaire et souvenirs : supprimés (décision produit)
  delete from public.group_card_messages where user_id = p_user_id;
  delete from public.collective_memories where contributor_id = p_user_id;

  -- Fichiers Storage : ceux de l'utilisateur + ceux des événements supprimés.
  -- Les couvertures d'événements transférés sont conservées.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb)
    into v_files
  from storage.objects o
  where (
      o.bucket_id in ('avatars', 'card-photos', 'memory-images')
      and o.owner_id = p_user_id::text
    )
    or (o.bucket_id = 'avatars' and o.name like p_user_id::text || '.%')
    or (o.bucket_id = 'memory-images' and split_part(o.name, '/', 2) = p_user_id::text)
    or (o.bucket_id = 'card-photos' and split_part(o.name, '/', 2) like p_user_id::text || '\_%')
    or (
      o.bucket_id in ('event-covers', 'card-photos', 'memory-images')
      and split_part(o.name, '/', 1) = any (v_deleted::text[])
    )
    -- Rejeu après un échec : couvertures déjà orphelines de ses événements supprimés
    or (
      o.bucket_id = 'event-covers'
      and o.owner_id = p_user_id::text
      and not exists (select 1 from public.events e where e.id::text = split_part(o.name, '/', 1))
    );

  return jsonb_build_object(
    'transferred_event_ids', to_jsonb(v_transferred),
    'deleted_event_ids', to_jsonb(v_deleted),
    'files', v_files
  );
end;
$$;

-- ── Vérifications finales ───────────────────────────────────────────────────
-- Échec = rollback complet de la migration, avec la liste des contraintes fautives.

do $$
declare
  v_problems text;
begin
  -- a) Une FK en SET NULL sur une colonne NOT NULL ferait échouer la suppression
  select string_agg(format('%s.%s (%s)', c.conrelid::regclass, a.attname, c.conname), ', ')
    into v_problems
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.confdeltype = 'n'
    and a.attnotnull
    and c.connamespace = 'public'::regnamespace;

  if v_problems is not null then
    raise exception 'FK ON DELETE SET NULL sur colonne NOT NULL : %', v_problems;
  end if;

  -- b) Aucune FK NO ACTION / RESTRICT ne doit viser une table dont des lignes
  --    disparaissent lors d'une suppression de compte : auth.users, profiles,
  --    events, souvenirs, mots de carte, et tout ce qui en dépend en CASCADE.
  with recursive deleted_tables(rel) as (
    select unnest(array[
      'auth.users', 'public.profiles', 'public.events',
      'public.collective_memories', 'public.group_card_messages'
    ]::regclass[])
    union
    select c.conrelid::regclass
    from pg_constraint c
    join deleted_tables d on c.confrelid = d.rel
    where c.contype = 'f' and c.confdeltype = 'c'
  )
  select string_agg(format('%s → %s (%s)', c.conrelid::regclass, c.confrelid::regclass, c.conname), ', ')
    into v_problems
  from pg_constraint c
  where c.contype = 'f'
    and c.confdeltype in ('a', 'r')
    and c.connamespace = 'public'::regnamespace
    and c.confrelid in (select rel from deleted_tables);

  if v_problems is not null then
    raise exception 'FK NO ACTION/RESTRICT bloquant une suppression de compte : %', v_problems;
  end if;
end $$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
