-- Add poll_closed flag to events
alter table public.events
  add column if not exists poll_closed boolean default false;

-- Proposed date options for a date poll (up to 4 per event)
create table if not exists public.event_date_options (
  id            uuid default gen_random_uuid() primary key,
  event_id      uuid references public.events(id) on delete cascade not null,
  proposed_date date not null,
  proposed_time time,
  created_at    timestamptz default now()
);

alter table public.event_date_options enable row level security;

-- Organizer and invitees can view date options
create policy "view date options" on public.event_date_options
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_date_options.event_id
        and (
          e.user_id = auth.uid()
          or exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = auth.uid())
          or exists (
            select 1 from public.invitations i
            where i.event_id = e.id
              and i.invited_email = (select email from auth.users where id = auth.uid())
          )
        )
    )
  );

create policy "organizer inserts date options" on public.event_date_options
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_date_options.event_id
        and e.user_id = auth.uid()
    )
  );

create policy "organizer deletes date options" on public.event_date_options
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_date_options.event_id
        and e.user_id = auth.uid()
    )
  );

-- Votes cast by invitees on proposed dates
create table if not exists public.event_date_votes (
  id         uuid default gen_random_uuid() primary key,
  option_id  uuid references public.event_date_options(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  available  boolean not null,
  created_at timestamptz default now(),
  unique (option_id, user_id)
);

alter table public.event_date_votes enable row level security;

-- Own votes always visible; organizer can see all votes for their events
create policy "view date votes" on public.event_date_votes
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.event_date_options o
      join public.events e on e.id = o.event_id
      where o.id = event_date_votes.option_id
        and e.user_id = auth.uid()
    )
  );

create policy "users insert own votes" on public.event_date_votes
  for insert with check (user_id = auth.uid());

create policy "users update own votes" on public.event_date_votes
  for update using (user_id = auth.uid());
