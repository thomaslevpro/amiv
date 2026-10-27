-- +1 : rsvps_plus_one_self_update laissait l'invité passer son propre
-- plus_one_status à accepted/declined. Seul un organisateur (owner ou
-- co-organisateur) peut valider/refuser, ou modifier un +1 déjà tranché.
-- L'invité garde : demander (pending) et annuler (none).

create or replace function public.guard_plus_one_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plus_one_status in ('accepted', 'declined')
     and (
       new.plus_one_status is distinct from old.plus_one_status
       or new.plus_one_name is distinct from old.plus_one_name
       or new.plus_one_message is distinct from old.plus_one_message
     )
     and auth.uid() is not null
     and not public.is_event_organizer(new.event_id) then
    raise exception 'Seul un organisateur peut valider ou refuser un +1' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_plus_one_status on public.rsvps;
create trigger trg_guard_plus_one_status
  before update of plus_one_status, plus_one_name, plus_one_message on public.rsvps
  for each row
  execute function public.guard_plus_one_status();

-- La revue des +1 est affichée aux co-organisateurs, mais seul l'owner pouvait écrire.
drop policy if exists "rsvps_plus_one_organizer_update" on public.rsvps;
create policy "rsvps_plus_one_organizer_update"
  on public.rsvps
  for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));
