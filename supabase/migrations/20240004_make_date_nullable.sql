-- Allow null date for events that use a date poll instead of a fixed date
alter table public.events
  alter column date drop not null;
