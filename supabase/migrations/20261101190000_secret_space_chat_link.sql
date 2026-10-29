-- Espace secret ↔ chat Secret d'un anniversaire.
--
-- 1. Messages système dans le chat Secret (messages.is_secret = true) :
--    « Camille a ajouté un souvenir », « Lucas a ajouté une idée cadeau »,
--    « Lucas a participé à la cagnotte » (jamais de montant), « Tom a relancé
--    Camille pour le Flashback ». Écrits uniquement par le serveur
--    (triggers et remind_secret_space_guest) ; l'app ne peut pas en créer.
--    system_data garde l'onglet de l'espace secret et l'élément concerné.
-- 2. Seulement pour un anniversaire avec une personne fêtée, jamais au nom
--    de la personne fêtée. Le chat Secret est lu via can_access_secret_space
--    (personne fêtée exclue) et notify_event_message ne notifie jamais un
--    message secret : ces messages ne lui sont ni visibles ni notifiés.
-- 3. Relance « À relancer » : un message système dans le chat Secret + une
--    notification (type secret_space_reminder) pour la personne relancée,
--    au plus une fois par 24 h et par personne.
-- 4. Élément supprimé (souvenir, idée, participation) : son message système
--    est retiré aussi.

-- ── Colonnes ────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists system_type text,
  add column if not exists system_data jsonb;

alter table public.messages drop constraint if exists messages_system_type_check;
alter table public.messages add constraint messages_system_type_check check (
  system_type is null
  or (is_secret and system_type in ('memory_added', 'gift_added', 'cagnotte_joined', 'secret_reminder'))
);

create index if not exists messages_secret_system_idx
  on public.messages (event_id, system_type, created_at)
  where system_type is not null;

-- L'app n'écrit que des messages normaux
drop policy if exists "insert_messages" on public.messages;
create policy "insert_messages" on public.messages
  for insert
  with check (
    auth.uid() = user_id
    and system_type is null
    and system_data is null
    and (
      (is_secret = false and public.can_access_event_chat(event_id))
      or (is_secret = true and public.can_access_secret_space(event_id))
    )
  );

-- ── Lecture (mêmes règles, colonnes système en plus) ───────────────────────
drop function if exists public.get_event_messages(uuid, boolean);
create function public.get_event_messages(p_event_id uuid, p_is_secret boolean)
returns table(id uuid, event_id uuid, user_id uuid, content text, created_at timestamptz, is_secret boolean, is_hidden boolean, system_type text, system_data jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         m.event_id,
         m.user_id,
         case when b.blocked_id is null then m.content end,
         m.created_at,
         m.is_secret,
         b.blocked_id is not null,
         m.system_type,
         case when b.blocked_id is null then m.system_data end
  from public.messages m
  left join public.user_blocks b
    on b.blocker_id = auth.uid() and b.blocked_id = m.user_id
  where m.event_id = p_event_id
    and m.is_secret = p_is_secret
    and auth.uid() is not null
    and (
      m.user_id = auth.uid()
      or (not p_is_secret and public.can_access_event_chat(p_event_id))
      or (p_is_secret and public.can_access_secret_space(p_event_id))
    )
  order by m.created_at;
$$;

revoke execute on function public.get_event_messages(uuid, boolean) from public, anon;
grant execute on function public.get_event_messages(uuid, boolean) to authenticated;

-- ── Écriture d'un message système (interne) ────────────────────────────────
create or replace function public.secret_display_first_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.first_name), ''),
    nullif(split_part(trim(coalesce(p.name, '')), ' ', 1), ''),
    'Quelqu’un'
  )
  from (select 1) one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.secret_display_first_name(uuid) from public, anon, authenticated;

create or replace function public.post_secret_system_message(
  p_event_id uuid,
  p_actor_id uuid,
  p_type text,
  p_content text,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Anniversaire avec personne fêtée seulement, jamais en son nom
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.birthday_person_user_id is not null
      and e.birthday_person_user_id is distinct from p_actor_id
  ) then
    return;
  end if;

  insert into public.messages (event_id, user_id, content, is_secret, system_type, system_data)
  values (p_event_id, p_actor_id, p_content, true, p_type, p_data);
end;
$$;

revoke execute on function public.post_secret_system_message(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- ── Activité de l'espace secret → chat Secret ──────────────────────────────
create or replace function public.secret_activity_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'collective_memories' then
      perform public.post_secret_system_message(
        new.event_id, new.contributor_id, 'memory_added',
        format('%s a ajouté un souvenir', public.secret_display_first_name(new.contributor_id)),
        jsonb_build_object('tab', 'flashback', 'item_id', new.id)
      );
    elsif tg_table_name = 'gift_items' then
      perform public.post_secret_system_message(
        new.event_id, new.added_by, 'gift_added',
        format('%s a ajouté une idée cadeau', public.secret_display_first_name(new.added_by)),
        jsonb_build_object('tab', 'gifts', 'item_id', new.id)
      );
    elsif tg_table_name = 'cagnotte_contributions' then
      -- Jamais de montant individuel
      perform public.post_secret_system_message(
        new.event_id, new.user_id, 'cagnotte_joined',
        format('%s a participé à la cagnotte', public.secret_display_first_name(new.user_id)),
        jsonb_build_object('tab', 'cagnotte', 'item_id', new.id)
      );
    end if;
    return new;
  end if;

  delete from public.messages m
  where m.event_id = old.event_id
    and m.is_secret
    and m.system_type in ('memory_added', 'gift_added', 'cagnotte_joined')
    and m.system_data->>'item_id' = old.id::text;
  return old;
end;
$$;

drop trigger if exists trg_secret_activity_message on public.collective_memories;
create trigger trg_secret_activity_message
  after insert or delete on public.collective_memories
  for each row execute function public.secret_activity_message();

drop trigger if exists trg_secret_activity_message on public.gift_items;
create trigger trg_secret_activity_message
  after insert or delete on public.gift_items
  for each row execute function public.secret_activity_message();

drop trigger if exists trg_secret_activity_message on public.cagnotte_contributions;
create trigger trg_secret_activity_message
  after insert or delete on public.cagnotte_contributions
  for each row execute function public.secret_activity_message();

-- ── Relance depuis l'espace secret ─────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise', 'poll_reminder',
  'birthday_shared', 'secret_space_reminder'
]::text[]));

-- Même réglage que les autres rappels (notif_invitations)
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
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- Retour : 'sent' ou 'too_soon' (déjà relancé dans les dernières 24 h)
create or replace function public.remind_secret_space_guest(p_event_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_birthday_person uuid;
  v_me_name text;
  v_target_name text;
begin
  if v_me is null or not public.can_access_secret_space(p_event_id) then
    raise exception 'Espace secret inaccessible' using errcode = '42501';
  end if;

  select e.birthday_person_user_id into v_birthday_person
  from public.events e where e.id = p_event_id;

  if v_birthday_person is null then
    raise exception 'Espace secret inaccessible' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_user_id = v_me
     or p_user_id = v_birthday_person
     or not public.is_event_chat_member(p_event_id, p_user_id) then
    raise exception 'Personne non relançable' using errcode = '22023';
  end if;

  -- Un seul rappel par personne et par 24 h, quel que soit l'expéditeur
  perform pg_advisory_xact_lock(hashtext('secret_reminder:' || p_event_id::text || ':' || p_user_id::text));
  if exists (
    select 1 from public.messages m
    where m.event_id = p_event_id
      and m.is_secret
      and m.system_type = 'secret_reminder'
      and m.system_data->>'target_id' = p_user_id::text
      and m.created_at > now() - interval '24 hours'
  ) then
    return 'too_soon';
  end if;

  v_me_name := public.secret_display_first_name(v_me);
  v_target_name := public.secret_display_first_name(p_user_id);

  perform public.post_secret_system_message(
    p_event_id, v_me, 'secret_reminder',
    format('%s a relancé %s pour le Flashback', v_me_name, v_target_name),
    jsonb_build_object('tab', 'flashback', 'target_id', p_user_id)
  );

  -- Pas de notification si la personne relancée m'a bloqué
  if not exists (
    select 1 from public.user_blocks b
    where b.blocker_id = p_user_id and b.blocked_id = v_me
  ) then
    insert into public.notifications (user_id, type, title, body, data, read)
    values (
      p_user_id,
      'secret_space_reminder',
      'Petit rappel 🤫',
      format('%s attend ton souvenir pour l’anniversaire de %s', v_me_name, public.secret_display_first_name(v_birthday_person)),
      jsonb_build_object('event_id', p_event_id, 'sender_id', v_me),
      false
    );
  end if;

  return 'sent';
end;
$$;

revoke execute on function public.remind_secret_space_guest(uuid, uuid) from public, anon;
grant execute on function public.remind_secret_space_guest(uuid, uuid) to authenticated;
