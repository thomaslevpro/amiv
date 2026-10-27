-- Ajout d'un co-organisateur :
-- 1. rsvps n'était lisible que par son auteur : l'owner ne voyait aucun participant
--    confirmé dans la modale "Ajouter un co-organisateur" de la fiche événement.
-- 2. event_organizers n'était lisible que pour sa propre ligne : l'owner ne voyait
--    pas le co-organisateur ajouté, les invités ne voyaient pas les organisateurs.
-- 3. Aucune notification n'était créée pour le co-organisateur (ni côté client,
--    ni trigger) et le type n'existait pas dans notifications_type_check.

-- Security definer : évite la récursion RLS events <-> event_organizers.
create or replace function public.is_event_organizer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.user_id = auth.uid()
    )
    or exists (
      select 1 from public.event_organizers o
      where o.event_id = p_event_id
        and o.user_id = auth.uid()
        and o.role in ('owner', 'co_organizer')
        and o.status = 'approved'
    )
  );
$$;

revoke execute on function public.is_event_organizer(uuid) from public, anon;
grant execute on function public.is_event_organizer(uuid) to authenticated;

drop policy if exists "Organisateurs voient les rsvps de l'événement" on public.rsvps;
create policy "Organisateurs voient les rsvps de l'événement"
  on public.rsvps
  for select
  to authenticated
  using (public.is_event_organizer(event_id));

drop policy if exists "Membres voient les organisateurs" on public.event_organizers;
create policy "Membres voient les organisateurs"
  on public.event_organizers
  for select
  to authenticated
  using (
    public.is_event_organizer(event_id)
    or public.is_invited_to_event(event_id, auth.uid())
  );

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added'
));

create or replace function public.notify_co_organizer_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  sender_id uuid;
  sender_name text;
begin
  if new.role <> 'co_organizer' or new.status <> 'approved' then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;
  sender_id := coalesce(auth.uid(), ev.user_id);
  if sender_id = new.user_id then
    return new;
  end if;

  select coalesce(first_name, name) into sender_name from public.profiles where id = sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.user_id,
    'co_organizer_added',
    'Tu es co-organisateur de ' || coalesce(ev.name, 'un événement'),
    coalesce(sender_name, 'Quelqu''un') || ' t''a ajouté(e) comme co-organisateur',
    jsonb_build_object('event_id', new.event_id, 'sender_id', sender_id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_co_organizer_added on public.event_organizers;
create trigger trg_notify_co_organizer_added
  after insert on public.event_organizers
  for each row
  execute function public.notify_co_organizer_added();
