alter table public.direct_conversation_participants
  add column if not exists last_read_at timestamptz default null;

create index if not exists dcp_user_last_read_idx
  on public.direct_conversation_participants(user_id, last_read_at);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'direct_conversation_participants'
      and policyname = 'users can update own participant state'
  ) then
    create policy "users can update own participant state"
      on public.direct_conversation_participants
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

create or replace function public.get_unread_counts(p_user_id uuid)
returns table(conversation_id uuid, unread_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    dm.conversation_id,
    count(dm.id) as unread_count
  from public.direct_conversation_participants dcp
  join public.direct_messages dm on dm.conversation_id = dcp.conversation_id
  where dcp.user_id = p_user_id
    and p_user_id = auth.uid()
    and dm.sender_id != p_user_id
    and (dcp.last_read_at is null or dm.created_at > dcp.last_read_at)
  group by dm.conversation_id;
$$;

grant execute on function public.get_unread_counts(uuid) to authenticated;
