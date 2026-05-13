alter table public.group_card_messages enable row level security;

drop policy if exists "card_select" on public.group_card_messages;
drop policy if exists "card_insert" on public.group_card_messages;
drop policy if exists "card_delete" on public.group_card_messages;

create policy "card_select" on public.group_card_messages
for select using (
  (
    exists (
      select 1 from public.rsvps r
      where r.event_id = group_card_messages.event_id
        and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.events e
      where e.id = group_card_messages.event_id
        and e.user_id = auth.uid()
        and e.date is not null
        and now() >= e.date
    )
  )
);

create policy "card_insert" on public.group_card_messages
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.rsvps r
    where r.event_id = group_card_messages.event_id
      and r.user_id = auth.uid()
  )
  and not exists (
    select 1 from public.events e
    where e.id = group_card_messages.event_id
      and e.user_id = auth.uid()
  )
);

create policy "card_delete" on public.group_card_messages
for delete using (auth.uid() = user_id);

create or replace function public.get_card_message_count(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.group_card_messages
  where event_id = p_event_id;
$$;
