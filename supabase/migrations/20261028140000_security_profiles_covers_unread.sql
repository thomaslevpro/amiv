-- Lot sécurité : profils, couvertures d'événements, compteurs de messages non lus.

-- ---------------------------------------------------------------------------
-- 1. Profils
-- ---------------------------------------------------------------------------
-- anon n'a plus aucun accès à la table. authenticated ne lit plus directement que
-- les colonnes publiques (id, name, first_name, username, avatar_url) : le contrôle
-- est fait par Postgres sur chaque requête, embeds PostgREST compris.
-- Les colonnes privées passent par des RPC SECURITY DEFINER :
--   get_my_profile()                    sa propre ligne complète
--   get_profiles_with_birthday(ids)     champs publics + birthday (soi / amis acceptés)
--   get_public_profile(username)        page /u/:username, y compris anon
--   search_profiles(query)              recherche par pseudo / nom, ou email exact
-- Un UPSERT (INSERT ... ON CONFLICT DO UPDATE) sous RLS exige le SELECT sur toute la
-- ligne : le front n'écrit plus dans profiles qu'avec des UPDATE (la ligne est créée
-- par handle_new_user), sans RETURNING sur une colonne privée.

drop policy if exists "Profil visible par tous" on public.profiles;
drop policy if exists "Modifier son propre profil" on public.profiles;
create policy "Modifier son propre profil" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Écriture : uniquement les colonnes éditables depuis l'app. email reste hors grant :
-- notify_invitation_created / remind_invitations s'en servent pour retrouver le
-- destinataire d'une invitation par email (sinon on pourrait se faire passer pour
-- quelqu'un d'autre) ; il est maintenu depuis auth.users (handle_new_user + trigger
-- ci-dessous). Aucune insertion ni suppression côté client (handle_new_user /
-- delete-account).
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select (id, name, first_name, username, avatar_url) on public.profiles to authenticated;
grant update (
  name, first_name, username, avatar_url, birthday,
  onboarding_step, onboarding_completed,
  notif_birthdays, notif_invitations, notif_messages
) on public.profiles to authenticated;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.get_profiles_with_birthday(p_user_ids uuid[])
returns table (id uuid, first_name text, name text, username text, avatar_url text, birthday date)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.name,
    p.username,
    p.avatar_url,
    case
      when p.id = auth.uid() or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = p.id)
            or (f.addressee_id = auth.uid() and f.requester_id = p.id)
          )
      ) then p.birthday
    end
  from public.profiles p
  where auth.uid() is not null
    and p.id = any(p_user_ids);
$$;

create or replace function public.get_public_profile(p_username text)
returns table (id uuid, first_name text, name text, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, p.name, p.username, p.avatar_url
  from public.profiles p
  where p_username is not null
    and p.username = p_username;
$$;

-- Une requête contenant « @ » ne matche que l'email exact (auth.users, pas la copie
-- modifiable de profiles) : pas d'énumération d'emails par sous-chaîne.
create or replace function public.search_profiles(p_query text)
returns table (id uuid, name text, first_name text, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      btrim(coalesce(p_query, '')) as raw,
      '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select p.id, p.name, p.first_name, p.username, p.avatar_url
  from public.profiles p
  cross join q
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(q.raw) >= 2
    and case
      when position('@' in q.raw) > 0 then exists (
        select 1 from auth.users u
        where u.id = p.id
          and lower(u.email) = lower(q.raw)
      )
      else p.username ilike q.pattern
        or p.first_name ilike q.pattern
        or p.name ilike q.pattern
    end
  order by p.username nulls last
  limit 50;
$$;

revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.get_profiles_with_birthday(uuid[]) from public, anon;
revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_profiles_with_birthday(uuid[]) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- RPC existantes qui contournaient ces règles (SECURITY DEFINER, exécutables par anon,
-- sans contrôle de l'appelant) : get_friends exposait les dates de naissance des amis
-- de n'importe quel utilisateur.
create or replace function public.get_friends(p_user_id uuid)
returns table (friend_id uuid, friendship_id uuid, friend_name text, friend_first_name text, friend_avatar text, birthday date, is_close_friend boolean)
language sql
security definer
set search_path = public
as $$
  select
    p.id              as friend_id,
    f.id              as friendship_id,
    p.name            as friend_name,
    p.first_name      as friend_first_name,
    p.avatar_url      as friend_avatar,
    p.birthday        as birthday,
    f.is_close_friend as is_close_friend
  from friendships f
  join profiles p on p.id = case
    when f.requester_id = p_user_id then f.addressee_id
    when f.addressee_id = p_user_id then f.requester_id
  end
  where p_user_id = auth.uid()
    and (f.requester_id = p_user_id or f.addressee_id = p_user_id)
    and f.status = 'accepted';
$$;

create or replace function public.get_pending_requests(p_user_id uuid)
returns table (friendship_id uuid, requester_id uuid, requester_name text, requester_avatar text, event_context_id uuid, event_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    f.id as friendship_id,
    f.requester_id,
    p.name as requester_name,
    p.avatar_url as requester_avatar,
    f.event_context_id,
    e.name as event_name
  from friendships f
  join profiles p on p.id = f.requester_id
  left join events e on e.id = f.event_context_id
  where p_user_id = auth.uid()
    and f.addressee_id = p_user_id
    and f.status = 'pending';
end;
$$;

revoke execute on function public.get_friends(uuid) from public, anon;
revoke execute on function public.get_pending_requests(uuid) from public, anon;
revoke execute on function public.get_friend_suggestions(uuid) from public, anon;
revoke execute on function public.get_event_guests(uuid) from public, anon;
grant execute on function public.get_friends(uuid) to authenticated;
grant execute on function public.get_pending_requests(uuid) to authenticated;
grant execute on function public.get_friend_suggestions(uuid) to authenticated;
grant execute on function public.get_event_guests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Couvertures d'événements : event-covers/{event_id}/...
-- ---------------------------------------------------------------------------
-- Seuls les organisateurs (owner + co-organisateurs approuvés, cf. is_event_organizer)
-- peuvent uploader, remplacer ou supprimer. La lecture publique est inchangée.

drop policy if exists "Authenticated users can upload covers" on storage.objects;
drop policy if exists "Authenticated users can update covers" on storage.objects;
drop policy if exists "Only event owner can upload covers" on storage.objects;
drop policy if exists "Only event owner can update covers" on storage.objects;
drop policy if exists "event_covers_organizer_insert" on storage.objects;
drop policy if exists "event_covers_organizer_update" on storage.objects;
drop policy if exists "event_covers_organizer_delete" on storage.objects;

-- Comparaison en texte : un nom de dossier qui n'est pas un uuid est refusé sans erreur de cast.
create or replace function public.can_manage_event_cover(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(p_object_name))[1]
      and public.is_event_organizer(e.id)
  );
$$;

revoke execute on function public.can_manage_event_cover(text) from public, anon;
grant execute on function public.can_manage_event_cover(text) to authenticated;

create policy "Event organizers can upload covers" on storage.objects
for insert to authenticated
with check (bucket_id = 'event-covers' and public.can_manage_event_cover(name));

create policy "Event organizers can update covers" on storage.objects
for update to authenticated
using (bucket_id = 'event-covers' and public.can_manage_event_cover(name))
with check (bucket_id = 'event-covers' and public.can_manage_event_cover(name));

create policy "Event organizers can delete covers" on storage.objects
for delete to authenticated
using (bucket_id = 'event-covers' and public.can_manage_event_cover(name));

-- ---------------------------------------------------------------------------
-- 3. get_unread_counts : uniquement pour soi-même
-- ---------------------------------------------------------------------------
-- Signature conservée (le front passe p_user_id) ; tout autre id renvoie zéro ligne.
create or replace function public.get_unread_counts(p_user_id uuid)
returns table (conversation_id uuid, unread_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    dm.conversation_id,
    count(dm.id) as unread_count
  from direct_conversation_participants dcp
  join direct_messages dm on dm.conversation_id = dcp.conversation_id
  where p_user_id = auth.uid()
    and dcp.user_id = p_user_id
    and dm.sender_id != p_user_id
    and (dcp.last_read_at is null or dm.created_at > dcp.last_read_at)
  group by dm.conversation_id;
$$;

revoke execute on function public.get_unread_counts(uuid) from public, anon;
grant execute on function public.get_unread_counts(uuid) to authenticated;
