-- Lecture des événements.
-- share_token a gen_random_uuid() par défaut : tous les événements en ont un, donc
-- "share_token IS NOT NULL" (events_select et "Public read via share token", rôle public)
-- rendait chaque événement lisible par tout le monde, anon compris.
--
-- Désormais : organisateur, invité (invitation ou RSVP), ou lien de partage via
-- get_event_by_share_token, qui ne renvoie que l'événement du token.
-- Le lien de partage utilisé par l'app est /invite/<invite_token>.

drop policy if exists "events_select" on public.events;
drop policy if exists "Public read via share token" on public.events;

create policy "events_select"
  on public.events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_organizer(id)
    or public.is_invited_to_event(id, auth.uid())
    or exists (
      select 1 from public.rsvps r
      where r.event_id = events.id
        and r.user_id = auth.uid()
    )
  );

-- Page d'invitation publique : uniquement les champs affichés.
create or replace function public.get_event_by_share_token(p_token uuid)
returns table (
  name text,
  date timestamptz,
  location text,
  description text,
  type text,
  organizer_name text,
  confirmed_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.name,
    e.date,
    e.location,
    e.description,
    e.type,
    p.name,
    (
      (select count(*) from public.rsvps r where r.event_id = e.id and r.status = 'going')
      + (select count(*) from public.guest_rsvps g where g.event_id = e.id and g.response = 'yes')
    )::integer
  from public.events e
  left join public.profiles p on p.id = e.user_id
  where p_token is not null
    and e.invite_token = p_token;
$$;

revoke execute on function public.get_event_by_share_token(uuid) from public;
grant execute on function public.get_event_by_share_token(uuid) to anon, authenticated;

-- Sans ça, n'importe qui pourrait se créer une invitation ou un RSVP sur un
-- événement quelconque pour le rendre lisible.

-- invitations : seuls les organisateurs invitent.
drop policy if exists "Organizer can insert invitations" on public.invitations;
create policy "Organizer can insert invitations"
  on public.invitations
  for insert
  to authenticated
  with check (auth.uid() = invited_by and public.is_event_organizer(event_id));

-- L'invité ne peut changer que le statut (pas event_id).
revoke update on public.invitations from anon, authenticated;
grant update (status) on public.invitations to authenticated;

-- rsvps : uniquement sur un événement auquel on est invité ou qu'on organise
-- (couvre aussi un upsert/update qui changerait event_id).
drop policy if exists "Users insert rsvps" on public.rsvps;
create policy "Users insert rsvps"
  on public.rsvps
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (public.is_invited_to_event(event_id, auth.uid()) or public.is_event_organizer(event_id))
  );

drop policy if exists "Users update rsvps" on public.rsvps;
create policy "Users update rsvps"
  on public.rsvps
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (public.is_invited_to_event(event_id, auth.uid()) or public.is_event_organizer(event_id))
  );

drop policy if exists "rsvps_plus_one_self_update" on public.rsvps;
create policy "rsvps_plus_one_self_update"
  on public.rsvps
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (public.is_invited_to_event(event_id, auth.uid()) or public.is_event_organizer(event_id))
  );
