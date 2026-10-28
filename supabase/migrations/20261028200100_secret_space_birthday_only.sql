-- Le type d'un événement est modifiable après création. Quand il quitte
-- « Anniversaire », le front retire la personne fêtée (birthday_person_user_id = null) :
-- sans cette règle, l'ancienne personne fêtée, si elle est invitée, aurait alors
-- accès aux cadeaux, à la cagnotte, à la carte et au chat secret préparés pour elle.
--
-- L'espace secret n'est donc ouvert que sur un anniversaire, ou sur un événement qui
-- a une personne fêtée (anciens événements d'un autre type) : même condition que
-- l'affichage de l'espace secret dans EventDetail. Le contenu n'est pas supprimé :
-- il redevient accessible si l'événement repasse en Anniversaire.
--
-- Fonction identique à 20261027200100_secret_space_access, plus cette condition.

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
        and (e.type = 'Anniversaire' or e.birthday_person_user_id is not null)
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
