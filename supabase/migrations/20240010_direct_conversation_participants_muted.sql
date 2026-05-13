alter table public.direct_conversation_participants
  add column if not exists is_muted boolean not null default false;
