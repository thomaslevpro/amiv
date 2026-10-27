-- Les policies "Insert/Delete par owner uniquement" comparaient
-- event_organizers_1.event_id = event_organizers_1.event_id (toujours vrai) :
-- être owner de N'IMPORTE QUEL événement suffisait pour insérer ou supprimer
-- des organisateurs sur tous les événements, et un compte neuf (owner de rien)
-- ne pouvait pas insérer sa propre ligne owner.
--
-- La ligne owner est créée par create_event_with_owner (security definer) ;
-- côté client, l'owner de l'événement ne fait qu'ajouter/retirer des co-organisateurs
-- (lib/organizers.js). Les candidatures guest_leader ont leur propre policy.

drop policy if exists "Insert par owner uniquement" on public.event_organizers;
drop policy if exists "Delete par owner uniquement" on public.event_organizers;

create policy "Insert co-organisateur par owner"
  on public.event_organizers
  for insert
  to authenticated
  with check (
    role = 'co_organizer'
    and exists (
      select 1 from public.events e
      where e.id = event_organizers.event_id
        and e.user_id = auth.uid()
    )
  );

create policy "Delete co-organisateur par owner"
  on public.event_organizers
  for delete
  to authenticated
  using (
    role = 'co_organizer'
    and exists (
      select 1 from public.events e
      where e.id = event_organizers.event_id
        and e.user_id = auth.uid()
    )
  );

-- La RPC refuse déjà auth.uid() null, mais anon n'a pas à pouvoir l'appeler.
revoke execute on function public.create_event_with_owner(
  text, timestamptz, text, text, text, text, text, uuid, jsonb, uuid[]
) from anon;
