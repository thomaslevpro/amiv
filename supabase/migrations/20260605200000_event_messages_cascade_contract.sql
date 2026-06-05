-- Formalize the current event conversation model:
-- an event conversation is an event plus its messages linked by messages.event_id.
-- Do not create a separate event_conversations table.

do $$
declare
  null_event_message_count bigint;
  orphan_message_count bigint;
begin
  select count(*)
    into null_event_message_count
  from public.messages
  where event_id is null;

  if null_event_message_count > 0 then
    raise exception
      'Cannot enforce messages.event_id NOT NULL: % message(s) have a null event_id',
      null_event_message_count;
  end if;

  select count(*)
    into orphan_message_count
  from public.messages m
  left join public.events e on e.id = m.event_id
  where e.id is null;

  if orphan_message_count > 0 then
    raise exception
      'Cannot recreate messages_event_id_fkey: % message(s) reference a missing event',
      orphan_message_count;
  end if;
end $$;

alter table public.messages
  alter column event_id set not null;

alter table public.messages
  drop constraint if exists messages_event_id_fkey;

alter table public.messages
  add constraint messages_event_id_fkey
  foreign key (event_id)
  references public.events(id)
  on delete cascade;

create index if not exists messages_event_id_created_at_idx
  on public.messages(event_id, created_at);
