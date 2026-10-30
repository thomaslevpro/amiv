-- Nom affiché d'un utilisateur : « Prénom Nom », partout pareil.
--
-- Les profils contiennent trois formes selon l'époque de création :
--   first_name = « Thomas », name = « Levy »         (prénom et nom séparés)
--   first_name = « Thomas », name = « Thomas »       (onboarding actuel : même valeur)
--   first_name = « Thomas », name = « Thomas Levy »  (name = nom complet)
-- profile_full_name donne « Thomas Levy » / « Thomas » / « Thomas Levy » sans
-- doublon, et NULL si les deux sont vides (l'appelant choisit le repli).
--
-- Avant : get_pending_requests ne renvoyait que name (le nom de famille seul),
-- la notification de demande d'ami que first_name (ou '' si first_name NULL,
-- car handle_new_user met name à ''), la liste d'invités name avant first_name,
-- suggestions et recherche « Thomas Thomas » quand les deux valeurs sont égales.

create or replace function public.profile_full_name(p_first_name text, p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when f = '' and n = '' then null
    when f = '' then n
    when n = '' or lower(n) = lower(f) then f
    when lower(n) like lower(f) || ' %' then n
    else f || ' ' || n
  end
  from (select coalesce(btrim(p_first_name), '') as f, coalesce(btrim(p_name), '') as n) v;
$$;

grant execute on function public.profile_full_name(text, text) to authenticated;

-- ── Demandes d'amis reçues (signature inchangée : les anciennes versions de
-- l'app lisent requester_name, qui devient le nom complet) ────────────────────
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
    coalesce(public.profile_full_name(p.first_name, p.name), '@' || nullif(btrim(p.username), ''), 'Utilisateur Amiv') as requester_name,
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

-- ── Notification de demande d'ami ──────────────────────────────────────────
create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select coalesce(public.profile_full_name(first_name, name), '@' || nullif(btrim(username), ''))
  into sender_name
  from profiles where id = new.requester_id;

  insert into notifications (user_id, type, title, body, data, read)
  values (
    new.addressee_id,
    'friend_request',
    coalesce(sender_name, 'Quelqu''un') || ' souhaite vous ajouter',
    'Nouvelle demande d''ami',
    jsonb_build_object(
      'sender_id', new.requester_id,
      'friendship_id', new.id
    ),
    false
  );
  return new;
end;
$$;

-- ── Liste des invités, suggestions, recherche : seule l'expression du nom
-- change (corps repris tels qu'en base au 2026-10-31) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_event_guest_list(p_event_id uuid)
 RETURNS TABLE(guest_key text, user_id uuid, invitation_id uuid, role text, status text, display_name text, username text, avatar_url text, invited_at timestamp with time zone, reminded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  with s as (
    select * from public.event_guest_statuses(array[p_event_id])
    where public.is_event_member(p_event_id)
  ),
  viewer as (
    select public.is_event_organizer(p_event_id) as is_org
  )
  select
    coalesce(s.user_id::text, 'inv_' || s.invitation_id::text, 'link_' || s.guest_rsvp_id::text),
    s.user_id,
    case when viewer.is_org then s.invitation_id end,
    s.role,
    s.status,
    case
      when s.role = 'link_guest' then coalesce(nullif(btrim(s.link_guest_name), ''), 'Invité')
      when s.role = 'email_guest' then
        case when viewer.is_org then s.invited_email else 'Invité par e-mail' end
      else coalesce(
        public.profile_full_name(p.first_name, p.name),
        '@' || nullif(btrim(p.username), ''),
        'Utilisateur Amiv'
      )
    end,
    nullif(btrim(p.username), ''),
    p.avatar_url,
    s.invited_at,
    case when viewer.is_org then s.reminded_at end
  from s
  cross join viewer
  left join public.profiles p on p.id = s.user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_suggestions(p_user_id uuid)
 RETURNS TABLE(user_id uuid, name text, username text, avatar_url text, reason text, mutual_friends_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  with me as (
    select p.id, nullif(lower(btrim(p.city)), '') as city
    from public.profiles p
    where p.id = p_user_id and p_user_id = auth.uid()
  ),
  accepted as (
    select f.requester_id as a, f.addressee_id as b from public.friendships f where f.status = 'accepted'
    union all
    select f.addressee_id, f.requester_id from public.friendships f where f.status = 'accepted'
  ),
  my_friends as (
    select a.b as id from accepted a join me on a.a = me.id
  ),
  mutual as (
    select a.b as candidate_id, count(*)::int as n
    from accepted a join my_friends mf on mf.id = a.a
    group by a.b
  ),
  participants as (
    select ep.event_id, ep.user_id, bool_or(ep.is_organizer) as is_organizer
    from public.event_participants() ep
    group by ep.event_id, ep.user_id
  ),
  my_events as (
    select pa.event_id from participants pa join me on pa.user_id = me.id
  ),
  shared as (
    -- Événements où les deux participent : le nom est affichable.
    select distinct on (pa.user_id)
      pa.user_id as candidate_id,
      count(*) over (partition by pa.user_id)::int as n,
      coalesce(nullif(btrim(e.name), ''), 'un événement') as event_name,
      pa.is_organizer
    from participants pa
    join my_events me_ev on me_ev.event_id = pa.event_id
    join public.events e on e.id = pa.event_id
    order by pa.user_id, e.date desc nulls last, e.created_at desc
  ),
  invites as (
    -- Invitations entre les deux, quel que soit leur statut.
    select distinct on (x.candidate_id)
      x.candidate_id,
      x.i_invited,
      case when exists (select 1 from my_events m where m.event_id = x.event_id) then nullif(btrim(e.name), '') end as event_name
    from (
      select i.invited_user_id as candidate_id, true as i_invited, i.event_id, i.created_at
      from public.invitations i join me on i.invited_by = me.id
      where i.invited_user_id is not null
      union all
      select i.invited_by, false, i.event_id, i.created_at
      from public.invitations i join me on i.invited_user_id = me.id
      where i.invited_by is not null
    ) x
    join public.events e on e.id = x.event_id
    order by x.candidate_id,
      exists (select 1 from my_events m where m.event_id = x.event_id) desc,
      x.created_at desc
  ),
  candidates as (
    select candidate_id from mutual
    union select candidate_id from shared
    union select candidate_id from invites
  ),
  scored as (
    select
      p.id,
      public.profile_full_name(p.first_name, p.name) as display_name,
      nullif(btrim(p.username), '') as username,
      p.avatar_url,
      coalesce(m.n, 0) as mutual_n,
      s.n as shared_n,
      s.event_name as shared_event_name,
      s.is_organizer as shared_is_organizer,
      inv.candidate_id is not null as has_invite,
      inv.i_invited,
      inv.event_name as invite_event_name,
      coalesce(m.n, 0) * 100
        + least(coalesce(s.n, 0), 5) * 30
        + case when inv.candidate_id is not null then 20 else 0 end
        + case when me.city is not null and nullif(lower(btrim(p.city)), '') = me.city then 10 else 0 end
        as score
    from candidates c
    cross join me
    join public.profiles p on p.id = c.candidate_id
    join auth.users u on u.id = p.id and u.deleted_at is null
    left join mutual m on m.candidate_id = p.id
    left join shared s on s.candidate_id = p.id
    left join invites inv on inv.candidate_id = p.id
    where p.id <> me.id
      and coalesce(btrim(p.first_name), '') || coalesce(btrim(p.name), '') || coalesce(btrim(p.username), '') <> ''
      and not exists (
        select 1 from public.friendships f
        where (f.requester_id = me.id and f.addressee_id = p.id)
           or (f.requester_id = p.id and f.addressee_id = me.id)
      )
      and not exists (
        select 1 from public.suggestion_dismissals d
        where d.user_id = me.id and d.dismissed_user_id = p.id
      )
      and not public.is_blocked_between(me.id, p.id)
  )
  select
    s.id,
    s.display_name,
    s.username,
    s.avatar_url,
    case
      when s.mutual_n = 1 then '1 ami en commun'
      when s.mutual_n > 1 then s.mutual_n || ' amis en commun'
      when s.shared_n > 0 and s.shared_is_organizer then 'Organise ' || s.shared_event_name
      when s.shared_n > 0 then 'Invité·e à ' || s.shared_event_name
      when s.has_invite and s.i_invited and s.invite_event_name is not null then 'Tu l''as invité·e à ' || s.invite_event_name
      when s.has_invite and s.i_invited then 'Tu l''as invité·e à un événement'
      when s.has_invite and s.invite_event_name is not null then 'T''a invité·e à ' || s.invite_event_name
      else 'T''a invité·e à un événement'
    end,
    s.mutual_n
  from scored s
  order by s.score desc, s.mutual_n desc, s.display_name nulls last, s.id
  limit 20;
$$;

CREATE OR REPLACE FUNCTION public.search_people(p_query text)
 RETURNS TABLE(user_id uuid, name text, username text, avatar_url text, is_friend boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  with q as (
    select
      btrim(coalesce(p_query, '')) as raw,
      '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  found as (
    select
      p.id,
      public.profile_full_name(p.first_name, p.name) as display_name,
      nullif(btrim(p.username), '') as username,
      p.avatar_url,
      exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
            or (f.requester_id = p.id and f.addressee_id = auth.uid()))
      ) as is_friend
    from public.profiles p
    cross join q
    join auth.users u on u.id = p.id and u.deleted_at is null
    where auth.uid() is not null
      and p.id <> auth.uid()
      and length(q.raw) >= 2
      and coalesce(btrim(p.first_name), '') || coalesce(btrim(p.name), '') || coalesce(btrim(p.username), '') <> ''
      and case
        when position('@' in q.raw) > 0 then lower(u.email) = lower(q.raw)
        else p.username ilike q.pattern
          or p.first_name ilike q.pattern
          or p.name ilike q.pattern
          or concat_ws(' ', p.first_name, p.name) ilike q.pattern
      end
      and not exists (
        select 1 from public.friendships f
        where f.status = 'pending'
          and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
            or (f.requester_id = p.id and f.addressee_id = auth.uid()))
      )
      and not exists (
        select 1 from public.suggestion_dismissals d
        where d.user_id = auth.uid() and d.dismissed_user_id = p.id
      )
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  select f.id, f.display_name, f.username, f.avatar_url, f.is_friend
  from found f
  order by
    f.is_friend desc,
    lower(f.username) = lower((select raw from q)) desc,
    f.username nulls last
  limit 20;
$$;

