-- Read-only checks for retention predicates, SQL effects, permissions and cron.
-- Keep the data-retention cron inactive before running this script. It inspects
-- run_data_retention()'s definition and never invokes the purge function.

do $$
declare
  v_now timestamptz := '2026-10-28 03:00:00+00';
  v_warned timestamptz := '2023-10-28 03:00:00+00';
  v_sent timestamptz := '2023-10-28 03:00:30+00';
  v_scheduled timestamptz := v_sent + interval '365 days';
  v_run_at timestamptz;
  v_automatic_delete_blocked boolean := false;
  v_cron_jobs integer;
  v_cron_secrets integer;
  v_retention_definition text;
  v_event_retention_definition text;
  v_required_effect text;
begin
  v_retention_definition := pg_get_functiondef('public.run_data_retention()'::regprocedure);
  v_event_retention_definition := pg_get_functiondef('public.events_past_guest_retention()'::regprocedure);
  foreach v_required_effect in array array[
    'delete from public.notifications',
    'created_at < now() - interval ''6 months''',
    'delete from public.activity',
    'created_at < now() - interval ''12 months''',
    'delete from public.reports',
    'coalesce(handled_at, created_at) < now() - interval ''12 months''',
    'delete from public.support_message_daily_limits',
    'usage_date < (now() at time zone ''utc'')::date',
    'delete from public.guest_rsvps',
    'event_id in (select public.events_past_guest_retention())',
    'delete from public.public_rsvps',
    'event_id is null and created_at < now() - interval ''12 months''',
    'delete from public.invitations',
    'invited_user_id is null',
    'set invited_email = null',
    'invited_user_id is not null',
    'invited_email is not null',
    'set plus_one_name = null, plus_one_message = null',
    '(plus_one_name is not null or plus_one_message is not null)',
    'a.last_activity_at > w.warned_at',
    'delete from public.account_inactivity_warnings'
  ] loop
    if position(v_required_effect in lower(v_retention_definition)) = 0 then
      raise exception 'run_data_retention() is missing expected retention effect: %', v_required_effect;
    end if;
  end loop;
  foreach v_required_effect in array array[
    'e.date',
    'max(o.proposed_date)::timestamp at time zone ''utc''',
    'e.created_at',
    'interval ''12 months'''
  ] loop
    if position(v_required_effect in lower(v_event_retention_definition)) = 0 then
      raise exception 'events_past_guest_retention() is missing expected date rule: %', v_required_effect;
    end if;
  end loop;

  if exists (
    select 1
    from public.account_inactivity_warnings
    where email_sent_at is null and email_attempted_at is null
  ) then
    raise exception 'legacy warning rows were not backfilled as previously accepted emails';
  end if;

  if public.account_is_inactive_for_warning(v_now - interval '3 years', v_now) then
    raise exception 'exactly three years must not cross the strict inactivity threshold';
  end if;
  if not public.account_is_inactive_for_warning(v_now - interval '3 years' - interval '1 microsecond', v_now) then
    raise exception 'activity older than three years must cross the inactivity threshold';
  end if;
  if public.account_is_inactive_for_warning(null, v_now) then
    raise exception 'null activity must not qualify as inactive';
  end if;

  if public.account_warning_attempt_lease_available(v_now, v_now) then
    raise exception 'a concurrent warning attempt must hold its lease';
  end if;
  if public.account_warning_attempt_lease_available(v_now - interval '10 minutes', v_now) then
    raise exception 'the lease must remain held at the exact 10-minute boundary';
  end if;
  if not public.account_warning_attempt_lease_available(v_now - interval '10 minutes' - interval '1 microsecond', v_now) then
    raise exception 'an expired warning-attempt lease must be retryable';
  end if;

  if not public.account_warning_deletion_eligible(v_warned, v_sent, v_scheduled, v_warned, v_scheduled) then
    raise exception 'the exact 365-day boundary with a sent warning should be eligible';
  end if;
  if public.account_warning_deletion_eligible(v_warned, v_sent, v_scheduled, v_warned, v_scheduled - interval '1 microsecond') then
    raise exception 'an unexpired schedule must not be eligible';
  end if;
  if public.account_warning_deletion_eligible(v_warned, v_sent, v_sent + interval '365 days' - interval '1 microsecond', v_warned, v_scheduled) then
    raise exception 'a schedule shorter than 365 days after send must not be eligible';
  end if;
  if public.account_warning_deletion_eligible(v_warned, null, v_scheduled, v_warned, v_scheduled) then
    raise exception 'an unconfirmed email must not be eligible';
  end if;
  if public.account_warning_deletion_eligible(v_warned, v_sent, v_scheduled, null, v_scheduled) then
    raise exception 'unknown activity must not be eligible for deletion';
  end if;
  if public.account_warning_deletion_eligible(v_warned, v_sent, v_scheduled, v_warned + interval '1 microsecond', v_scheduled) then
    raise exception 'activity after the warning must cancel deletion eligibility';
  end if;
  if public.account_warning_deletion_eligible(
    v_warned, v_warned, v_warned + interval '30 days', v_warned, v_scheduled
  ) then
    raise exception 'legacy 30-day warning rows must never qualify for automatic deletion';
  end if;

  v_run_at := public.inactivity_deletion_date('2025-01-01 02:30:00+00');
  if v_run_at < '2026-01-01 03:30:00+00'::timestamptz
     or extract(hour from v_run_at at time zone 'utc') <> 3 then
    raise exception 'scheduled deletion must wait at least 365 days plus the send margin and align to 03:00 UTC';
  end if;

  v_run_at := public.inactivity_deletion_date('2025-01-01 01:00:00+00');
  if v_run_at <> '2026-01-01 03:00:00+00'::timestamptz then
    raise exception 'the next 03:00 UTC cron run should be selected when it follows the minimum delay';
  end if;

  if exists (select 1 from public.get_inactive_accounts_to_delete(20)) then
    raise exception 'automatic deletion candidate RPC must stay closed';
  end if;

  if has_function_privilege('anon', 'public.run_data_retention()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.run_data_retention()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.run_data_retention()', 'EXECUTE') then
    raise exception 'run_data_retention must be executable only by service_role';
  end if;
  if has_function_privilege('anon', 'public.get_inactive_accounts_to_delete(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_inactive_accounts_to_delete(integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_inactive_accounts_to_delete(integer)', 'EXECUTE') then
    raise exception 'automatic deletion candidate RPC permissions are not service_role-only';
  end if;
  if has_table_privilege('anon', 'public.account_inactivity_warnings', 'SELECT')
     or has_table_privilege('authenticated', 'public.account_inactivity_warnings', 'SELECT')
     or not has_table_privilege('service_role', 'public.account_inactivity_warnings', 'SELECT') then
    raise exception 'inactivity warning rows must be readable only by service_role';
  end if;

  select count(*) into v_cron_jobs
  from cron.job
  where jobname = 'data-retention'
    and schedule = '0 3 * * *'
    and active = false
    and command like '%/functions/v1/data-retention%'
    and command like '%name = ''project_url''%'
    and command like '%name = ''publishable_key''%'
    and command like '%name = ''cron_secret''%'
    and command not like '%kftzfljdewojxhxcuxnd%';
  if v_cron_jobs <> 1 then
    raise exception 'expected one inactive daily 03:00 UTC data-retention cron job using environment-specific Vault secrets, found %', v_cron_jobs;
  end if;
  select count(*) into v_cron_secrets
  from vault.decrypted_secrets
  where name in ('project_url', 'publishable_key', 'cron_secret')
    and nullif(decrypted_secret, '') is not null;
  if v_cron_secrets <> 3 then
    raise exception 'project_url, publishable_key and cron_secret must all be configured in Vault';
  end if;
  if exists (
    select 1
    from vault.decrypted_secrets
    where name = 'project_url'
      and decrypted_secret like '%kftzfljdewojxhxcuxnd%'
  ) then
    raise exception 'staging verification must not point Vault project_url at production';
  end if;
  if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC', 'Etc/UTC') then
    raise exception 'data-retention cron must use a UTC timezone';
  end if;

  begin
    perform public.prepare_inactive_account_deletion_with_storage_queue('00000000-0000-0000-0000-000000000001'::uuid);
  exception when sqlstate '55000' then
    v_automatic_delete_blocked := true;
  end;
  if not v_automatic_delete_blocked then
    raise exception 'automatic deletion preparation must fail closed';
  end if;
end;
$$;
