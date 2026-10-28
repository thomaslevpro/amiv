-- Révélation des souvenirs (collective_memories) à la personne fêtée.
--
-- Règle d'accès : à partir du jour de l'événement (fuseau Europe/Paris), la
-- personne fêtée lit en lecture seule les souvenirs et leurs images. Elle
-- dépend uniquement de events.date, pas d'une action : rien n'est ouvert de
-- plus dans l'espace secret (cadeaux, réservations, cagnotte, chat secret,
-- group_cards, réactions restent derrière can_access_secret_space).
--
-- events.memories_revealed_at est rempli par reveal_due_memories (cron
-- quotidien via l'edge function reveal-memories, service role) : il trace la
-- révélation et évite les doublons de notification. Il n'intervient pas dans
-- l'accès.
--
-- memory-images : le bucket utilisé par SecretSpacePage n'existait pas (envoi
-- de photo en échec). Il est créé privé ; les images sont lues par URL signée
-- et suivent la même règle que les lignes : contributeur ou organisateur ayant
-- accès à l'espace secret, ou personne fêtée une fois le jour atteint.
-- Chemin : <event_id>/<user_id>/<fichier>.

-- ── Révélation ─────────────────────────────────────────────────────────────
alter table public.events add column if not exists memories_revealed_at timestamptz;

-- Événements déjà passés : marqués révélés sans notification.
update public.events
set memories_revealed_at = now()
where memories_revealed_at is null
  and birthday_person_user_id is not null
  and date is not null
  and (date at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date;

create or replace function public.can_view_revealed_memories(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.birthday_person_user_id = auth.uid()
        and e.date is not null
        and (e.date at time zone 'Europe/Paris')::date <= (now() at time zone 'Europe/Paris')::date
    );
$$;

revoke all on function public.can_view_revealed_memories(uuid) from public, anon;
grant execute on function public.can_view_revealed_memories(uuid) to authenticated;

drop policy if exists "Personne fêtée : souvenirs révélés" on public.collective_memories;
create policy "Personne fêtée : souvenirs révélés"
  on public.collective_memories for select to authenticated
  using (public.can_view_revealed_memories(event_id));

-- ── Bucket memory-images ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-images', 'memory-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do update set public = false;

-- Premier dossier du chemin, s'il s'agit d'un uuid.
create or replace function public.memory_image_event_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

drop policy if exists "Souvenirs : envoi d'image" on storage.objects;
create policy "Souvenirs : envoi d'image"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memory-images'
    and split_part(name, '/', 2) = auth.uid()::text
    and public.can_access_secret_space(public.memory_image_event_id(name))
  );

drop policy if exists "Souvenirs : lecture d'image" on storage.objects;
create policy "Souvenirs : lecture d'image"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memory-images'
    and (
      (
        public.can_access_secret_space(public.memory_image_event_id(name))
        and (
          split_part(name, '/', 2) = auth.uid()::text
          or public.is_event_organizer(public.memory_image_event_id(name))
        )
      )
      or public.can_view_revealed_memories(public.memory_image_event_id(name))
    )
  );

drop policy if exists "Souvenirs : suppression de son image" on storage.objects;
create policy "Souvenirs : suppression de son image"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memory-images' and split_part(name, '/', 2) = auth.uid()::text);

-- ── Notifications ──────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise'
));

-- Pour chaque événement avec personne fêtée dont le jour est atteint et pas
-- encore marqué : s'il a au moins un souvenir, notifie les organisateurs
-- (owner + co-organisateurs approuvés, hors personne fêtée) et la personne
-- fêtée ; dans tous les cas, remplit memories_revealed_at.
create or replace function public.reveal_due_memories()
returns table(revealed_count integer, notified_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  v_first_name text;
begin
  revealed_count := 0;
  notified_count := 0;

  for ev in
    select e.id, e.name, e.user_id, e.birthday_person_user_id
    from public.events e
    where e.memories_revealed_at is null
      and e.birthday_person_user_id is not null
      and e.date is not null
      and (e.date at time zone 'Europe/Paris')::date <= (now() at time zone 'Europe/Paris')::date
    for update skip locked
  loop
    update public.events set memories_revealed_at = now() where id = ev.id;
    revealed_count := revealed_count + 1;

    if exists (select 1 from public.collective_memories m where m.event_id = ev.id) then
      select coalesce(nullif(trim(p.first_name), ''), nullif(split_part(trim(p.name), ' ', 1), ''))
      into v_first_name
      from public.profiles p
      where p.id = ev.birthday_person_user_id;

      insert into public.notifications (user_id, type, title, data, read)
      select distinct r.user_id,
        'memories_revealed',
        format('Les souvenirs de %s ont été révélés à %s 🎉', ev.name, coalesce(v_first_name, 'la personne fêtée')),
        jsonb_build_object('event_id', ev.id),
        false
      from (
        select ev.user_id as user_id
        union
        select o.user_id from public.event_organizers o
        where o.event_id = ev.id
          and o.role in ('owner', 'co_organizer')
          and o.status = 'approved'
      ) r
      where r.user_id is not null
        and r.user_id <> ev.birthday_person_user_id;

      insert into public.notifications (user_id, type, title, data, read)
      values (
        ev.birthday_person_user_id,
        'memories_surprise',
        'Tes amis t''ont préparé une surprise 🎁',
        jsonb_build_object('event_id', ev.id),
        false
      );

      notified_count := notified_count + 1;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.reveal_due_memories() from public, anon, authenticated;
grant execute on function public.reveal_due_memories() to service_role;

-- ── Cron ───────────────────────────────────────────────────────────────────
-- 06:00 UTC, soit 7 h ou 8 h à Paris. L'accès ne dépend pas de ce job.
select cron.unschedule('reveal-memories')
where exists (select 1 from cron.job where jobname = 'reveal-memories');

select cron.schedule(
  'reveal-memories',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://kftzfljdewojxhxcuxnd.supabase.co/functions/v1/reveal-memories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_FNAFgult5S2iSkXXd2SgKQ_aX8Z3eIK',
      'Authorization', 'Bearer sb_publishable_FNAFgult5S2iSkXXd2SgKQ_aX8Z3eIK'
    ),
    body := '{}'::jsonb
  );
  $$
);
