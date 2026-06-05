-- Verification script for the event-message cascade contract.
-- Run against a local or linked database with:
--   supabase db query --local -f supabase/tests/event_messages_cascade_verification.sql
--   supabase db query --linked -f supabase/tests/event_messages_cascade_verification.sql
--
-- The script rolls back all test data.

begin;

do $$
declare
  test_user_id uuid;
  test_event_id uuid;
  test_message_id uuid;
  orphan_message_count bigint;
  invalid_event_id_rejected boolean := false;
begin
  select count(*)
    into orphan_message_count
  from public.messages m
  left join public.events e on e.id = m.event_id
  where e.id is null;

  if orphan_message_count > 0 then
    raise exception
      'Expected no orphan event messages, found %',
      orphan_message_count;
  end if;

  select id
    into test_user_id
  from auth.users
  limit 1;

  if test_user_id is null then
    raise exception
      'Verification requires at least one auth.users row because messages.user_id has a foreign key';
  end if;

  insert into public.events (name, user_id)
  values ('Event message cascade verification', test_user_id)
  returning id into test_event_id;

  insert into public.messages (event_id, user_id, content)
  values (test_event_id, test_user_id, 'Cascade verification message')
  returning id into test_message_id;

  delete from public.events
  where id = test_event_id;

  if exists (
    select 1
    from public.messages
    where id = test_message_id
  ) then
    raise exception
      'Deleting event % did not cascade-delete message %',
      test_event_id,
      test_message_id;
  end if;

  begin
    insert into public.messages (event_id, user_id, content)
    values (gen_random_uuid(), test_user_id, 'Invalid event_id must fail');
  exception
    when foreign_key_violation then
      invalid_event_id_rejected := true;
  end;

  if not invalid_event_id_rejected then
    raise exception
      'Inserting a message with an invalid event_id did not raise a foreign key violation';
  end if;
end $$;

rollback;
