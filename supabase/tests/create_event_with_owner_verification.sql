-- Verification script for the atomic event creation RPC.
-- Run against a local or linked database with:
--   supabase db query --local -f supabase/tests/create_event_with_owner_verification.sql
--   supabase db query --linked -f supabase/tests/create_event_with_owner_verification.sql
--
-- The script rolls back all test data.

begin;

do $$
declare
  actor_id uuid;
  invitee_id uuid;
  created_event public.events;
  before_failure_count bigint;
  after_failure_count bigint;
  rollback_failed boolean := false;
begin
  select requester_id, addressee_id
    into actor_id, invitee_id
  from public.friendships
  where status = 'accepted'
  limit 1;

  if actor_id is null or invitee_id is null then
    raise exception 'Verification requires at least one accepted friendship';
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('role', 'authenticated', true);

  select *
    into created_event
  from public.create_event_with_owner(
    p_name := 'RPC atomic creation verification',
    p_date := '2030-06-05 18:30:00+00'::timestamptz,
    p_location := 'Verification venue',
    p_description := 'Created by rollback-safe verification',
    p_type := 'Autre',
    p_visibility := 'Sur invitation',
    p_cover_image := null,
    p_birthday_person_user_id := null,
    p_date_options := '[{"date":"2030-06-06","time":"19:00"}]'::jsonb,
    p_invited_user_ids := array[invitee_id]
  );

  if created_event.id is null or created_event.user_id <> actor_id then
    raise exception 'RPC did not return the created event owned by the actor';
  end if;

  if not exists (
    select 1
    from public.event_organizers
    where event_id = created_event.id
      and user_id = actor_id
      and role = 'owner'
  ) then
    raise exception 'Owner organizer row was not created';
  end if;

  if not exists (
    select 1
    from public.event_date_options
    where event_id = created_event.id
      and proposed_date = '2030-06-06'::date
      and proposed_time = '19:00'::time
  ) then
    raise exception 'Date option row was not created';
  end if;

  if not exists (
    select 1
    from public.invitations
    where event_id = created_event.id
      and invited_user_id = invitee_id
      and invited_by = actor_id
      and status = 'pending'
  ) then
    raise exception 'Invitation row was not created';
  end if;

  perform set_config('request.jwt.claim.sub', invitee_id::text, true);

  if not exists (
    select 1
    from public.rsvps
    where event_id = created_event.id
      and user_id = invitee_id
      and status = 'pending'
  ) then
    raise exception 'Pending RSVP row was not created';
  end if;

  if not exists (
    select 1
    from public.notifications
    where user_id = invitee_id
      and type = 'event_invitation'
      and data->>'event_id' = created_event.id::text
      and data->>'sender_id' = actor_id::text
      and read = false
  ) then
    raise exception 'Invitation notification row was not created';
  end if;

  select count(*)
    into before_failure_count
  from public.events
  where name = 'RPC atomic rollback verification';

  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  begin
    perform public.create_event_with_owner(
      p_name := 'RPC atomic rollback verification',
      p_date := null,
      p_location := 'Rollback venue',
      p_description := 'This event must not persist',
      p_type := 'Autre',
      p_visibility := 'Sur invitation',
      p_cover_image := null,
      p_birthday_person_user_id := null,
      p_date_options := '[{"date":"not-a-date","time":"19:00"}]'::jsonb,
      p_invited_user_ids := array[invitee_id]
    );
  exception
    when others then
      rollback_failed := true;
  end;

  if not rollback_failed then
    raise exception 'Invalid date option did not fail';
  end if;

  select count(*)
    into after_failure_count
  from public.events
  where name = 'RPC atomic rollback verification';

  if after_failure_count <> before_failure_count then
    raise exception
      'Rollback failed: event count before %, after %',
      before_failure_count,
      after_failure_count;
  end if;
end $$;

rollback;
