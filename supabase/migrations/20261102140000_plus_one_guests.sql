-- Un +1 accepté compte comme un participant.
--
-- Un +1 n'a pas de ligne à lui : c'est plus_one_status / plus_one_name sur la
-- réponse de la personne qui l'amène (rsvps, ou guest_rsvps pour le lien
-- public). Accepter = plus_one_status passe à 'accepted', rien d'autre.
-- event_guest_statuses() ne lisait pas ces colonnes : le +1 n'apparaissait ni
-- dans les compteurs (cartes, accueil, calendrier, page de l'événement) ni dans
-- la liste des invités. get_event_by_share_token (écran d'invitation reçue)
-- comptait encore à sa façon (rsvps going + lien public, sans l'organisateur).
--
-- Maintenant event_guest_statuses() ajoute une ligne role = 'plus_one' par +1
-- accepté, avec le statut de la personne qui l'amène. Si elle décline, ou si
-- l'organisateur retire le +1 (plus_one_status ≠ accepted), la ligne disparaît.
-- Le +1 n'a pas de compte : il n'entre ni dans le chat, ni dans l'espace
-- secret (Flashback, cagnotte), qui ne retiennent que les lignes avec user_id.

drop function if exists public.get_event_guest_list(uuid);
drop function if exists public.event_guest_statuses(uuid[]);

-- ---------------------------------------------------------------------------
-- 1. Statuts : + une ligne par +1 accepté
-- ---------------------------------------------------------------------------
create function public.event_guest_statuses(p_event_ids uuid[])
returns table (
  event_id uuid,
  user_id uuid,
  invitation_id uuid,
  guest_rsvp_id uuid,
  role text,
  status text,
  invited_at timestamptz,
  reminded_at timestamptz,
  invited_email text,
  link_guest_name text,
  host_user_id uuid,
  host_guest_rsvp_id uuid,
  plus_one_rsvp_id uuid,
  plus_one_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select e.id, e.user_id from public.events e where e.id = any(p_event_ids)
  ),
  inv as (
    select distinct on (i.event_id, x.uid)
      i.event_id, x.uid as user_id, i.id, i.status, i.created_at, i.reminded_at
    from public.invitations i
    join ev on ev.id = i.event_id
    cross join lateral (
      select coalesce(
        i.invited_user_id,
        (select p.id from public.profiles p where lower(p.email) = lower(i.invited_email) limit 1)
      ) as uid
    ) x
    where x.uid is not null and x.uid is distinct from ev.user_id
    order by i.event_id, x.uid, (i.invited_user_id is not null) desc, i.created_at
  ),
  co_orgs as (
    select o.event_id, o.user_id
    from public.event_organizers o
    join ev on ev.id = o.event_id
    where o.role in ('owner', 'co_organizer')
      and o.status = 'approved'
      and o.user_id is distinct from ev.user_id
  ),
  people as (
    select inv.event_id, inv.user_id from inv
    union
    select r.event_id, r.user_id
    from public.rsvps r join ev on ev.id = r.event_id
    where r.user_id is not null and r.user_id is distinct from ev.user_id
    union
    select co_orgs.event_id, co_orgs.user_id from co_orgs
  ),
  base as (
    select ev.id as event_id, ev.user_id, null::uuid as invitation_id, null::uuid as guest_rsvp_id,
           'owner'::text as role, 'confirmed'::text as status,
           null::timestamptz as invited_at, null::timestamptz as reminded_at,
           null::text as invited_email, null::text as link_guest_name
    from ev
    where ev.user_id is not null

    union all

    select p.event_id, p.user_id, inv.id, null::uuid,
           case when c.user_id is not null then 'co_organizer' else 'guest' end,
           case
             when r.status = 'going' then 'confirmed'
             when r.status = 'declined' then 'declined'
             when inv.status = 'accepted' then 'confirmed'
             when inv.status = 'declined' then 'declined'
             when inv.status = 'maybe' then 'maybe'
             when c.user_id is not null and inv.id is null and r.user_id is null then 'confirmed'
             else 'pending'
           end,
           coalesce(inv.created_at, r.created_at), inv.reminded_at, null::text, null::text
    from people p
    left join inv on inv.event_id = p.event_id and inv.user_id = p.user_id
    left join public.rsvps r on r.event_id = p.event_id and r.user_id = p.user_id
    left join co_orgs c on c.event_id = p.event_id and c.user_id = p.user_id

    union all

    -- Invitation par email d'une personne sans compte Amiv
    select i.event_id, null::uuid, i.id, null::uuid, 'email_guest',
           case i.status
             when 'accepted' then 'confirmed'
             when 'declined' then 'declined'
             when 'maybe' then 'maybe'
             else 'pending'
           end,
           i.created_at, i.reminded_at, i.invited_email, null::text
    from public.invitations i
    join ev on ev.id = i.event_id
    where i.invited_user_id is null
      and i.invited_email is not null
      and not exists (select 1 from public.profiles p where lower(p.email) = lower(i.invited_email))

    union all

    -- Réponse via le lien public, sans compte
    select g.event_id, null::uuid, null::uuid, g.id, 'link_guest',
           case g.response when 'yes' then 'confirmed' when 'no' then 'declined' else 'maybe' end,
           g.created_at, null::timestamptz, null::text, g.guest_name
    from public.guest_rsvps g
    join ev on ev.id = g.event_id
  )
  select b.*, null::uuid, null::uuid, null::uuid, null::text
  from base b

  union all

  -- +1 accepté d'un invité avec compte (ou d'un co-organisateur)
  select b.event_id, null::uuid, null::uuid, null::uuid, 'plus_one', b.status,
         b.invited_at, null::timestamptz, null::text, null::text,
         b.user_id, null::uuid, r.id, nullif(btrim(r.plus_one_name), '')
  from base b
  join public.rsvps r on r.event_id = b.event_id and r.user_id = b.user_id
  where b.role in ('guest', 'co_organizer')
    and b.status <> 'declined'
    and r.plus_one_status = 'accepted'

  union all

  -- +1 accepté d'une personne venue par le lien public
  select b.event_id, null::uuid, null::uuid, null::uuid, 'plus_one', b.status,
         b.invited_at, null::timestamptz, null::text, null::text,
         null::uuid, g.id, g.id, nullif(btrim(g.plus_one_name), '')
  from base b
  join public.guest_rsvps g on g.id = b.guest_rsvp_id
  where b.role = 'link_guest'
    and b.status <> 'declined'
    and g.plus_one_status = 'accepted';
$$;

revoke execute on function public.event_guest_statuses(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Liste des invités : le +1 sous la personne qui l'amène
-- ---------------------------------------------------------------------------
-- display_name du +1 : son prénom saisi, sinon « +1 de <prénom> ».
-- plus_one_host_key = guest_key de la personne qui l'amène ; plus_one_of =
-- son prénom ; plus_one_source = table de la demande ; plus_one_rsvp_id
-- (organisateurs seulement) = ligne à modifier pour retirer le +1.
create function public.get_event_guest_list(p_event_id uuid)
returns table (
  guest_key text,
  user_id uuid,
  invitation_id uuid,
  role text,
  status text,
  display_name text,
  username text,
  avatar_url text,
  invited_at timestamptz,
  reminded_at timestamptz,
  plus_one_host_key text,
  plus_one_of text,
  plus_one_source text,
  plus_one_rsvp_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select * from public.event_guest_statuses(array[p_event_id])
    where public.is_event_member(p_event_id)
  ),
  viewer as (
    select public.is_event_organizer(p_event_id) as is_org
  ),
  hosts as (
    select s.*,
      case
        when s.host_user_id is not null then coalesce(
          case when length(btrim(hp.first_name)) > 1 then btrim(hp.first_name) end,
          public.profile_full_name(hp.first_name, hp.name),
          '@' || nullif(btrim(hp.username), ''),
          'Invité'
        )
        when s.host_guest_rsvp_id is not null then coalesce(nullif(btrim(hg.guest_name), ''), 'Invité')
      end as host_name
    from s
    left join public.profiles hp on hp.id = s.host_user_id
    left join public.guest_rsvps hg on hg.id = s.host_guest_rsvp_id
  )
  select
    case
      when s.role = 'plus_one' then 'plus1_' || s.plus_one_rsvp_id::text
      else coalesce(s.user_id::text, 'inv_' || s.invitation_id::text, 'link_' || s.guest_rsvp_id::text)
    end,
    s.user_id,
    case when viewer.is_org then s.invitation_id end,
    s.role,
    s.status,
    case
      when s.role = 'plus_one' then coalesce(s.plus_one_name, '+1 de ' || s.host_name)
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
    case when viewer.is_org then s.reminded_at end,
    case when s.role = 'plus_one' then coalesce(s.host_user_id::text, 'link_' || s.host_guest_rsvp_id::text) end,
    case when s.role = 'plus_one' then s.host_name end,
    case when s.role = 'plus_one' then case when s.host_user_id is not null then 'rsvps' else 'guest_rsvps' end end,
    case when s.role = 'plus_one' and viewer.is_org then s.plus_one_rsvp_id end
  from hosts s
  cross join viewer
  left join public.profiles p on p.id = s.user_id;
$$;

revoke execute on function public.get_event_guest_list(uuid) from public, anon;
grant execute on function public.get_event_guest_list(uuid) to authenticated;

-- get_event_guest_counts() compte déjà toutes les lignes de
-- event_guest_statuses() : les +1 y entrent sans changement. L'aperçu
-- (avatars) ne retient que les comptes, donc pas les +1.

-- ---------------------------------------------------------------------------
-- 3. Écran d'invitation reçue : même compte de confirmés que partout
-- ---------------------------------------------------------------------------
create or replace function public.get_event_by_share_token(p_token uuid)
returns table (name text, date timestamptz, location text, description text, type text, organizer_name text, confirmed_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.name,
    e.date,
    e.location,
    e.description,
    e.type,
    p.name,
    (
      select count(*) from public.event_guest_statuses(array[e.id]) s
      where s.status = 'confirmed'
    )::integer
  from public.events e
  left join public.profiles p on p.id = e.user_id
  where p_token is not null
    and e.invite_token = p_token;
$$;
