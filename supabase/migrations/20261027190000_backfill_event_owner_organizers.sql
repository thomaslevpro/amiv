-- Rattrapage : chaque événement doit avoir une ligne owner dans event_organizers.
-- Des événements créés par l'ancien client (insert direct dans events, puis insert
-- dans event_organizers refusé par RLS et ignoré) n'en ont pas.
-- Idempotent : unique (event_id, user_id) + on conflict do nothing.

insert into public.event_organizers (event_id, user_id, role, status)
select e.id, e.user_id, 'owner', 'approved'
from public.events e
where e.user_id is not null
  -- event_organizers.user_id référence profiles(id), events.user_id référence auth.users(id)
  and exists (select 1 from public.profiles p where p.id = e.user_id)
  and not exists (
    select 1
    from public.event_organizers o
    where o.event_id = e.id
      and o.role = 'owner'
  )
on conflict (event_id, user_id) do nothing;
