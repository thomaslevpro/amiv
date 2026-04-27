-- Add invite_token to events (auto-generated UUID, used for the public guest RSVP link)
alter table public.events
  add column if not exists invite_token uuid default gen_random_uuid() unique;

-- Backfill any existing rows that don't have a token yet
update public.events
  set invite_token = gen_random_uuid()
  where invite_token is null;

-- Public guest RSVPs — submitted without auth via Edge Function (service role bypasses RLS)
create table if not exists public.guest_rsvps (
  id         uuid default gen_random_uuid() primary key,
  event_id   uuid references public.events(id) on delete cascade not null,
  guest_name text not null,
  guest_email text not null,
  response   text not null check (response in ('yes', 'no', 'maybe')),
  created_at timestamptz default now()
);

alter table public.guest_rsvps enable row level security;

-- Only the event organizer can read guest RSVPs for their event
create policy "organizer can view guest rsvps" on public.guest_rsvps
  for select using (
    exists (
      select 1 from public.events
      where events.id = guest_rsvps.event_id
        and events.user_id = auth.uid()
    )
  );
