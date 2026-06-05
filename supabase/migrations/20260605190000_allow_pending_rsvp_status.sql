alter table public.rsvps
  drop constraint if exists rsvps_status_check;

alter table public.rsvps
  add constraint rsvps_status_check
  check (status = any (array['going'::text, 'declined'::text, 'invited'::text, 'pending'::text]));
