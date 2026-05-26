alter table public.events
  add column if not exists budget_total numeric default 0;

alter table public.invitations
  add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row
  execute function public.set_updated_at();

create table if not exists public.checklist_items (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  category text not null default 'other',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.event_expenses (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  label text not null,
  amount numeric not null default 0,
  category text not null default 'other',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.checklist_items enable row level security;
alter table public.event_expenses enable row level security;

drop policy if exists "organizer manages checklist" on public.checklist_items;
create policy "organizer manages checklist" on public.checklist_items
  for all using (
    exists (
      select 1 from public.events e
      where e.id = checklist_items.event_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = checklist_items.event_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "organizer manages expenses" on public.event_expenses;
create policy "organizer manages expenses" on public.event_expenses
  for all using (
    exists (
      select 1 from public.events e
      where e.id = event_expenses.event_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_expenses.event_id
        and e.user_id = auth.uid()
    )
  );

create index if not exists checklist_items_event_position_idx
  on public.checklist_items(event_id, position);

create index if not exists event_expenses_event_created_idx
  on public.event_expenses(event_id, created_at);
