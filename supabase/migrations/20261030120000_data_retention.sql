-- Durées de conservation annoncées dans la politique de confidentialité
-- (/confidentialite). Le cron quotidien data-retention appelle l'Edge
-- Function du même nom (header x-cron-secret), qui :
--   1. lance run_data_retention() : purges SQL ci-dessous ;
--   2. consulte les candidats à la suppression (désactivée par défaut dans
--      la migration 20261030130000_inactivity_warning_delivery) ;
--   3. avertit par email les comptes sans activité depuis 3 ans.
--
--   notifications                         6 mois après création
--   activity                              12 mois après création
--   reports                               12 mois après handled_at (création à défaut)
--   support_message_daily_limits          compteurs des jours passés
--   guest_rsvps, public_rsvps             12 mois après la date de l'événement
--   invitations sans compte               12 mois après la date de l'événement
--   invitations.invited_email (avec compte), nom et message des +1 : effacés au même terme

-- Deployment guard: if this job already exists in the target database, commit
-- cron.alter_job(jobid, active := false) before applying this migration. The
-- replacement job below is created inactive in the same statement as schedule.

-- ── Date de traitement des signalements ─────────────────────────────────────
alter table public.reports add column if not exists handled_at timestamptz;

comment on column public.reports.handled_at is
  'Date de traitement par l''éditeur. Le signalement est supprimé 12 mois après (12 mois après created_at si jamais traité).';

-- ── Avertissements d'inactivité ─────────────────────────────────────────────
-- Une ligne suit un avertissement d'inactivité. La migration de livraison
-- distingue les tentatives des emails confirmés; la suppression automatique
-- reste explicitement désactivée tant que la reconnexion n'est pas atomique.
create table if not exists public.account_inactivity_warnings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  warned_at timestamptz not null default now(),
  deletion_scheduled_at timestamptz not null
);

alter table public.account_inactivity_warnings enable row level security;
revoke all on public.account_inactivity_warnings from anon, authenticated;
grant all on public.account_inactivity_warnings to service_role;

-- ── Dernière activité d'un compte ───────────────────────────────────────────
-- last_sign_in_at ne bouge pas tant que la session est rafraîchie : on prend
-- aussi le dernier rafraîchissement de session (refreshed_at est en UTC sans
-- fuseau).
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
    greatest(u.created_at, u.last_sign_in_at, s.last_session_at)
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

-- ── Événements passés depuis plus de 12 mois ────────────────────────────────
-- Date de référence : date de l'événement, sinon dernière date proposée au
-- sondage, sinon date de création.
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

-- ── Purges quotidiennes ─────────────────────────────────────────────────────
create or replace function public.run_data_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notifications integer;
  v_activity integer;
  v_reports integer;
  v_support_limits integer;
  v_guest_rsvps integer;
  v_public_rsvps integer;
  v_invitations_deleted integer;
  v_invitations_emails_cleared integer;
  v_plus_ones_cleared integer;
  v_warnings_reset integer;
begin
  delete from public.notifications
  where created_at < now() - interval '6 months';
  get diagnostics v_notifications = row_count;

  delete from public.activity
  where created_at < now() - interval '12 months';
  get diagnostics v_activity = row_count;

  delete from public.reports
  where coalesce(handled_at, created_at) < now() - interval '12 months';
  get diagnostics v_reports = row_count;

  delete from public.support_message_daily_limits
  where usage_date < (now() at time zone 'utc')::date;
  get diagnostics v_support_limits = row_count;

  -- Personnes sans compte
  delete from public.guest_rsvps
  where event_id in (select public.events_past_guest_retention());
  get diagnostics v_guest_rsvps = row_count;

  delete from public.public_rsvps
  where event_id in (select public.events_past_guest_retention())
     or (event_id is null and created_at < now() - interval '12 months');
  get diagnostics v_public_rsvps = row_count;

  delete from public.invitations
  where invited_user_id is null
    and (
      event_id in (select public.events_past_guest_retention())
      or (event_id is null and created_at < now() - interval '12 months')
    );
  get diagnostics v_invitations_deleted = row_count;

  update public.invitations
  set invited_email = null
  where invited_user_id is not null
    and invited_email is not null
    and event_id in (select public.events_past_guest_retention());
  get diagnostics v_invitations_emails_cleared = row_count;

  -- Nom et message des +1 (personnes sans compte) des utilisateurs inscrits
  update public.rsvps
  set plus_one_name = null, plus_one_message = null
  where (plus_one_name is not null or plus_one_message is not null)
    and event_id in (select public.events_past_guest_retention());
  get diagnostics v_plus_ones_cleared = row_count;

  -- Comptes revenus après l'avertissement : on annule la suppression
  delete from public.account_inactivity_warnings w
  using public.account_activity() a
  where a.user_id = w.user_id
    and a.last_activity_at > w.warned_at;
  get diagnostics v_warnings_reset = row_count;

  return jsonb_build_object(
    'notifications', v_notifications,
    'activity', v_activity,
    'reports', v_reports,
    'support_limits', v_support_limits,
    'guest_rsvps', v_guest_rsvps,
    'public_rsvps', v_public_rsvps,
    'invitations_deleted', v_invitations_deleted,
    'invitations_emails_cleared', v_invitations_emails_cleared,
    'plus_ones_cleared', v_plus_ones_cleared,
    'inactivity_warnings_reset', v_warnings_reset
  );
end;
$$;

-- ── Comptes inactifs ────────────────────────────────────────────────────────
create or replace function public.get_inactive_accounts_to_warn(p_limit integer default 50)
returns table (user_id uuid, email text, first_name text, last_activity_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.email, a.first_name, a.last_activity_at
  from public.account_activity() a
  where a.last_activity_at < now() - interval '3 years'
    and a.email is not null
    and not exists (
      select 1 from public.account_inactivity_warnings w where w.user_id = a.user_id
    )
  order by a.last_activity_at
  limit p_limit
$$;

-- Fail closed from this migration onward: the newly scheduled cron may run
-- before the follow-up warning-delivery migration is applied, so no candidate
-- can be returned to an older deployed Edge Function during that interval.
create or replace function public.get_inactive_accounts_to_delete(p_limit integer default 20)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select null::uuid where false
$$;

revoke all on function public.account_activity() from public, anon, authenticated;
revoke all on function public.events_past_guest_retention() from public, anon, authenticated;
revoke all on function public.run_data_retention() from public, anon, authenticated;
revoke all on function public.get_inactive_accounts_to_warn(integer) from public, anon, authenticated;
revoke all on function public.get_inactive_accounts_to_delete(integer) from public, anon, authenticated;
grant execute on function public.account_activity() to service_role;
grant execute on function public.events_past_guest_retention() to service_role;
grant execute on function public.run_data_retention() to service_role;
grant execute on function public.get_inactive_accounts_to_warn(integer) to service_role;
grant execute on function public.get_inactive_accounts_to_delete(integer) to service_role;

-- ── Cron ────────────────────────────────────────────────────────────────────
-- 03:00 UTC, en dehors des autres jobs (reveal-memories 06:00, rappels 08:00).
-- Configure project_url, publishable_key and cron_secret in Vault separately
-- in each Supabase project. This keeps staging and local jobs within their
-- own environment instead of embedding the production URL in the migration.
-- New jobs are created inactive in one SQL statement; the migration cannot
-- commit an active retention cron that could purge while staging is validated.
select cron.unschedule('data-retention')
where exists (select 1 from cron.job where jobname = 'data-retention');

with scheduled as (
  select cron.schedule(
    'data-retention',
    '0 3 * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/data-retention',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $$
  ) as job_id
)
select cron.alter_job(job_id, active := false)
from scheduled;
