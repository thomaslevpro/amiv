-- Anniversaires : année inconnue explicite, et lignes manuelles converties
-- qui redeviennent manuelles.
--
-- 1. birthdays.birth_year_known : l'année de birthdate est-elle vraie ?
--    Jusqu'ici l'année 2000 servait de sentinelle « année inconnue », ce qui
--    cachait l'âge des personnes vraiment nées en 2000. Une année inconnue
--    reste stockée en 2000 (bissextile, le 29 février reste possible) mais
--    c'est birth_year_known = false qui le dit, et l'âge n'est affiché que si
--    birth_year_known.
--    Données existantes : pour les lignes liées à un ami, l'année du profil
--    décide (< 1900 = inconnue). Pour les autres, une vraie année 2000 ne se
--    distingue pas d'une année inconnue : toutes les années 2000 deviennent
--    inconnues (décision produit : aucun âge faux affiché, l'utilisateur peut
--    saisir l'âge ou l'année dans la fiche).
--    Anciennes versions de l'app (sans la colonne) : à l'insertion, 2000 =
--    inconnue ; en mise à jour, une nouvelle année autre que 2000 = connue.
--
-- 2. birthdays.was_manual : la ligne liée à un ami était un anniversaire
--    ajouté à la main avant d'être converti par sync_friend_birthday. Quand
--    l'amitié prend fin, elle n'est pas supprimée : elle redevient manuelle
--    (déliée, avec la dernière date connue, modifiable). Seules les lignes
--    créées automatiquement sont supprimées. Quand l'ami efface sa date, une
--    ligne convertie redevient manuelle mais reste liée à son profil, et sera
--    de nouveau convertie s'il remet une date.
--    friend_user_id passe en ON DELETE SET NULL pour que la suppression du
--    compte de l'ami suive la même règle (trg_friend_birthday_unlinked).

-- ── Colonnes ───────────────────────────────────────────────────────────────
alter table public.birthdays add column if not exists birth_year_known boolean;
alter table public.birthdays add column if not exists was_manual boolean not null default false;

update public.birthdays b
set birth_year_known = case
  when b.friend_user_id is not null then coalesce((
    select extract(year from p.birthday) >= 1900 from public.profiles p where p.id = b.friend_user_id
  ), extract(year from b.birthdate) <> 2000)
  else extract(year from b.birthdate) <> 2000
end
where b.birth_year_known is null;

alter table public.birthdays alter column birth_year_known set not null;

alter table public.birthdays drop constraint if exists birthdays_friend_user_id_fkey;
alter table public.birthdays
  add constraint birthdays_friend_user_id_fkey
  foreign key (friend_user_id) references auth.users(id) on delete set null;

-- ── Année inconnue ─────────────────────────────────────────────────────────
create or replace function public.normalize_birthday_year()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.birth_year_known := coalesce(new.birth_year_known, extract(year from new.birthdate) <> 2000);
  else
    new.birth_year_known := coalesce(new.birth_year_known, old.birth_year_known);
    if not new.birth_year_known
       and extract(year from new.birthdate) <> extract(year from old.birthdate)
       and extract(year from new.birthdate) <> 2000 then
      new.birth_year_known := true;
    end if;
  end if;
  if not new.birth_year_known then
    new.birthdate := make_date(2000, extract(month from new.birthdate)::int, extract(day from new.birthdate)::int);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_birthday_year on public.birthdays;
create trigger trg_normalize_birthday_year
  before insert or update of birthdate, birth_year_known on public.birthdays
  for each row execute function public.normalize_birthday_year();

-- ── Garde-fous côté app (+ année et was_manual) ────────────────────────────
create or replace function public.guard_friend_birthday()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    if new.friend_user_id is null then
      new.was_manual := false;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.friend_user_id := null;
    new.was_manual := false;
  elsif old.friend_user_id is not null then
    new.friend_user_id := old.friend_user_id;
    new.birthdate := old.birthdate;
    new.birth_year_known := old.birth_year_known;
    new.linked_profile_id := old.linked_profile_id;
    new.was_manual := old.was_manual;
  else
    new.friend_user_id := null;
    new.was_manual := false;
  end if;
  return new;
end;
$$;

-- Lien à l'ami retiré hors app (fin d'amitié, compte de l'ami supprimé) : une
-- ligne créée automatiquement disparaît, une ligne convertie reste.
create or replace function public.on_friend_birthday_unlinked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not old.was_manual then
    delete from public.birthdays b where b.id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_friend_birthday_unlinked on public.birthdays;
create trigger trg_friend_birthday_unlinked
  after update of friend_user_id on public.birthdays
  for each row
  when (old.friend_user_id is not null and new.friend_user_id is null)
  execute function public.on_friend_birthday_unlinked();

-- ── Règle de synchronisation ───────────────────────────────────────────────
create or replace function public.sync_friend_birthday(p_owner uuid, p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birthday date;
  v_known boolean;
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
    -- Ligne créée automatiquement : supprimée (trg_friend_birthday_unlinked).
    -- Ligne convertie : redevient manuelle, reste liée au profil.
    update public.birthdays b
       set friend_user_id = null
     where b.user_id = p_owner and b.friend_user_id = p_friend;
    return;
  end if;

  v_known := extract(year from v_birthday) >= 1900;
  v_date := case
    when v_known then v_birthday
    else make_date(2000, extract(month from v_birthday)::int, extract(day from v_birthday)::int)
  end;

  update public.birthdays b
     set birthdate = v_date, birth_year_known = v_known, linked_profile_id = p_friend
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
       set friend_user_id = p_friend, was_manual = true, birthdate = v_date, birth_year_known = v_known
     where b.id = v_id;
    return;
  end if;

  insert into public.birthdays (user_id, name, birthdate, birth_year_known, linked_profile_id, friend_user_id)
  values (p_owner, left(v_name, 60), v_date, v_known, p_friend, p_friend)
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
  -- Ligne convertie : déliée, garde sa dernière date. Ligne automatique :
  -- supprimée par trg_friend_birthday_unlinked.
  update public.birthdays b
     set friend_user_id = null,
         linked_profile_id = case when b.was_manual then null else b.linked_profile_id end
   where (b.user_id = p_a and b.friend_user_id = p_b)
      or (b.user_id = p_b and b.friend_user_id = p_a);
  delete from public.birthday_friend_dismissals d
   where (d.user_id = p_a and d.friend_user_id = p_b)
      or (d.user_id = p_b and d.friend_user_id = p_a);
end;
$$;

revoke all on function public.remove_friend_birthdays(uuid, uuid) from public, anon, authenticated;

-- ── Lien /anniv : année inconnue explicite ──────────────────────────────────
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

  insert into public.birthdays (user_id, name, birthdate, birth_year_known, linked_profile_id)
  values (v_row.user_id, v_name, v_date, p_year is not null, v_me)
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
