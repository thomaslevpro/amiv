-- An inactivity warning is persisted before sending so a database insert
-- failure can never turn a delivered warning into an untracked 30/365-day
-- deletion. A null email_sent_at is retryable and never deletion-eligible.
alter table public.account_inactivity_warnings
  add column if not exists email_sent_at timestamptz;
alter table public.account_inactivity_warnings
  add column if not exists email_attempted_at timestamptz;
alter table public.account_inactivity_warnings
  add column if not exists email_attempt_id uuid;

-- Before this column existed, rows were inserted only after Resend returned a
-- successful API response. This records provider acceptance, not inbox delivery.
update public.account_inactivity_warnings
set email_sent_at = warned_at
where email_sent_at is null
  and email_attempted_at is null;

-- The retention job runs daily at 03:00 UTC. Schedule at the first cron time
-- after the 365-day point, with a one-hour margin for provider confirmation.
create or replace function public.inactivity_deletion_date(p_anchor timestamptz)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_target timestamp := (p_anchor + interval '365 days' + interval '1 hour') at time zone 'utc';
  v_run_at timestamp := date_trunc('day', v_target) + interval '3 hours';
begin
  if v_run_at < v_target then
    v_run_at := v_run_at + interval '1 day';
  end if;
  return v_run_at at time zone 'utc';
end;
$$;

create or replace function public.account_is_inactive_for_warning(
  p_last_activity_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_last_activity_at is not null
    and p_last_activity_at < p_now - interval '3 years'
$$;

create or replace function public.account_warning_deletion_eligible(
  p_warned_at timestamptz,
  p_email_sent_at timestamptz,
  p_deletion_scheduled_at timestamptz,
  p_last_activity_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_warned_at is not null
    and p_email_sent_at is not null
    and p_deletion_scheduled_at is not null
    and p_last_activity_at is not null
    and p_now is not null
    and p_deletion_scheduled_at >= p_warned_at + interval '365 days'
    and p_deletion_scheduled_at >= p_email_sent_at + interval '365 days'
    and p_deletion_scheduled_at <= p_now
    and p_last_activity_at <= p_warned_at
$$;

create or replace function public.account_warning_attempt_lease_available(
  p_attempted_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_attempted_at is null
    or p_attempted_at < p_now - interval '10 minutes'
$$;

-- Refresh the activity calculation with explicit null and UTC behavior. A
-- session refresh is a conservative session signal, not proof of app use.
create or replace function public.account_activity()
returns table (user_id uuid, email text, first_name text, last_activity_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(p.first_name, p.name),
    greatest(
      u.created_at,
      coalesce(u.last_sign_in_at, u.created_at),
      coalesce(s.last_session_at, u.created_at)
    )
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join lateral (
    select max(greatest(se.updated_at, se.refreshed_at at time zone 'utc')) as last_session_at
    from auth.sessions se
    where se.user_id = u.id
  ) s on true
  where u.deleted_at is null
    and not u.is_anonymous
$$;

-- event_date_options.proposed_date is a date without a time zone; interpret it
-- as UTC explicitly instead of relying on the database session TimeZone.
create or replace function public.events_past_guest_retention()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.events e
  where coalesce(
    e.date,
    (select max(o.proposed_date)::timestamp at time zone 'utc' from public.event_date_options o where o.event_id = e.id),
    e.created_at
  ) < now() - interval '12 months'
$$;

-- Read-only classification for a pre-deployment review. The old writer used
-- Date.now() + 30 days before sending and stored warned_at after delivery, so
-- its signature is a schedule 29–30 days after warned_at. Do not update dates
-- until the matching rows have been inspected in the target database:
--
-- select user_id, warned_at, deletion_scheduled_at,
--        deletion_scheduled_at - warned_at as scheduled_delay,
--        case when deletion_scheduled_at > warned_at + interval '29 days'
--                   and deletion_scheduled_at <= warned_at + interval '30 days'
--             then 'likely old 30-day delay' else 'review manually' end as classification
-- from public.account_inactivity_warnings
-- where deletion_scheduled_at < warned_at + interval '365 days'
-- order by warned_at;
--
-- If and only if those rows match the old writer, the idempotent correction is:
-- update public.account_inactivity_warnings
-- set deletion_scheduled_at = public.inactivity_deletion_date(warned_at)
-- where deletion_scheduled_at > warned_at + interval '29 days'
--   and deletion_scheduled_at <= warned_at + interval '30 days';

create index if not exists account_inactivity_warnings_pending_idx
  on public.account_inactivity_warnings (warned_at)
  where email_sent_at is null;

create or replace function public.claim_inactive_account_warning(
  p_user_id uuid,
  p_delay_days integer,
  p_attempt_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheduled_at timestamptz;
begin
  if p_user_id is null or p_attempt_id is null or p_delay_days is distinct from 365 then
    return null;
  end if;
  v_scheduled_at := public.inactivity_deletion_date(now());

  insert into public.account_inactivity_warnings (user_id, warned_at, deletion_scheduled_at, email_attempted_at, email_attempt_id)
  select a.user_id, now(), v_scheduled_at, now(), p_attempt_id
  from public.account_activity() a
  where a.user_id = p_user_id
    and a.email is not null
    and public.account_is_inactive_for_warning(a.last_activity_at, now())
  on conflict (user_id) do nothing;

  if not found then return null; end if;
  return v_scheduled_at;
end;
$$;

create or replace function public.get_inactive_accounts_pending_warning(p_limit integer default 50)
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_activity_at timestamptz,
  deletion_scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.email, a.first_name, a.last_activity_at, w.deletion_scheduled_at
  from public.account_inactivity_warnings w
  join public.account_activity() a on a.user_id = w.user_id
  where w.email_sent_at is null
    and public.account_warning_attempt_lease_available(w.email_attempted_at, now())
    and a.last_activity_at <= w.warned_at
    and a.email is not null
  order by w.warned_at
  limit least(greatest(coalesce(p_limit, 50), 0), 50)
$$;

create or replace function public.refresh_pending_account_warning(
  p_user_id uuid,
  p_delay_days integer,
  p_attempt_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheduled_at timestamptz;
begin
  if p_user_id is null or p_attempt_id is null or p_delay_days is distinct from 365 then
    return null;
  end if;
  v_scheduled_at := public.inactivity_deletion_date(now());

  update public.account_inactivity_warnings w
  set warned_at = now(), deletion_scheduled_at = v_scheduled_at,
      email_attempted_at = now(), email_attempt_id = p_attempt_id
  from public.account_activity() a
  where w.user_id = p_user_id
    and w.email_sent_at is null
    and public.account_warning_attempt_lease_available(w.email_attempted_at, now())
    and a.user_id = w.user_id
    and a.last_activity_at <= w.warned_at
    and public.account_is_inactive_for_warning(a.last_activity_at, now())
  returning w.deletion_scheduled_at into v_scheduled_at;

  if not found then return null; end if;
  return v_scheduled_at;
end;
$$;

create or replace function public.confirm_inactivity_warning_sent(
  p_user_id uuid,
  p_attempt_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_inactivity_warnings w
  set email_sent_at = now()
  where w.user_id = p_user_id
    and w.email_attempt_id = p_attempt_id
    and w.email_sent_at is null
    and w.deletion_scheduled_at >= now() + interval '365 days';
  return found;
end;
$$;

create or replace function public.get_inactive_accounts_to_warn(p_limit integer default 50)
returns table (user_id uuid, email text, first_name text, last_activity_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.email, a.first_name, a.last_activity_at
  from public.account_activity() a
  where public.account_is_inactive_for_warning(a.last_activity_at, now())
    and a.email is not null
    and not exists (
      select 1 from public.account_inactivity_warnings w where w.user_id = a.user_id
    )
  order by a.last_activity_at
  limit least(greatest(coalesce(p_limit, 50), 0), 50)
$$;

create or replace function public.is_inactive_account_deletion_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_inactivity_warnings w
    join public.account_activity() a on a.user_id = w.user_id
    where w.user_id = p_user_id
      and public.account_warning_deletion_eligible(
        w.warned_at, w.email_sent_at, w.deletion_scheduled_at, a.last_activity_at, now()
      )
  )
$$;

create or replace function public.get_inactive_accounts_to_delete(p_limit integer default 20)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Auth deletion is a separate service call and cannot be conditioned on
  -- the latest activity. Keep this RPC closed until an Auth-side reconnect
  -- gate exists; this also protects an older Edge Function deployment.
  select null::uuid where false
$$;

-- Persist the Storage plan in the same transaction that transfers/deletes
-- account events. If Storage or Auth later fails, a retry receives the same
-- object names even though the originating events are already gone.
alter function public.prepare_account_deletion(uuid) set search_path = '';

create table if not exists public.account_deletion_storage_queue (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, bucket_id, name)
);
alter table public.account_deletion_storage_queue enable row level security;
revoke all on public.account_deletion_storage_queue from public, anon, authenticated;
grant all on public.account_deletion_storage_queue to service_role;

create or replace function public.prepare_account_deletion_with_storage_queue(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_files jsonb;
begin
  v_plan := public.prepare_account_deletion(p_user_id);
  if v_plan is null then
    raise exception 'account deletion preparation returned no plan';
  end if;

  insert into public.account_deletion_storage_queue (user_id, bucket_id, name)
  select p_user_id, f.value->>'bucket', f.value->>'name'
  from jsonb_array_elements(coalesce(v_plan->'files', '[]'::jsonb)) f(value)
  on conflict (user_id, bucket_id, name) do nothing;

  -- Storage deletion may have succeeded just before the client lost its
  -- response. Drop queue entries whose object metadata is already gone so a
  -- retry does not depend on Storage treating removal as idempotent.
  delete from public.account_deletion_storage_queue q
  where q.user_id = p_user_id
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = q.bucket_id and o.name = q.name
    );

  select coalesce(
    jsonb_agg(jsonb_build_object('bucket', q.bucket_id, 'name', q.name) order by q.bucket_id, q.name),
    '[]'::jsonb
  )
  into v_files
  from public.account_deletion_storage_queue q
  where q.user_id = p_user_id;

  return v_plan || jsonb_build_object('files', v_files);
end;
$$;

create or replace function public.prepare_inactive_account_deletion_with_storage_queue(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'automatic account deletion is disabled until reconnects can be excluded atomically'
    using errcode = '55000';
end;
$$;

revoke all on function public.inactivity_deletion_date(timestamptz) from public, anon, authenticated;
revoke all on function public.account_is_inactive_for_warning(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.account_warning_deletion_eligible(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.account_warning_attempt_lease_available(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_inactive_account_warning(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.account_activity() from public, anon, authenticated;
revoke all on function public.events_past_guest_retention() from public, anon, authenticated;
revoke all on function public.get_inactive_accounts_pending_warning(integer) from public, anon, authenticated;
revoke all on function public.refresh_pending_account_warning(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.confirm_inactivity_warning_sent(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_inactive_accounts_to_warn(integer) from public, anon, authenticated;
revoke all on function public.is_inactive_account_deletion_eligible(uuid) from public, anon, authenticated;
revoke all on function public.get_inactive_accounts_to_delete(integer) from public, anon, authenticated;
revoke all on function public.prepare_account_deletion_with_storage_queue(uuid) from public, anon, authenticated;
revoke all on function public.prepare_inactive_account_deletion_with_storage_queue(uuid) from public, anon, authenticated;
grant execute on function public.inactivity_deletion_date(timestamptz) to service_role;
grant execute on function public.account_is_inactive_for_warning(timestamptz, timestamptz) to service_role;
grant execute on function public.account_warning_deletion_eligible(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.account_warning_attempt_lease_available(timestamptz, timestamptz) to service_role;
grant execute on function public.claim_inactive_account_warning(uuid, integer, uuid) to service_role;
grant execute on function public.account_activity() to service_role;
grant execute on function public.events_past_guest_retention() to service_role;
grant execute on function public.get_inactive_accounts_pending_warning(integer) to service_role;
grant execute on function public.refresh_pending_account_warning(uuid, integer, uuid) to service_role;
grant execute on function public.confirm_inactivity_warning_sent(uuid, uuid) to service_role;
grant execute on function public.get_inactive_accounts_to_warn(integer) to service_role;
grant execute on function public.is_inactive_account_deletion_eligible(uuid) to service_role;
grant execute on function public.get_inactive_accounts_to_delete(integer) to service_role;
grant execute on function public.prepare_account_deletion_with_storage_queue(uuid) to service_role;
grant execute on function public.prepare_inactive_account_deletion_with_storage_queue(uuid) to service_role;
