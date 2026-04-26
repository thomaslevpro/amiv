create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in (
    'invitation_received','rsvp_received','message_received',
    'birthday_reminder','event_updated'
  )),
  title text not null,
  body text,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(user_id, read);

alter table public.notifications enable row level security;

create policy "users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

create policy "service can insert notifications" on public.notifications
  for insert with check (true);

alter publication supabase_realtime add table public.notifications;
