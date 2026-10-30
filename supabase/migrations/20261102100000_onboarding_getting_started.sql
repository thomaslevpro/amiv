-- Nouvel onboarding.
--
-- 1. Carte « Bien démarrer » de l'accueil : masquée par la croix
--    (profiles.getting_started_dismissed_at, modifiable par soi).
--
-- 2. Rappel aux amis 7 jours avant un anniversaire. L'écran « Anniversaire »
--    de l'onboarding annonce « Tes amis seront prévenus 7 jours avant » :
--    chaque matin, les amis acceptés d'une personne dont l'anniversaire
--    (profiles.birthday) tombe dans 7 jours reçoivent une notification
--    birthday_reminder (push selon notif_birthdays, via push_allowed).
--    Un 29 février est fêté le 28 février les années non bissextiles.
--    L'année de naissance peut être inconnue (année < 1900 côté app) :
--    seuls le jour et le mois comptent ici.

alter table public.profiles add column if not exists getting_started_dismissed_at timestamptz;
grant update (getting_started_dismissed_at) on public.profiles to authenticated;

create or replace function public.send_friend_birthday_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target date := current_date + 7;
  v_target_is_leap boolean := extract(day from (make_date(extract(year from current_date + 7)::int, 3, 1) - 1)) = 29;
  v_sent integer := 0;
begin
  with celebrated as (
    select p.id, coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.name), ''), 'Un ami') as first_name
    from public.profiles p
    join auth.users u on u.id = p.id and u.deleted_at is null
    where p.birthday is not null
      and (
        (extract(month from p.birthday) = extract(month from v_target)
          and extract(day from p.birthday) = extract(day from v_target))
        or (not v_target_is_leap
          and extract(month from v_target) = 2 and extract(day from v_target) = 28
          and extract(month from p.birthday) = 2 and extract(day from p.birthday) = 29)
      )
  ),
  recipients as (
    select distinct c.id as celebrated_id, c.first_name,
      case when f.requester_id = c.id then f.addressee_id else f.requester_id end as friend_id
    from celebrated c
    join public.friendships f
      on f.status = 'accepted' and (f.requester_id = c.id or f.addressee_id = c.id)
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      r.friend_id,
      'birthday_reminder',
      format('L''anniversaire de %s est dans 7 jours 🎂', r.first_name),
      'Il est encore temps de préparer une surprise.',
      jsonb_build_object(
        'friend_id', r.celebrated_id::text,
        'birthday_name', r.first_name,
        'reminder_day', 7,
        'reminder_date', v_target::text
      ),
      false
    from recipients r
    join auth.users u on u.id = r.friend_id and u.deleted_at is null
    where not public.is_blocked_between(r.friend_id, r.celebrated_id)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = r.friend_id
          and n.type = 'birthday_reminder'
          and n.data->>'friend_id' = r.celebrated_id::text
          and n.data->>'reminder_date' = v_target::text
      )
    returning 1
  )
  select count(*)::int into v_sent from inserted;

  return v_sent;
end;
$$;

revoke all on function public.send_friend_birthday_reminders() from public, anon, authenticated;
grant execute on function public.send_friend_birthday_reminders() to service_role;

select cron.unschedule('friend-birthday-reminders')
where exists (select 1 from cron.job where jobname = 'friend-birthday-reminders');

-- 8 h UTC, comme les rappels du jour J
select cron.schedule('friend-birthday-reminders', '0 8 * * *', $$select public.send_friend_birthday_reminders();$$);
