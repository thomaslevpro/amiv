create table if not exists public.direct_conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);

create table if not exists public.direct_conversation_participants (
  conversation_id uuid references public.direct_conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  primary key (conversation_id, user_id)
);

create index if not exists dcp_user_id_idx on public.direct_conversation_participants(user_id);
create index if not exists dcp_conv_id_idx on public.direct_conversation_participants(conversation_id);

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_participants enable row level security;

create policy "participants can view their conversations" on public.direct_conversations
  for select using (
    exists (
      select 1 from public.direct_conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "participants can view conversation members" on public.direct_conversation_participants
  for select using (
    exists (
      select 1 from public.direct_conversation_participants dcp2
      where dcp2.conversation_id = conversation_id and dcp2.user_id = auth.uid()
    )
  );

-- Allow any authenticated user to insert participants (friend rows included).
-- Read-level security is enforced by the SELECT policy above.
create policy "authenticated users can insert participants" on public.direct_conversation_participants
  for insert with check (auth.uid() is not null);

create policy "users can create direct conversations" on public.direct_conversations
  for insert with check (true);
