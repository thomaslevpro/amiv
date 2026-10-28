-- cagnotte_contributions : les anciennes policies se basaient sur la seule
-- présence d'un rsvp (personne fêtée incluse, propriétaire exclu). Même règle
-- que la cagnotte : lecture via can_access_secret_space, donc jamais la
-- personne fêtée. Chaque participant ne gère que sa propre contribution, et
-- les organisateurs peuvent corriger ou retirer une contribution.

alter table public.cagnotte_contributions enable row level security;

revoke all on public.cagnotte_contributions from anon;

drop policy if exists cagnotte_select on public.cagnotte_contributions;
drop policy if exists cagnotte_insert on public.cagnotte_contributions;
drop policy if exists cagnotte_update_own on public.cagnotte_contributions;

create policy "Espace secret : lecture contributions"
  on public.cagnotte_contributions for select to authenticated
  using (public.can_access_secret_space(event_id));

create policy "Espace secret : ajout de sa contribution"
  on public.cagnotte_contributions for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_secret_space(event_id));

create policy "Espace secret : modification contribution"
  on public.cagnotte_contributions for update to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.is_event_organizer(event_id))
  )
  with check (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.is_event_organizer(event_id))
  );

create policy "Espace secret : suppression contribution"
  on public.cagnotte_contributions for delete to authenticated
  using (
    public.can_access_secret_space(event_id)
    and (user_id = auth.uid() or public.is_event_organizer(event_id))
  );
