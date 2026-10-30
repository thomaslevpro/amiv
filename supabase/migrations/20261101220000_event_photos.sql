-- Album photo partagé d'un événement.
--
-- Différent du Flashback (collective_memories / memory-images, caché à la
-- personne fêtée jusqu'au jour J) : l'album est visible par tous les
-- participants et sert à partager les photos de l'événement lui-même. Table
-- et bucket distincts, aucune règle commune.
--
-- Qui voit l'album (can_view_event_photos) : créateur de l'événement,
-- co-organisateur approuvé, RSVP « going », ou invitation « accepted » sans
-- RSVP « declined ». La personne fêtée y a accès dès qu'elle a accepté (pas
-- avant : une notification « Lola a ajouté 5 photos » gâcherait une
-- surprise). En attente, peut-être, refusé : pas d'accès. Une photo n'est
-- jamais montrée si son auteur et la personne qui regarde se sont bloqués
-- (dans un sens ou dans l'autre).
--
-- Envoi, en trois temps :
--   1. le client insère une ligne (event_id seul) : le trigger vérifie
--      l'accès et la limite de 10 photos par personne et par événement, et
--      fixe les chemins <event_id>/<user_id>/<id>.jpg et <id>_thumb.jpg ;
--   2. il envoie les deux fichiers : la policy du bucket n'accepte que les
--      chemins d'une ligne existante de l'utilisateur ;
--   3. il appelle notify_event_photos_added : une notification groupée
--      (« Lola a ajouté 5 photos ») pour les photos complètes pas encore
--      annoncées.
-- Une photo n'apparaît que lorsque ses deux fichiers existent. Les lignes
-- restées incomplètes plus d'une heure (envoi abandonné) sont supprimées.
--
-- Suppression : par son auteur, ou par un organisateur. Les fichiers ne
-- peuvent pas être effacés en SQL (storage.protect_delete) : chaque ligne
-- supprimée — à la main, par cascade de l'événement ou du compte — met ses
-- deux chemins dans storage_deletion_queue, et l'edge function purge-storage
-- les efface via l'API Storage (appel immédiat via pg_net, puis cron de
-- rattrapage toutes les 10 minutes). Une entrée ne quitte la file qu'une fois
-- l'objet réellement absent de storage.objects.

-- ── Accès ──────────────────────────────────────────────────────────────────
create or replace function public.can_view_event_photos(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    exists (select 1 from public.events e where e.id = p_event_id and e.user_id = p_user_id)
    or exists (
      select 1 from public.event_organizers o
      where o.event_id = p_event_id
        and o.user_id = p_user_id
        and o.role in ('owner', 'co_organizer')
        and o.status = 'approved'
    )
    or exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id and r.user_id = p_user_id and r.status = 'going'
    )
    or (
      not exists (
        select 1 from public.rsvps r
        where r.event_id = p_event_id and r.user_id = p_user_id and r.status = 'declined'
      )
      and exists (
        select 1 from public.invitations i
        where i.event_id = p_event_id
          and i.status = 'accepted'
          and (
            i.invited_user_id = p_user_id
            or lower(i.invited_email) = lower((select u.email from auth.users u where u.id = p_user_id))
          )
      )
    )
  );
$$;

revoke all on function public.can_view_event_photos(uuid, uuid) from public, anon, authenticated;

-- ── Table ──────────────────────────────────────────────────────────────────
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null unique,
  thumb_path text not null unique,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists event_photos_event_created_idx on public.event_photos (event_id, created_at desc);
create index if not exists event_photos_user_idx on public.event_photos (user_id);

alter table public.event_photos enable row level security;

revoke all on public.event_photos from anon, authenticated;
grant select, delete on public.event_photos to authenticated;
grant insert (event_id) on public.event_photos to authenticated;

-- Vrai si p_viewer peut voir une photo de p_author pour cet événement.
create or replace function public.can_see_event_photo(p_event_id uuid, p_author uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null and (
    p_viewer = p_author
    or (
      public.can_view_event_photos(p_event_id, p_viewer)
      and not public.is_blocked_between(p_author, p_viewer)
    )
  );
$$;

revoke all on function public.can_see_event_photo(uuid, uuid, uuid) from public, anon, authenticated;

-- Pour la policy : part de l'id d'une photo existante (pas d'auteur au choix,
-- donc pas de moyen de tester qui a bloqué qui).
create or replace function public.can_see_event_photo_id(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_photos p
    where p.id = p_photo_id
      and public.can_see_event_photo(p.event_id, p.user_id, auth.uid())
  );
$$;

revoke all on function public.can_see_event_photo_id(uuid) from public, anon;
grant execute on function public.can_see_event_photo_id(uuid) to authenticated;

drop policy if exists "Album : lecture" on public.event_photos;
create policy "Album : lecture"
  on public.event_photos for select to authenticated
  using (user_id = auth.uid() or public.can_see_event_photo_id(id));

drop policy if exists "Album : ajout" on public.event_photos;
create policy "Album : ajout"
  on public.event_photos for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Album : suppression" on public.event_photos;
create policy "Album : suppression"
  on public.event_photos for delete to authenticated
  using (user_id = auth.uid() or public.is_event_organizer(event_id));

-- Accès, limite et chemins : rien ne vient du client à part event_id.
create or replace function public.prepare_event_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.can_view_event_photos(new.event_id, v_uid) then
    raise exception 'Album réservé aux participants' using errcode = '42501';
  end if;

  -- Deux envois simultanés ne doivent pas dépasser la limite
  perform pg_advisory_xact_lock(hashtextextended('event_photos:' || new.event_id::text || ':' || v_uid::text, 0));
  if (select count(*) from public.event_photos p where p.event_id = new.event_id and p.user_id = v_uid) >= 10 then
    raise exception 'Limite de 10 photos atteinte' using errcode = '23514', hint = 'event_photos_limit';
  end if;

  new.id := gen_random_uuid();
  new.user_id := v_uid;
  new.path := new.event_id::text || '/' || v_uid::text || '/' || new.id::text || '.jpg';
  new.thumb_path := new.event_id::text || '/' || v_uid::text || '/' || new.id::text || '_thumb.jpg';
  new.created_at := now();
  new.notified_at := null;
  return new;
end;
$$;

revoke all on function public.prepare_event_photo() from public, anon, authenticated;

drop trigger if exists trg_prepare_event_photo on public.event_photos;
create trigger trg_prepare_event_photo
  before insert on public.event_photos
  for each row execute function public.prepare_event_photo();

-- ── Bucket event-photos (privé, lu par URL signée) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Envoi : uniquement un chemin réservé par une ligne de l'utilisateur.
create or replace function public.can_upload_event_photo_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.event_photos p
    where p.user_id = auth.uid()
      and (p.path = p_name or p.thumb_path = p_name)
      and public.can_view_event_photos(p.event_id, auth.uid())
  );
$$;

-- Lecture (URL signée) : mêmes règles que la ligne.
create or replace function public.can_read_event_photo_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_photos p
    where (p.path = p_name or p.thumb_path = p_name)
      and public.can_see_event_photo(p.event_id, p.user_id, auth.uid())
  );
$$;

revoke all on function public.can_upload_event_photo_object(text) from public, anon;
revoke all on function public.can_read_event_photo_object(text) from public, anon;
grant execute on function public.can_upload_event_photo_object(text) to authenticated;
grant execute on function public.can_read_event_photo_object(text) to authenticated;

drop policy if exists "Album : envoi de photo" on storage.objects;
create policy "Album : envoi de photo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.can_upload_event_photo_object(name));

drop policy if exists "Album : lecture de photo" on storage.objects;
create policy "Album : lecture de photo"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-photos' and public.can_read_event_photo_object(name));

-- Pas de policy update ni delete : seul purge-storage (service role) efface.

-- ── Effacement des fichiers ────────────────────────────────────────────────
create table if not exists public.storage_deletion_queue (
  bucket_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (bucket_id, name)
);

alter table public.storage_deletion_queue enable row level security;
revoke all on public.storage_deletion_queue from public, anon, authenticated;
grant all on public.storage_deletion_queue to service_role;

create or replace function public.enqueue_event_photo_files()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.storage_deletion_queue (bucket_id, name)
  values ('event-photos', old.path), ('event-photos', old.thumb_path)
  on conflict do nothing;
  return old;
end;
$$;

revoke all on function public.enqueue_event_photo_files() from public, anon, authenticated;

drop trigger if exists trg_enqueue_event_photo_files on public.event_photos;
create trigger trg_enqueue_event_photo_files
  after delete on public.event_photos
  for each row execute function public.enqueue_event_photo_files();

-- Appelle purge-storage (pg_net part après le commit, rien si annulé).
create or replace function public.request_storage_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_cron_secret text;
begin
  if not exists (select 1 from public.storage_deletion_queue) then
    return;
  end if;
  begin
    select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into v_publishable_key from vault.decrypted_secrets where name = 'publishable_key';
    select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'cron_secret';
    if v_project_url is null or v_cron_secret is null then
      raise warning 'request_storage_purge: Vault secrets missing';
      return;
    end if;
    perform net.http_post(
      url := v_project_url || '/functions/v1/purge-storage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', coalesce(v_publishable_key, ''),
        'x-cron-secret', v_cron_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  exception when others then
    -- La file reste : le cron réessaiera.
    raise warning 'request_storage_purge failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.request_storage_purge() from public, anon, authenticated;

create or replace function public.request_storage_purge_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.request_storage_purge();
  return null;
end;
$$;

revoke all on function public.request_storage_purge_after_delete() from public, anon, authenticated;

drop trigger if exists trg_request_storage_purge on public.event_photos;
create trigger trg_request_storage_purge
  after delete on public.event_photos
  for each statement execute function public.request_storage_purge_after_delete();

-- Appelée par purge-storage après remove() : retire de la file les objets
-- réellement absents et renvoie le nombre d'entrées restantes.
create or replace function public.confirm_storage_deletions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  delete from public.storage_deletion_queue q
  where not exists (
    select 1 from storage.objects o
    where o.bucket_id = q.bucket_id and o.name = q.name
  );
  select count(*) into v_remaining from public.storage_deletion_queue;
  return v_remaining;
end;
$$;

revoke all on function public.confirm_storage_deletions() from public, anon, authenticated;
grant execute on function public.confirm_storage_deletions() to service_role;

-- Envois abandonnés : lignes de plus d'une heure dont un fichier manque.
create or replace function public.run_event_photos_maintenance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.event_photos p
  where p.created_at < now() - interval '1 hour'
    and (
      not exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.path)
      or not exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.thumb_path)
    );
  get diagnostics v_deleted = row_count;
  -- Rattrapage si un appel immédiat a échoué
  perform public.request_storage_purge();
  return v_deleted;
end;
$$;

revoke all on function public.run_event_photos_maintenance() from public, anon, authenticated;

select cron.unschedule('event-photos-maintenance')
where exists (select 1 from cron.job where jobname = 'event-photos-maintenance');

select cron.schedule('event-photos-maintenance', '*/10 * * * *', $$select public.run_event_photos_maintenance();$$);

-- ── Lecture de l'album ─────────────────────────────────────────────────────
-- { can_view, can_manage, my_count, max_per_user, photos: [...] }, photos
-- complètes uniquement, les plus récentes d'abord. my_count compte toutes
-- les lignes de l'utilisateur (même règle que la limite).
create or replace function public.get_event_photos(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.can_view_event_photos(p_event_id, v_uid) then
    return jsonb_build_object('can_view', false);
  end if;

  return jsonb_build_object(
    'can_view', true,
    'can_manage', public.is_event_organizer(p_event_id),
    'max_per_user', 10,
    'my_count', (select count(*) from public.event_photos p where p.event_id = p_event_id and p.user_id = v_uid),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'path', p.path,
        'thumb_path', p.thumb_path,
        'created_at', p.created_at,
        'author_name', public.secret_display_first_name(p.user_id)
      ) order by p.created_at desc, p.id)
      from public.event_photos p
      where p.event_id = p_event_id
        and public.can_see_event_photo(p.event_id, p.user_id, v_uid)
        and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.path)
        and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.thumb_path)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_event_photos(uuid) from public, anon;
grant execute on function public.get_event_photos(uuid) to authenticated;

-- ── Notifications ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists notif_photos boolean not null default true;
grant update (notif_photos) on public.profiles to authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise', 'poll_reminder',
  'birthday_shared', 'secret_space_reminder', 'cagnotte_reminder', 'event_photos_added'
]::text[]));

create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder', 'poll_reminder', 'secret_space_reminder') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    when p_type = 'cagnotte_reminder' then coalesce(p.notif_cagnotte, true)
    when p_type = 'event_photos_added' then coalesce(p.notif_photos, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- Une notification par envoi pour les photos complètes de l'appelant pas
-- encore annoncées. Destinataires : personnes qui voient l'album, hors
-- auteur, hors blocages, réglage « Photos » activé. Renvoie le nombre de
-- photos annoncées.
create or replace function public.notify_event_photos_added(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_event_name text;
  v_author text;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  with done as (
    update public.event_photos p
       set notified_at = now()
     where p.event_id = p_event_id
       and p.user_id = v_uid
       and p.notified_at is null
       and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.path)
       and exists (select 1 from storage.objects o where o.bucket_id = 'event-photos' and o.name = p.thumb_path)
    returning 1
  )
  select count(*) into v_count from done;

  if v_count = 0 or not public.can_view_event_photos(p_event_id, v_uid) then
    return v_count;
  end if;

  select coalesce(nullif(trim(e.name), ''), 'l’événement') into v_event_name from public.events e where e.id = p_event_id;
  v_author := public.secret_display_first_name(v_uid);

  insert into public.notifications (user_id, type, title, body, data, read)
  select
    c.uid,
    'event_photos_added',
    format('%s a ajouté %s photo%s', v_author, v_count, case when v_count > 1 then 's' else '' end),
    v_event_name,
    jsonb_build_object('event_id', p_event_id, 'sender_id', v_uid, 'count', v_count),
    false
  from (
    select e.user_id as uid from public.events e where e.id = p_event_id
    union
    select o.user_id from public.event_organizers o where o.event_id = p_event_id
    union
    select r.user_id from public.rsvps r where r.event_id = p_event_id
    union
    select i.invited_user_id from public.invitations i where i.event_id = p_event_id
  ) c
  left join public.profiles pf on pf.id = c.uid
  where c.uid is not null
    and c.uid <> v_uid
    and public.can_view_event_photos(p_event_id, c.uid)
    and not public.is_blocked_between(v_uid, c.uid)
    and coalesce(pf.notif_photos, true);

  return v_count;
end;
$$;

revoke all on function public.notify_event_photos_added(uuid) from public, anon;
grant execute on function public.notify_event_photos_added(uuid) to authenticated;

-- ── Signalement d'une photo ────────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('event_message', 'direct_message', 'profile', 'event_photo'));

-- Identique à 20261029110200_reports, plus la branche event_photo.
create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message record;
begin
  if v_uid is null or new.reporter_id is distinct from v_uid then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if (select count(*) from public.reports r
      where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de signalements, réessaie plus tard.' using errcode = '54000';
  end if;

  new.comment := nullif(trim(new.comment), '');

  if new.target_type = 'event_message' then
    select m.user_id, m.event_id, m.content, m.is_secret into v_message
    from public.messages m where m.id = new.target_id;
    if not found or not (
      (not v_message.is_secret and (public.is_invited_to_event(v_message.event_id, v_uid) or public.is_event_organizer(v_message.event_id)))
      or (v_message.is_secret and public.can_access_secret_space(v_message.event_id))
    ) then
      raise exception 'Message introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.event_id := v_message.event_id;
    new.content_snapshot := v_message.content;

  elsif new.target_type = 'event_photo' then
    select p.user_id, p.event_id, p.path as content into v_message
    from public.event_photos p
    where p.id = new.target_id
      and public.can_see_event_photo(p.event_id, p.user_id, v_uid);
    if not found then
      raise exception 'Photo introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.event_id := v_message.event_id;
    new.content_snapshot := 'event-photos/' || v_message.content;

  elsif new.target_type = 'direct_message' then
    select dm.sender_id as user_id, dm.content into v_message
    from public.direct_messages dm
    where dm.id = new.target_id
      and exists (
        select 1 from public.direct_conversation_participants p
        where p.conversation_id = dm.conversation_id and p.user_id = v_uid
      );
    if not found then
      raise exception 'Message introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.content_snapshot := v_message.content;

  else
    select p.id as user_id,
           concat_ws(' · ', nullif(trim(concat_ws(' ', p.first_name, p.name)), ''), '@' || p.username, p.avatar_url) as content
      into v_message
    from public.profiles p where p.id = new.target_id;
    if not found then
      raise exception 'Profil introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.content_snapshot := v_message.content;
  end if;

  if new.reported_user_id = v_uid then
    raise exception 'Tu ne peux pas te signaler toi-même.' using errcode = '22023';
  end if;

  new.event_id := case when new.target_type in ('event_message', 'event_photo') then new.event_id end;
  new.email_sent_at := null;
  new.created_at := now();
  return new;
end;
$$;
