-- Liste des invités d'un événement et compteurs, calculés au même endroit.
--
-- Avant : chaque écran comptait les lignes rsvps qu'il pouvait lire. Un invité
-- ne lit que sa propre ligne (RLS), donc les cartes affichaient des chiffres
-- différents selon la personne ; et un ami invité sans ligne rsvps
-- n'apparaissait pas dans les participants.
--
-- Maintenant : event_guest_statuses() donne une ligne par personne concernée
-- (organisateur, invités par compte, invités par email sans compte, réponses
-- via le lien public) avec un statut unique :
--   confirmed | maybe | pending | declined
-- get_event_guest_list() (page de l'événement) et get_event_guest_counts()
-- (cartes, accueil, calendrier) reposent dessus.
--
-- Aussi :
--   - l'organisateur ne peut jamais être invité à son propre événement ;
--   - relance limitée à une fois par 24 h et par invitation ;
--   - remove_event_invitation() : retirer une invitation (organisateurs).

-- ---------------------------------------------------------------------------
-- 1. L'organisateur ne peut pas être invité à son propre événement
-- ---------------------------------------------------------------------------
create or replace function public.guard_invitation_not_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee uuid := coalesce(
    new.invited_user_id,
    (select p.id from public.profiles p where lower(p.email) = lower(new.invited_email) limit 1)
  );
begin
  if v_invitee is not null and exists (
    select 1 from public.events e where e.id = new.event_id and e.user_id = v_invitee
  ) then
    raise exception 'L''organisateur ne peut pas être invité à son propre événement'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_invitation_not_owner() from public, anon, authenticated;

drop trigger if exists trg_guard_invitation_not_owner on public.invitations;
create trigger trg_guard_invitation_not_owner
  before insert or update of invited_user_id, invited_email, event_id on public.invitations
  for each row execute function public.guard_invitation_not_owner();

-- Un co-organisateur qui invite en lot ne doit pas tout faire échouer en
-- cochant l'organisateur : on l'ignore comme on ignore soi-même.
create or replace function public.invite_friends_to_event(p_event_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_event_organizer(p_event_id) then
    raise exception 'Seuls les organisateurs peuvent inviter' using errcode = '42501';
  end if;

  insert into public.invitations (event_id, invited_user_id, invited_by, status)
  select p_event_id, uid, auth.uid(), 'pending'
  from unnest(p_user_ids) as uid
  where uid is not null
    and uid <> auth.uid()
    and uid is distinct from (select e.user_id from public.events e where e.id = p_event_id)
  on conflict (event_id, invited_user_id) do nothing;
end;
$$;

revoke all on function public.invite_friends_to_event(uuid, uuid[]) from public, anon;
grant execute on function public.invite_friends_to_event(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Statut de chaque personne (interne, sans contrôle d'accès)
-- ---------------------------------------------------------------------------
-- Réponse effective d'un compte : le RSVP « going » / « declined » fait foi,
-- sinon le statut de l'invitation (accepted / declined / maybe), sinon en attente.
-- role : owner | co_organizer | guest | email_guest | link_guest
create or replace function public.event_guest_statuses(p_event_ids uuid[])
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
  link_guest_name text
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
  )
  select ev.id, ev.user_id, null::uuid, null::uuid, 'owner', 'confirmed',
         null::timestamptz, null::timestamptz, null::text, null::text
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
  join ev on ev.id = g.event_id;
$$;

revoke execute on function public.event_guest_statuses(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Liste des invités (page de l'événement) : membres de l'événement
-- ---------------------------------------------------------------------------
-- Nom affiché : nom, sinon prénom, sinon @pseudo, sinon « Utilisateur Amiv ».
-- Un nom d'une seule lettre compte comme absent (il s'affichait seul : « L »).
-- invitation_id / reminded_at / email : organisateurs seulement.
create or replace function public.get_event_guest_list(p_event_id uuid)
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
  reminded_at timestamptz
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
        case when length(btrim(p.name)) > 1 then btrim(p.name) end,
        case when length(btrim(p.first_name)) > 1 then btrim(p.first_name) end,
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

revoke execute on function public.get_event_guest_list(uuid) from public, anon;
grant execute on function public.get_event_guest_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Compteurs (cartes, accueil, calendrier, page de l'événement)
-- ---------------------------------------------------------------------------
-- Une ligne par événement dont l'appelant est membre ; les autres sont omis.
-- preview : jusqu'à 3 confirmés (organisateur d'abord) pour les avatars des cartes.
create or replace function public.get_event_guest_counts(p_event_ids uuid[])
returns table (
  event_id uuid,
  total integer,
  confirmed integer,
  maybe integer,
  pending integer,
  declined integer,
  preview jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select distinct e.id from unnest(p_event_ids) as e(id)
    where public.is_event_member(e.id)
  ),
  s as (
    select * from public.event_guest_statuses(array(select id from allowed))
  )
  select
    a.id,
    count(s.*)::integer,
    count(*) filter (where s.status = 'confirmed')::integer,
    count(*) filter (where s.status = 'maybe')::integer,
    count(*) filter (where s.status = 'pending')::integer,
    count(*) filter (where s.status = 'declined')::integer,
    coalesce((
      select jsonb_agg(x.j)
      from (
        select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'name', p.name, 'avatar_url', p.avatar_url) as j
        from s s2
        join public.profiles p on p.id = s2.user_id
        where s2.event_id = a.id and s2.status = 'confirmed'
        order by (s2.role = 'owner') desc, s2.invited_at nulls first
        limit 3
      ) x
    ), '[]'::jsonb)
  from allowed a
  left join s on s.event_id = a.id
  group by a.id;
$$;

revoke execute on function public.get_event_guest_counts(uuid[]) from public, anon;
grant execute on function public.get_event_guest_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Relance : une fois par 24 h et par invitation
-- ---------------------------------------------------------------------------
create or replace function public.remind_invitations(p_invitation_ids uuid[], p_message text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_message text := left(nullif(trim(p_message), ''), 300);
  v_notified integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.invitations i
    where i.id = any(p_invitation_ids)
      and not public.is_event_organizer(i.event_id)
  ) then
    raise exception 'Seuls les organisateurs peuvent relancer leurs invités' using errcode = '42501';
  end if;

  with targets as (
    update public.invitations i
       set reminded_at = now()
     where i.id = any(p_invitation_ids)
       and i.status in ('pending', 'maybe')
       and (i.reminded_at is null or i.reminded_at <= now() - interval '24 hours')
    returning
      i.event_id,
      coalesce(
        i.invited_user_id,
        (select p.id from public.profiles p where lower(p.email) = lower(i.invited_email) limit 1)
      ) as user_id
  ),
  notified as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      t.user_id,
      'invitation_reminder',
      format('Petit rappel : %s', e.name),
      coalesce(v_message, 'Pense à répondre à l’invitation'),
      jsonb_build_object('event_id', t.event_id, 'sender_id', v_actor),
      false
    from targets t
    join public.events e on e.id = t.event_id
    where t.user_id is not null
      and t.user_id <> v_actor
    returning 1
  )
  select count(*) into v_notified from notified;

  return v_notified;
end;
$$;

revoke execute on function public.remind_invitations(uuid[], text) from public, anon;
grant execute on function public.remind_invitations(uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Retirer une invitation (organisateurs)
-- ---------------------------------------------------------------------------
-- Supprime l'invitation, la réponse de la personne et ses notifications
-- d'invitation non lues pour cet événement. Retirer un co-organisateur passe
-- par l'espace organisateur, pas par ici.
create or replace function public.remove_event_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or not public.is_event_organizer(v_inv.event_id) then
    raise exception 'Seuls les organisateurs peuvent retirer une invitation' using errcode = '42501';
  end if;

  v_user := coalesce(
    v_inv.invited_user_id,
    (select p.id from public.profiles p where lower(p.email) = lower(v_inv.invited_email) limit 1)
  );

  if v_user is not null and exists (
    select 1 from public.event_organizers o
    where o.event_id = v_inv.event_id and o.user_id = v_user
      and o.role in ('owner', 'co_organizer') and o.status = 'approved'
  ) then
    raise exception 'Impossible de retirer un organisateur' using errcode = '42501';
  end if;

  delete from public.invitations where id = v_inv.id;

  if v_user is not null then
    delete from public.rsvps where event_id = v_inv.event_id and user_id = v_user;
    delete from public.poll_reminders where event_id = v_inv.event_id and user_id = v_user;
    delete from public.notifications
     where user_id = v_user
       and not read
       and type in ('event_invitation', 'invitation_reminder', 'poll_reminder')
       and data->>'event_id' = v_inv.event_id::text;
  end if;
end;
$$;

revoke execute on function public.remove_event_invitation(uuid) from public, anon;
grant execute on function public.remove_event_invitation(uuid) to authenticated;
