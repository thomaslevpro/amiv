do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type%';

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'invitation_received','event_invitation','rsvp_received','message_received',
    'birthday_reminder','birthday_today','event_updated','friend_request','friend_accepted',
    'plus_one_request','plus_one_response'
  ));

create or replace function public.create_birthday_today_notifications()
returns table(inserted_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  birthday_count integer := 0;
begin
  with today_birthdays as (
    select
      b.id,
      b.user_id,
      coalesce(nullif(trim(b.name), ''), 'ton Amiv') as name
    from public.birthdays b
    where b.reminder_enabled = true
      and extract(month from b.birthdate)::integer = extract(month from now()::date)::integer
      and extract(day from b.birthdate)::integer = extract(day from now()::date)::integer
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      b.user_id,
      'birthday_today',
      format('🎂 C''est l''anniversaire de %s aujourd''hui !', b.name),
      'N''oubliez pas de lui souhaiter un joyeux anniversaire 🎉',
      jsonb_build_object(
        'birthday_id', b.id::text,
        'birthday_name', b.name
      ),
      false
    from today_birthdays b
    where not exists (
      select 1
      from public.notifications n
      where n.type = 'birthday_today'
        and n.data->>'birthday_id' = b.id::text
        and n.created_at::date = now()::date
    )
    returning 1
  )
  select
    (select count(*) from today_birthdays)::integer,
    (select count(*) from inserted)::integer
  into birthday_count, inserted_count;

  skipped_count := birthday_count - inserted_count;
  return next;
end;
$$;

grant execute on function public.create_birthday_today_notifications() to service_role;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('birthday-today-reminders')
where exists (
  select 1
  from cron.job
  where jobname = 'birthday-today-reminders'
);

select cron.schedule(
  'birthday-today-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://kftzfljdewojxhxcuxnd.supabase.co/functions/v1/birthday-today-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
