-- La candidature guest_leader exigeait rsvps.status = 'yes', valeur que l'app n'écrit
-- jamais (rsvps_status_check : going / declined / invited / pending) : toute
-- candidature était refusée par la RLS.

drop policy if exists "guest can apply as guest_leader" on public.event_organizers;

create policy "guest can apply as guest_leader"
  on public.event_organizers
  for insert
  to authenticated
  with check (
    role = 'guest_leader'
    and status = 'pending'
    and user_id = auth.uid()
    and exists (
      select 1 from public.rsvps
      where rsvps.event_id = event_organizers.event_id
        and rsvps.user_id = auth.uid()
        and rsvps.status = 'going'
    )
    and not exists (
      select 1 from public.event_organizers eo2
      where eo2.event_id = event_organizers.event_id
        and eo2.user_id = auth.uid()
    )
  );
