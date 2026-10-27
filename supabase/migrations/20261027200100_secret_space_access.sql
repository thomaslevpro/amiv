-- Espace secret : une seule règle d'accès, utilisée par le front et par toutes les tables.
-- Accès = invités ayant accepté (rsvp going ou invitation accepted) + organisateurs
-- (owner, co-organisateurs approuvés), jamais la personne fêtée.
--
-- Avant : chaque table avait sa propre règle (rsvp de n'importe quel statut, invitation
-- par email uniquement pour gifts, owner exclu de gift_items, personne fêtée non exclue
-- de collective_cards/gift_items, policy messages permissive qui laissait tout le monde
-- écrire dans le chat secret).

create or replace function public.can_access_secret_space(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.birthday_person_user_id is distinct from auth.uid()
    )
    and (
      public.is_event_organizer(p_event_id)
      or exists (
        select 1 from public.rsvps r
        where r.event_id = p_event_id
          and r.user_id = auth.uid()
          and r.status = 'going'
      )
      or exists (
        select 1 from public.invitations i
        where i.event_id = p_event_id
          and i.status = 'accepted'
          and (i.invited_user_id = auth.uid() or i.invited_email = auth.email())
      )
    );
$$;

revoke execute on function public.can_access_secret_space(uuid) from public, anon;
grant execute on function public.can_access_secret_space(uuid) to authenticated;

-- collective_cards
drop policy if exists "insert card" on public.collective_cards;
drop policy if exists "read card as invitee or organizer" on public.collective_cards;

create policy "Espace secret : lecture carte"
  on public.collective_cards for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Espace secret : création carte"
  on public.collective_cards for insert to authenticated
  with check (public.can_access_secret_space(event_id));

-- collective_memories : chacun voit les siens, les organisateurs voient tout (inchangé),
-- mais toujours sous réserve d'accès à l'espace secret.
drop policy if exists "insert memory as contributor" on public.collective_memories;
drop policy if exists "read memories as contributor or organizer" on public.collective_memories;

create policy "Espace secret : ajout souvenir"
  on public.collective_memories for insert to authenticated
  with check (
    contributor_id = auth.uid()
    and public.can_access_secret_space(event_id)
  );

create policy "Espace secret : lecture souvenirs"
  on public.collective_memories for select to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (contributor_id = auth.uid() or public.is_event_organizer(event_id))
  );

-- gift_items
drop policy if exists "gifts_insert" on public.gift_items;
drop policy if exists "gifts_select" on public.gift_items;
drop policy if exists "gifts_update_claim" on public.gift_items;

create policy "Espace secret : lecture idées cadeaux"
  on public.gift_items for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Espace secret : ajout idée cadeau"
  on public.gift_items for insert to authenticated
  with check (added_by = auth.uid() and public.can_access_secret_space(event_id));

create policy "Espace secret : réservation idée cadeau"
  on public.gift_items for update to authenticated
  using (public.can_access_secret_space(event_id))
  with check (public.can_access_secret_space(event_id));

-- gifts
drop policy if exists "Invitees can view gifts" on public.gifts;
drop policy if exists "Invitees can insert gifts" on public.gifts;
drop policy if exists "Invitees can update gifts" on public.gifts;
drop policy if exists "Invitees can delete own gifts" on public.gifts;

create policy "Espace secret : lecture cadeaux"
  on public.gifts for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Espace secret : ajout cadeau"
  on public.gifts for insert to authenticated
  with check (public.can_access_secret_space(event_id));

create policy "Espace secret : modification cadeau"
  on public.gifts for update to authenticated
  using (public.can_access_secret_space(event_id))
  with check (public.can_access_secret_space(event_id));

create policy "Espace secret : suppression de ses cadeaux"
  on public.gifts for delete to authenticated
  using (added_by = auth.uid() and public.can_access_secret_space(event_id));

-- messages : le chat général reste ouvert aux invités (tout statut) et aux organisateurs,
-- le chat secret suit la règle de l'espace secret.
drop policy if exists "select_messages" on public.messages;
drop policy if exists "insert_messages" on public.messages;
drop policy if exists "Users can insert their own messages" on public.messages;

create policy "select_messages"
  on public.messages for select to authenticated
  using (
    (
      is_secret = false
      and (
        public.is_invited_to_event(event_id, auth.uid())
        or public.is_event_organizer(event_id)
      )
    )
    or (is_secret = true and public.can_access_secret_space(event_id))
  );

create policy "insert_messages"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      (
        is_secret = false
        and (
          public.is_invited_to_event(event_id, auth.uid())
          or public.is_event_organizer(event_id)
        )
      )
      or (is_secret = true and public.can_access_secret_space(event_id))
    )
  );
