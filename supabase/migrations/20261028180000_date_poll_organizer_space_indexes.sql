-- Lot fonctionnalités : vote de dates, checklist / budget pour les co-organisateurs,
-- invitations.updated_at, index manquants, get_friend_suggestions, get_event_guests.

-- ---------------------------------------------------------------------------
-- Membre d'un événement : organisateur (owner + co-organisateur approuvé), invité
-- par compte ou par email, ou RSVP (même règle que la policy events_select).
-- ---------------------------------------------------------------------------
create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_event_organizer(p_event_id)
    or public.is_invited_to_event(p_event_id, auth.uid())
    or exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id
        and r.user_id = auth.uid()
    )
  );
$$;

revoke execute on function public.is_event_member(uuid) from public, anon;
grant execute on function public.is_event_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Modification d'un événement : la policy "Organisateurs peuvent modifier l'event"
-- acceptait toute ligne event_organizers, y compris un guest_leader en attente — que
-- n'importe quel invité "going" peut créer lui-même. Désormais : owner ou
-- co-organisateur approuvé (sert aussi à la confirmation de date du sondage).
-- ---------------------------------------------------------------------------
drop policy if exists "Organisateurs peuvent modifier l'event" on public.events;
create policy "Organisateurs peuvent modifier l'event" on public.events
for update to authenticated
using (public.is_event_organizer(id))
with check (public.is_event_organizer(id));

-- ---------------------------------------------------------------------------
-- 4. Vote de dates (cf. 20240003_date_poll, jamais appliqué en entier)
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists poll_closed boolean not null default false;

create table if not exists public.event_date_votes (
  id         uuid default gen_random_uuid() primary key,
  option_id  uuid references public.event_date_options(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  available  boolean not null,
  created_at timestamptz default now(),
  unique (option_id, user_id)
);

alter table public.event_date_votes enable row level security;
revoke all on public.event_date_votes from anon;

-- Vote possible pour un membre de l'événement, tant que le sondage est ouvert.
create or replace function public.can_vote_on_date_option(p_option_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_date_options o
    join public.events e on e.id = o.event_id
    where o.id = p_option_id
      and not e.poll_closed
      and public.is_event_member(e.id)
  );
$$;

create or replace function public.is_date_option_organizer(p_option_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_date_options o
    where o.id = p_option_id
      and public.is_event_organizer(o.event_id)
  );
$$;

revoke execute on function public.can_vote_on_date_option(uuid) from public, anon;
revoke execute on function public.is_date_option_organizer(uuid) from public, anon;
grant execute on function public.can_vote_on_date_option(uuid) to authenticated;
grant execute on function public.is_date_option_organizer(uuid) to authenticated;

drop policy if exists "view date votes" on public.event_date_votes;
drop policy if exists "users insert own votes" on public.event_date_votes;
drop policy if exists "users update own votes" on public.event_date_votes;

-- Ses propres votes ; les organisateurs voient tous les votes (résultats du sondage).
create policy "view date votes" on public.event_date_votes
for select to authenticated
using (user_id = auth.uid() or public.is_date_option_organizer(option_id));

create policy "users insert own votes" on public.event_date_votes
for insert to authenticated
with check (user_id = auth.uid() and public.can_vote_on_date_option(option_id));

create policy "users update own votes" on public.event_date_votes
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.can_vote_on_date_option(option_id));

-- ---------------------------------------------------------------------------
-- 5. event_date_options : lecture pour tous les membres de l'événement
-- ---------------------------------------------------------------------------
revoke all on public.event_date_options from anon;

drop policy if exists "Lecture event_date_options" on public.event_date_options;
drop policy if exists "view date options" on public.event_date_options;
create policy "Lecture event_date_options" on public.event_date_options
for select to authenticated
using (public.is_event_member(event_id));

create index if not exists event_date_options_event_id_idx
  on public.event_date_options(event_id);

-- ---------------------------------------------------------------------------
-- 6. Checklist et budget : owner + co-organisateurs approuvés
-- ---------------------------------------------------------------------------
-- (le budget lui-même est events.budget_total : couvert par la policy UPDATE ci-dessus)
revoke all on public.checklist_items from anon;
revoke all on public.event_expenses from anon;

drop policy if exists "checklist_select" on public.checklist_items;
drop policy if exists "checklist_insert" on public.checklist_items;
drop policy if exists "checklist_update" on public.checklist_items;
drop policy if exists "checklist_delete" on public.checklist_items;
drop policy if exists "organizer manages checklist" on public.checklist_items;
create policy "organizer manages checklist" on public.checklist_items
for all to authenticated
using (public.is_event_organizer(event_id))
with check (public.is_event_organizer(event_id));

drop policy if exists "Orga can manage expenses" on public.event_expenses;
drop policy if exists "organizer manages expenses" on public.event_expenses;
create policy "organizer manages expenses" on public.event_expenses
for all to authenticated
using (public.is_event_organizer(event_id))
with check (public.is_event_organizer(event_id));

create index if not exists checklist_items_event_position_idx
  on public.checklist_items(event_id, position);

create index if not exists event_expenses_event_created_idx
  on public.event_expenses(event_id, created_at);

-- invitations.updated_at : lignes existantes initialisées à created_at, puis
-- maintenu par trigger.
alter table public.invitations
  add column if not exists updated_at timestamptz default now();

update public.invitations set updated_at = created_at where created_at is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
before update on public.invitations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Messagerie privée (cf. 20240006 / 20240011). dcp_conv_id_idx (conversation_id)
-- n'est pas recréé : l'index unique (conversation_id, user_id) le couvre déjà.
-- ---------------------------------------------------------------------------
create index if not exists dcp_user_id_idx
  on public.direct_conversation_participants(user_id);

create index if not exists dcp_user_last_read_idx
  on public.direct_conversation_participants(user_id, last_read_at);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- get_friend_suggestions : le front envoie p_user_id (l'ancien paramètre
-- requesting_user_id rendait la RPC introuvable). Uniquement pour soi-même.
-- ---------------------------------------------------------------------------
drop function if exists public.get_friend_suggestions(uuid);
create function public.get_friend_suggestions(p_user_id uuid)
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.avatar_url
  from public.profiles p
  where p_user_id = auth.uid()
    and p.id <> p_user_id
    and p.id not in (
      select addressee_id from public.friendships where requester_id = p_user_id
      union
      select requester_id from public.friendships where addressee_id = p_user_id
    )
  limit 10;
$$;

revoke execute on function public.get_friend_suggestions(uuid) from public, anon;
grant execute on function public.get_friend_suggestions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_event_guests : invitations par compte (invited_user_id, quasi toutes) en plus
-- des invitations par email ; réservé aux membres de l'événement.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_guests(p_event_id uuid)
returns table (invitee_id uuid, full_name text, avatar_url text, rsvp_status text, is_friend boolean, friend_request_sent boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id         as invitee_id,
    p.name       as full_name,
    p.avatar_url,
    i.status     as rsvp_status,
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = p.id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.id)
        )
    ) as is_friend,
    exists (
      select 1 from public.friendships f
      where f.requester_id = auth.uid()
        and f.addressee_id = p.id
        and f.status = 'pending'
    ) as friend_request_sent
  from public.invitations i
  join public.profiles p on p.id = coalesce(
    i.invited_user_id,
    (select u.id from auth.users u where lower(u.email) = lower(i.invited_email) limit 1)
  )
  where i.event_id = p_event_id
    and i.status is not null
    and public.is_event_member(p_event_id);
$$;

revoke execute on function public.get_event_guests(uuid) from public, anon;
grant execute on function public.get_event_guests(uuid) to authenticated;
