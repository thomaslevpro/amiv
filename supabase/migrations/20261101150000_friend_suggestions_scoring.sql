-- Suggestions d'amis calculées côté serveur avec un score, et recherche de
-- personnes avec les mêmes exclusions.
--
-- Critères (par ordre d'importance) :
--   1. amis en commun (chaque ami compte) ;
--   2. événements partagés : les deux participent (organisateur, co-organisateur
--      approuvé, RSVP « going » ou invitation acceptée) ;
--   3. invitation entre les deux personnes (dans un sens ou dans l'autre) ;
--   4. même ville (profiles.city) : bonus seulement si un des critères 1-3 existe.
--
-- Exclusions (toujours) : soi-même, toute ligne friendships entre les deux
-- (acceptée, en attente ou refusée), blocages dans les deux sens, profils masqués
-- (suggestion_dismissals), profils sans nom ni pseudo, comptes supprimés.
--
-- Confidentialité : les fonctions sont SECURITY DEFINER mais ne renvoient que
-- id, nom, pseudo, photo, la raison et le nombre d'amis en commun. Le nom d'un
-- événement n'apparaît dans la raison que si l'appelant y participe.

-- ---------------------------------------------------------------------------
-- 1. Ville (privée : lisible seulement via get_my_profile, modifiable par soi)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists city text;

-- Mêmes droits qu'en prod (20261028140000) + city en écriture. Réappliqués ici
-- pour que staging, créé depuis un dump sans les droits, soit identique.
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select (id, name, first_name, username, avatar_url) on public.profiles to authenticated;
grant update (
  name, first_name, username, avatar_url, birthday, city,
  onboarding_step, onboarding_completed,
  notif_birthdays, notif_invitations, notif_messages
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Participation à un événement
-- ---------------------------------------------------------------------------
create or replace function public.event_participants()
returns table (event_id uuid, user_id uuid, is_organizer boolean)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.user_id, true from public.events e where e.user_id is not null
  union all
  select o.event_id, o.user_id, o.role in ('owner', 'co_organizer')
  from public.event_organizers o where o.status = 'approved'
  union all
  select r.event_id, r.user_id, false from public.rsvps r where r.status = 'going'
  union all
  select i.event_id, i.invited_user_id, false
  from public.invitations i where i.status = 'accepted' and i.invited_user_id is not null;
$$;

-- Fonction interne : jamais appelable depuis l'app.
revoke execute on function public.event_participants() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Suggestions
-- ---------------------------------------------------------------------------
drop function if exists public.get_friend_suggestions(uuid);
create function public.get_friend_suggestions(p_user_id uuid)
returns table (
  user_id uuid,
  name text,
  username text,
  avatar_url text,
  reason text,
  mutual_friends_count integer
)
language sql
stable
security definer
set search_path = public
as $$
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
      nullif(btrim(concat_ws(' ', nullif(btrim(p.first_name), ''), nullif(btrim(p.name), ''))), '') as display_name,
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

revoke execute on function public.get_friend_suggestions(uuid) from public, anon;
grant execute on function public.get_friend_suggestions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recherche « Ajouter un ami »
-- ---------------------------------------------------------------------------
-- Par nom, prénom ou pseudo (partiel), ou email exact. Mêmes exclusions que les
-- suggestions, sauf : les amis apparaissent (is_friend = true) et une demande
-- refusée ou annulée n'empêche pas de renvoyer une demande.
create or replace function public.search_people(p_query text)
returns table (user_id uuid, name text, username text, avatar_url text, is_friend boolean)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      btrim(coalesce(p_query, '')) as raw,
      '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  found as (
    select
      p.id,
      nullif(btrim(concat_ws(' ', nullif(btrim(p.first_name), ''), nullif(btrim(p.name), ''))), '') as display_name,
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

revoke execute on function public.search_people(text) from public, anon;
grant execute on function public.search_people(text) to authenticated;
