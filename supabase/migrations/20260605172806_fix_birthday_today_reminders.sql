create unique index if not exists notifications_birthday_reminder_once_per_day_idx
  on public.notifications (
    user_id,
    type,
    ((data->>'birthday_id')),
    ((data->>'reminder_date'))
  )
  where type = 'birthday_reminder'
    and data ? 'birthday_id'
    and data ? 'reminder_date';

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
      coalesce(nullif(trim(concat_ws(' ', b.name, b.last_name)), ''), 'ton Amiv') as name
    from public.birthdays b
    where b.reminder_enabled = true
      and b.birthdate is not null
      and extract(month from b.birthdate)::integer = extract(month from current_date)::integer
      and extract(day from b.birthdate)::integer = extract(day from current_date)::integer
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      b.user_id,
      'birthday_reminder',
      format('C''est l''anniversaire de %s aujourd''hui !', b.name),
      'N''oubliez pas de lui souhaiter un joyeux anniversaire.',
      jsonb_build_object(
        'birthday_id', b.id::text,
        'birthday_name', b.name,
        'reminder_day', 0,
        'reminder_date', current_date::text
      ),
      false
    from today_birthdays b
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = b.user_id
        and n.type = 'birthday_reminder'
        and n.data->>'birthday_id' = b.id::text
        and n.data->>'reminder_date' = current_date::text
    )
    on conflict do nothing
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_FNAFgult5S2iSkXXd2SgKQ_aX8Z3eIK',
      'Authorization', 'Bearer sb_publishable_FNAFgult5S2iSkXXd2SgKQ_aX8Z3eIK'
    ),
    body := '{}'::jsonb
  );
  $$
);
