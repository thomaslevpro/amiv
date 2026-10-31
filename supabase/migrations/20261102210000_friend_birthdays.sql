-- Anniversaires des amis Amiv : une ligne birthdays par ami accepté.
--
-- Remplace le rappel J-7 envoyé aux amis (send_friend_birthday_reminders,
-- tâche « friend-birthday-reminders », supprimés ici).
--
-- birthdays.friend_user_id = l'ami dont la ligne suit la date de profil
-- (profiles.birthday). Une seule ligne par (user_id, friend_user_id), aussi
-- liée au profil (linked_profile_id) pour l'affichage. Nom = prénom de l'ami,
-- rappel jour J par défaut. Année inconnue du profil (< 1900) → 2000, la
-- convention « année inconnue » de birthdays.
--
-- sync_friend_birthday(owner, friend) est la seule règle :
--   - pas d'amitié acceptée, ou l'utilisateur a supprimé la ligne → rien ;
--   - l'ami n'a pas de date → la ligne liée est supprimée ;
--   - sinon la ligne liée prend la date du profil ; à défaut, un anniversaire
--     déjà lié à la main à cet ami (linked_profile_id) devient la ligne
--     automatique ; à défaut, une ligne est créée.
-- Appelée quand une demande est acceptée (dans les deux sens), quand la date
-- de profil change, et pour le rattrapage des amitiés existantes.
--
-- Fin d'amitié (refus, suppression, compte supprimé) : les lignes liées des
-- deux côtés et les traces de suppression de la paire sont supprimées.
--
-- Supprimer soi-même une ligne liée n'affecte pas l'amitié et laisse une trace
-- (birthday_friend_dismissals) : la ligne n'est plus recréée tant que
-- l'amitié dure. Les suppressions faites par les triggers ne laissent pas de
-- trace (elles ne sont pas faites par le rôle authenticated).
--
-- Depuis l'app, friend_user_id ne peut être ni posé ni modifié, et la date
-- et le lien au profil d'une ligne liée sont ceux du profil de l'ami.
--
-- Envoi : pas de rappel pour une ligne liée si l'un des deux a bloqué l'autre
-- (le blocage conserve une amitié acceptée).

-- ── Colonne et trace de suppression ────────────────────────────────────────
alter table public.birthdays
  add column if not exists friend_user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists birthdays_user_friend_idx
  on public.birthdays (user_id, friend_user_id)
  where friend_user_id is not null;

create table if not exists public.birthday_friend_dismissals (
  user_id uuid not null,
  friend_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_user_id)
);

alter table public.birthday_friend_dismissals enable row level security;
revoke all on public.birthday_friend_dismissals from anon, authenticated;

-- ── Règle de synchronisation ───────────────────────────────────────────────
create or replace function public.are_accepted_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

revoke all on function public.are_accepted_friends(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_friend_birthday(p_owner uuid, p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birthday date;
  v_date date;
  v_name text;
  v_id uuid;
begin
  if p_owner is null or p_friend is null or p_owner = p_friend then
    return;
  end if;
  if not public.are_accepted_friends(p_owner, p_friend) then
    return;
  end if;
  if exists (select 1 from public.birthday_friend_dismissals d
             where d.user_id = p_owner and d.friend_user_id = p_friend) then
    return;
  end if;

  select p.birthday,
         coalesce(nullif(btrim(p.first_name), ''), public.profile_full_name(p.first_name, p.name), nullif('@' || p.username, '@'), 'Ami')
    into v_birthday, v_name
  from public.profiles p
  where p.id = p_friend;

  if v_birthday is null then
    delete from public.birthdays b where b.user_id = p_owner and b.friend_user_id = p_friend;
    return;
  end if;

  v_date := case
    when extract(year from v_birthday) < 1900
      then make_date(2000, extract(month from v_birthday)::int, extract(day from v_birthday)::int)
    else v_birthday
  end;

  update public.birthdays b
     set birthdate = v_date, linked_profile_id = p_friend
   where b.user_id = p_owner and b.friend_user_id = p_friend;
  if found then
    return;
  end if;

  select b.id into v_id
  from public.birthdays b
  where b.user_id = p_owner and b.linked_profile_id = p_friend and b.friend_user_id is null
  order by b.created_at nulls last, b.id
  limit 1;

  if v_id is not null then
    update public.birthdays b
       set friend_user_id = p_friend, birthdate = v_date
     where b.id = v_id;
    return;
  end if;

  insert into public.birthdays (user_id, name, birthdate, linked_profile_id, friend_user_id)
  values (p_owner, left(v_name, 60), v_date, p_friend, p_friend)
  on conflict do nothing;
end;
$$;

revoke all on function public.sync_friend_birthday(uuid, uuid) from public, anon, authenticated;

create or replace function public.remove_friend_birthdays(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.are_accepted_friends(p_a, p_b) then
    return;
  end if;
  delete from public.birthdays b
   where (b.user_id = p_a and b.friend_user_id = p_b)
      or (b.user_id = p_b and b.friend_user_id = p_a);
  delete from public.birthday_friend_dismissals d
   where (d.user_id = p_a and d.friend_user_id = p_b)
      or (d.user_id = p_b and d.friend_user_id = p_a);
end;
$$;

revoke all on function public.remove_friend_birthdays(uuid, uuid) from public, anon, authenticated;

-- ── Amitiés ────────────────────────────────────────────────────────────────
create or replace function public.on_friendship_birthdays()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    perform public.sync_friend_birthday(new.requester_id, new.addressee_id);
    perform public.sync_friend_birthday(new.addressee_id, new.requester_id);
  end if;

  if tg_op = 'DELETE' then
    perform public.remove_friend_birthdays(old.requester_id, old.addressee_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted' and new.status is distinct from 'accepted' then
    perform public.remove_friend_birthdays(old.requester_id, old.addressee_id);
  end if;
  return new;
end;
$$;

revoke all on function public.on_friendship_birthdays() from public, anon, authenticated;

drop trigger if exists trg_friendship_birthdays on public.friendships;
create trigger trg_friendship_birthdays
  after insert or update of status or delete on public.friendships
  for each row execute function public.on_friendship_birthdays();

-- ── Date de profil ─────────────────────────────────────────────────────────
create or replace function public.on_profile_birthday_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend uuid;
begin
  for v_friend in
    select case when f.requester_id = new.id then f.addressee_id else f.requester_id end
    from public.friendships f
    where f.status = 'accepted' and (f.requester_id = new.id or f.addressee_id = new.id)
  loop
    perform public.sync_friend_birthday(v_friend, new.id);
  end loop;
  return new;
end;
$$;

revoke all on function public.on_profile_birthday_changed() from public, anon, authenticated;

drop trigger if exists trg_profile_birthday_changed on public.profiles;
create trigger trg_profile_birthday_changed
  after update of birthday on public.profiles
  for each row
  when (old.birthday is distinct from new.birthday)
  execute function public.on_profile_birthday_changed();

-- ── Garde-fous côté app ────────────────────────────────────────────────────
-- Pas security definer : current_user est le rôle de l'app quand la ligne
-- est écrite depuis l'app, et le propriétaire des fonctions ci-dessus quand
-- elle l'est par un trigger.
create or replace function public.guard_friend_birthday()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.friend_user_id := null;
  elsif old.friend_user_id is not null then
    new.friend_user_id := old.friend_user_id;
    new.birthdate := old.birthdate;
    new.linked_profile_id := old.linked_profile_id;
  else
    new.friend_user_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_friend_birthday on public.birthdays;
create trigger trg_guard_friend_birthday
  before insert or update on public.birthdays
  for each row execute function public.guard_friend_birthday();

create or replace function public.record_friend_birthday_dismissal(p_friend uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.birthday_friend_dismissals (user_id, friend_user_id)
  select auth.uid(), p_friend
  where auth.uid() is not null
    and public.are_accepted_friends(auth.uid(), p_friend)
  on conflict do nothing;
$$;

revoke all on function public.record_friend_birthday_dismissal(uuid) from public, anon;
grant execute on function public.record_friend_birthday_dismissal(uuid) to authenticated;

create or replace function public.on_friend_birthday_deleted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.friend_user_id is not null and current_user = 'authenticated' and old.user_id = auth.uid() then
    perform public.record_friend_birthday_dismissal(old.friend_user_id);
  end if;
  return old;
end;
$$;

drop trigger if exists trg_friend_birthday_deleted on public.birthdays;
create trigger trg_friend_birthday_deleted
  after delete on public.birthdays
  for each row execute function public.on_friend_birthday_deleted();

-- ── Envoi : rien pour une ligne liée entre personnes bloquées ──────────────
create or replace function public.create_birthday_today_notifications()
returns table(inserted_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  due_count integer := 0;
begin
  with candidates as (
    select
      b.id,
      b.user_id,
      b.birthdate,
      o.days,
      (current_date + o.days) as target,
      coalesce(nullif(trim(concat_ws(' ', b.name, b.last_name)), ''), 'ton Amiv') as name
    from public.birthdays b
    cross join lateral unnest(array[0] || b.reminder_days) as o(days)
    where b.reminder_enabled = true
      and b.user_id is not null
      and b.birthdate is not null
      and (b.friend_user_id is null or not public.is_blocked_between(b.user_id, b.friend_user_id))
  ),
  due as (
    select c.*
    from candidates c
    where to_char(c.birthdate, 'MM-DD') = to_char(c.target, 'MM-DD')
       or (to_char(c.birthdate, 'MM-DD') = '02-29'
           and to_char(c.target, 'MM-DD') = '02-28'
           and extract(day from make_date(extract(year from c.target)::int, 3, 1) - 1) = 28)
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      d.user_id,
      'birthday_reminder',
      case d.days
        when 0 then format('C''est l''anniversaire de %s aujourd''hui !', d.name)
        when 1 then format('L''anniversaire de %s est demain 🎂', d.name)
        else format('L''anniversaire de %s est dans %s jours 🎂', d.name, d.days)
      end,
      case d.days
        when 0 then 'N''oubliez pas de lui souhaiter un joyeux anniversaire.'
        else 'Il est encore temps de préparer une surprise.'
      end,
      jsonb_build_object(
        'birthday_id', d.id::text,
        'birthday_name', d.name,
        'reminder_day', d.days,
        'reminder_date', current_date::text,
        'birthday_date', d.target::text
      ),
      false
    from due d
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = d.user_id
        and n.type = 'birthday_reminder'
        and n.data->>'birthday_id' = d.id::text
        and n.data->>'reminder_date' = current_date::text
    )
    on conflict do nothing
    returning 1
  )
  select
    (select count(*) from due)::integer,
    (select count(*) from inserted)::integer
  into due_count, inserted_count;

  skipped_count := due_count - inserted_count;
  return next;
end;
$$;

revoke all on function public.create_birthday_today_notifications() from public, anon, authenticated;
grant execute on function public.create_birthday_today_notifications() to service_role;

-- ── Fin du rappel J-7 aux amis ─────────────────────────────────────────────
select cron.unschedule('friend-birthday-reminders')
where exists (select 1 from cron.job where jobname = 'friend-birthday-reminders');

drop function if exists public.send_friend_birthday_reminders();

-- ── Rattrapage des amitiés déjà acceptées ──────────────────────────────────
select public.sync_friend_birthday(f.requester_id, f.addressee_id),
       public.sync_friend_birthday(f.addressee_id, f.requester_id)
from public.friendships f
where f.status = 'accepted';
