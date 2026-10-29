-- « Demander son anniversaire » : un lien https://amiv.app/anniv/<code> envoyé
-- à un ami, qui donne sa date sans avoir de compte.
--
-- * birthday_requests : une ligne par lien. Le demandeur ne voit que ses
--   demandes (RLS) ; aucune écriture directe, tout passe par les RPC.
--   Supprimée en cascade avec le compte du demandeur.
-- * Code : 24 octets aléatoires (32 caractères base64url), un seul usage,
--   expire 30 jours après la création.
-- * create_birthday_request : 20 liens maximum par 24 h et par utilisateur.
-- * get_birthday_request / submit_birthday_request : appelables sans compte
--   (anon). La réponse crée le rappel dans birthdays chez le demandeur et une
--   notification birthday_shared (push via le trigger des notifications,
--   réglage « Nouvelles invitations »). Envois limités à 10 par heure et par
--   adresse IP (empreinte sha256 uniquement, effacée après 24 h).
-- * Nettoyage quotidien : les demandes sont supprimées 90 jours après leur
--   création (la date reçue reste dans birthdays chez le demandeur).

create table if not exists public.birthday_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{32}$'),
  friend_name text check (friend_name is null or char_length(friend_name) between 1 and 60),
  status text not null default 'pending' check (status in ('pending', 'received')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  responded_at timestamptz,
  responder_name text check (responder_name is null or char_length(responder_name) between 1 and 60),
  responder_user_id uuid references auth.users(id) on delete set null,
  birthday_id uuid references public.birthdays(id) on delete set null
);

create index if not exists birthday_requests_user_created_idx on public.birthday_requests(user_id, created_at desc);

alter table public.birthday_requests enable row level security;
revoke all on public.birthday_requests from anon, authenticated;
grant select on public.birthday_requests to authenticated;

drop policy if exists "Users see own birthday requests" on public.birthday_requests;
create policy "Users see own birthday requests" on public.birthday_requests
  for select to authenticated
  using (auth.uid() = user_id);

-- Table serveur uniquement (RLS sans policy, aucun droit client).
create table if not exists public.birthday_request_attempts (
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists birthday_request_attempts_ip_idx on public.birthday_request_attempts(ip_hash, attempted_at);

alter table public.birthday_request_attempts enable row level security;
revoke all on public.birthday_request_attempts from anon, authenticated;

-- ── Création du lien ─────────────────────────────────────────────────────────
create or replace function public.create_birthday_request(p_friend_name text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_friend_name, '')), '');
  v_row public.birthday_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_name is not null and char_length(v_name) > 60 then
    v_name := left(v_name, 60);
  end if;

  perform pg_advisory_xact_lock(hashtext('birthday_requests:' || v_user_id::text));
  if (select count(*) from public.birthday_requests
       where user_id = v_user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.birthday_requests (user_id, code, friend_name)
  values (
    v_user_id,
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    v_name
  )
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'friend_name', v_row.friend_name, 'expires_at', v_row.expires_at);
end;
$$;

revoke all on function public.create_birthday_request(text) from public, anon;
grant execute on function public.create_birthday_request(text) to authenticated;

-- ── Lecture publique du lien ─────────────────────────────────────────────────
-- status : pending | used | expired | not_found. requester_id n'est renvoyé
-- qu'à une personne connectée (pour proposer l'ajout en ami).
create or replace function public.get_birthday_request(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.birthday_requests%rowtype;
  v_first_name text;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{32}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_row from public.birthday_requests where code = p_code;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.name), ''), 'Un ami')
    into v_first_name
    from public.profiles p where p.id = v_row.user_id;

  return jsonb_build_object(
    'status', case
      when v_row.status = 'received' then 'used'
      when v_row.expires_at <= now() then 'expired'
      else 'pending'
    end,
    'requester_first_name', coalesce(v_first_name, 'Un ami'),
    'friend_name', case when v_row.status = 'pending' then v_row.friend_name end,
    'is_own', v_me is not null and v_me = v_row.user_id,
    'requester_id', case when v_me is not null then v_row.user_id end
  );
end;
$$;

revoke all on function public.get_birthday_request(text) from public;
grant execute on function public.get_birthday_request(text) to anon, authenticated;

-- ── Réponse ──────────────────────────────────────────────────────────────────
-- status : ok | invalid | used | expired | not_found | own_request | rate_limited
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

  insert into public.birthdays (user_id, name, birthdate, reminder_days, linked_profile_id)
  values (v_row.user_id, v_name, v_date, array[7], v_me)
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

-- ── Push : réglage « Nouvelles invitations » ─────────────────────────────────
create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder', 'poll_reminder', 'birthday_shared') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- ── Nettoyage ────────────────────────────────────────────────────────────────
create or replace function public.purge_birthday_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.birthday_request_attempts where attempted_at < now() - interval '24 hours';
  delete from public.birthday_requests where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_birthday_requests() from public, anon, authenticated;
grant execute on function public.purge_birthday_requests() to service_role;

-- SQL pur : aucun appel HTTP.
select cron.unschedule('birthday-requests-cleanup')
where exists (select 1 from cron.job where jobname = 'birthday-requests-cleanup');

select cron.schedule('birthday-requests-cleanup', '17 3 * * *', $$select public.purge_birthday_requests();$$);
