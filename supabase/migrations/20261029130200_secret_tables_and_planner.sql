-- Personne fêtée et tables de préparation (lot D).
--   - group_cards : création / modification / révélation par les
--     organisateurs (owner + co-organisateurs approuvés) ayant accès à
--     l'espace secret, donc jamais la personne fêtée ; lecture via
--     can_access_secret_space. Les anciennes policies laissaient n'importe
--     quel compte créer ou modifier (révéler) n'importe quelle carte.
--   - group_card_messages, group_card_reactions, memory_reactions : lecture
--     via can_access_secret_space uniquement (card_select laissait toute
--     personne ayant un rsvp, fêtée comprise, lire la carte avant révélation ;
--     gcr_select était public, anon compris). Écriture : sa propre ligne, dans
--     un espace secret auquel on a accès.
--   - checklist_items, event_expenses : organisateurs hors personne fêtée,
--     même co-organisatrice (is_event_planner). Valable aussi pour les
--     événements qui ne sont pas des anniversaires.

-- Organisateur de l'événement qui n'en est pas la personne fêtée.
create or replace function public.is_event_planner(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_event_organizer(p_event_id)
    and not exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.birthday_person_user_id = auth.uid()
    );
$$;

revoke all on function public.is_event_planner(uuid) from public, anon;
grant execute on function public.is_event_planner(uuid) to authenticated;

-- ── group_cards ────────────────────────────────────────────────────────────
drop policy if exists "Invités peuvent voir la carte" on public.group_cards;
drop policy if exists "Organisateur peut créer et révéler" on public.group_cards;
drop policy if exists group_cards_insert on public.group_cards;
drop policy if exists group_cards_upsert_update on public.group_cards;

revoke all on public.group_cards from anon;

create policy "Espace secret : lecture carte de groupe"
  on public.group_cards for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Organisateurs : création carte de groupe"
  on public.group_cards for insert to authenticated
  with check (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id));

create policy "Organisateurs : modification carte de groupe"
  on public.group_cards for update to authenticated
  using (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id))
  with check (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id));

create policy "Organisateurs : suppression carte de groupe"
  on public.group_cards for delete to authenticated
  using (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id));

-- ── group_card_messages ────────────────────────────────────────────────────
drop policy if exists "Lecture avant révélation : seulement le sien" on public.group_card_messages;
drop policy if exists card_select on public.group_card_messages;
drop policy if exists gcm_insert_confirmed_only on public.group_card_messages;

revoke all on public.group_card_messages from anon;

create policy "Espace secret : lecture mots de carte"
  on public.group_card_messages for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Espace secret : ajout de son mot"
  on public.group_card_messages for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_secret_space(event_id));

-- card_delete (suppression de son propre mot) est conservée.

-- ── group_card_reactions ───────────────────────────────────────────────────
drop policy if exists gcr_select on public.group_card_reactions;
drop policy if exists gcr_insert on public.group_card_reactions;

revoke all on public.group_card_reactions from anon;

create policy "Espace secret : lecture réactions de carte"
  on public.group_card_reactions for select to authenticated
  using (exists (
    select 1 from public.group_card_messages m
    where m.id = group_card_reactions.message_id
      and public.can_access_secret_space(m.event_id)
  ));

create policy "Espace secret : ajout réaction de carte"
  on public.group_card_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_card_messages m
      where m.id = group_card_reactions.message_id
        and public.can_access_secret_space(m.event_id)
    )
  );

-- gcr_delete (suppression de sa propre réaction) est conservée.

-- ── memory_reactions ───────────────────────────────────────────────────────
-- La sous-requête passe par la RLS de collective_memories : on ne voit que
-- les réactions des souvenirs que l'on peut lire.
drop policy if exists "read reactions" on public.memory_reactions;
drop policy if exists "insert reaction" on public.memory_reactions;

revoke all on public.memory_reactions from anon;

create policy "Espace secret : lecture réactions souvenirs"
  on public.memory_reactions for select to authenticated
  using (exists (
    select 1 from public.collective_memories m
    where m.id = memory_reactions.memory_id
      and public.can_access_secret_space(m.event_id)
  ));

create policy "Espace secret : ajout réaction souvenir"
  on public.memory_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.collective_memories m
      where m.id = memory_reactions.memory_id
        and public.can_access_secret_space(m.event_id)
    )
  );

-- "delete own reaction" est conservée.

-- ── checklist_items / event_expenses ───────────────────────────────────────
drop policy if exists "organizer manages checklist" on public.checklist_items;
create policy "organizer manages checklist"
  on public.checklist_items for all to authenticated
  using (public.is_event_planner(event_id))
  with check (public.is_event_planner(event_id));

drop policy if exists "organizer manages expenses" on public.event_expenses;
create policy "organizer manages expenses"
  on public.event_expenses for all to authenticated
  using (public.is_event_planner(event_id))
  with check (public.is_event_planner(event_id));
