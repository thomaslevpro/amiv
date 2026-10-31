-- Rappels d'anniversaire : jour J par défaut, J-30 supprimé, rappels choisis
-- réellement envoyés.
--
-- Le rappel du jour J est envoyé pour chaque anniversaire dont le rappel est
-- activé (reminder_enabled). reminder_days ne contient que les rappels en
-- plus : 1, 3, 7 ou 14 jours avant. Vide = jour J seul (nouvelle valeur par
-- défaut). Jusqu'ici reminder_days n'était lu par aucune tâche planifiée :
-- seul le jour J partait.
--
-- 1. Données : {7} seul (l'ancien défaut, impossible à distinguer d'un choix)
--    → {} ; 30 → 14 ; null → {}.
-- 2. Trigger de normalisation (30 → 14, doublons, tri) pour les anciennes
--    versions de l'app qui proposent encore J-30, puis contrainte sur les
--    valeurs autorisées.
-- 3. create_birthday_today_notifications (appelée chaque matin à 8 h UTC par
--    la fonction birthday-today-reminders, seule tâche planifiée) envoie le
--    jour J et les rappels choisis. Un 29 février est fêté le 28 février les
--    années non bissextiles. Un seul rappel par anniversaire et par jour
--    (index notifications_birthday_reminder_once_per_day_idx) : relancer la
--    tâche le même jour n'envoie rien de plus.
-- 4. submit_birthday_request (lien /anniv) crée l'anniversaire avec la valeur
--    par défaut au lieu de {7}.
-- 5. generate_birthday_notifications, jamais appelée, est supprimée.

-- 1. Données
update public.birthdays set reminder_days = '{}' where reminder_days = '{7}';

update public.birthdays b
set reminder_days = coalesce((
  select array_agg(distinct case when d = 30 then 14 else d end order by case when d = 30 then 14 else d end)
  from unnest(b.reminder_days) d
), '{}')
where b.reminder_days is null or 30 = any(b.reminder_days);

-- 2. Normalisation et contrainte
create or replace function public.normalize_birthday_reminder_days()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.reminder_days := coalesce((
    select array_agg(distinct case when d = 30 then 14 else d end order by case when d = 30 then 14 else d end)
    from unnest(new.reminder_days) d
    where d is not null
  ), '{}');
  return new;
end;
$$;

drop trigger if exists trg_normalize_birthday_reminder_days on public.birthdays;
create trigger trg_normalize_birthday_reminder_days
  before insert or update of reminder_days on public.birthdays
  for each row execute function public.normalize_birthday_reminder_days();

alter table public.birthdays
  alter column reminder_days set default '{}',
  alter column reminder_days set not null;

alter table public.birthdays drop constraint if exists birthdays_reminder_days_check;
alter table public.birthdays
  add constraint birthdays_reminder_days_check check (reminder_days <@ array[1, 3, 7, 14]);

-- 3. Envoi
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

-- 4. Lien /anniv : valeur par défaut (jour J)
create or replace function public.submit_birthday_request(
  p_code text,
  p_name text,
  p_day integer,
  p_month integer,
  p_year integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_headers json;
  v_ip text;
  v_ip_hash text;
  v_date date;
  v_row public.birthday_requests%rowtype;
  v_birthday_id uuid;
  v_months text[] := array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
begin
  -- Anti-répétition : 10 envois par heure et par adresse IP.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := btrim(split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    v_ip_hash := encode(extensions.digest(v_ip, 'sha256'), 'hex');
    perform pg_advisory_xact_lock(hashtext('birthday_request_attempts:' || v_ip_hash));
    if (select count(*) from public.birthday_request_attempts
         where ip_hash = v_ip_hash and attempted_at > now() - interval '1 hour') >= 10 then
      return jsonb_build_object('status', 'rate_limited');
    end if;
    insert into public.birthday_request_attempts (ip_hash) values (v_ip_hash);
  end if;

  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{32}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if char_length(v_name) not between 1 and 60
     or p_day is null or p_month is null
     or p_month not between 1 and 12 or p_day not between 1 and 31
     or (p_year is not null and p_year not between 1900 and extract(year from current_date)::int) then
    return jsonb_build_object('status', 'invalid');
  end if;

  begin
    -- Année inconnue : 2000 (bissextile, le 29 février reste possible), comme
    -- l'ajout manuel d'un anniversaire.
    v_date := make_date(coalesce(p_year, 2000), p_month, p_day);
  exception when others then
    return jsonb_build_object('status', 'invalid');
  end;
  if p_year is not null and v_date > current_date then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_row from public.birthday_requests where code = p_code for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_row.status = 'received' then
    return jsonb_build_object('status', 'used');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_me is not null and v_me = v_row.user_id then
    return jsonb_build_object('status', 'own_request');
  end if;

  insert into public.birthdays (user_id, name, birthdate, linked_profile_id)
  values (v_row.user_id, v_name, v_date, v_me)
  returning id into v_birthday_id;

  update public.birthday_requests
     set status = 'received',
         responded_at = now(),
         responder_name = v_name,
         responder_user_id = v_me,
         birthday_id = v_birthday_id
   where id = v_row.id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_row.user_id,
    'birthday_shared',
    v_name || ' t''a donné sa date d''anniversaire : '
      || p_day::text || case when p_day = 1 then 'er' else '' end || ' ' || v_months[p_month],
    'Le rappel est ajouté à tes anniversaires 🎂',
    jsonb_build_object('request_id', v_row.id, 'birthday_id', v_birthday_id)
  );

  return jsonb_build_object(
    'status', 'ok',
    'requester_id', case when v_me is not null then v_row.user_id end
  );
end;
$$;

revoke all on function public.submit_birthday_request(text, text, integer, integer, integer) from public;
grant execute on function public.submit_birthday_request(text, text, integer, integer, integer) to anon, authenticated;

-- 5. generate_birthday_notifications (jamais appelée)
drop function if exists public.generate_birthday_notifications();
