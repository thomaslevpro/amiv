create table if not exists public.support_message_daily_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  message_count integer not null default 0 check (message_count between 0 and 5),
  primary key (user_id, usage_date)
);

alter table public.support_message_daily_limits enable row level security;
revoke all on public.support_message_daily_limits from anon, authenticated;
grant all on public.support_message_daily_limits to service_role;

create or replace function public.claim_support_message_daily_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  insert into public.support_message_daily_limits (user_id, usage_date, message_count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set message_count = public.support_message_daily_limits.message_count + 1
    where public.support_message_daily_limits.message_count < 5
  returning message_count into claimed_count;

  return claimed_count is not null;
end;
$$;

revoke all on function public.claim_support_message_daily_limit(uuid) from public, anon, authenticated;
grant execute on function public.claim_support_message_daily_limit(uuid) to service_role;
