-- Nom affiché : une lettre seule ne compte pas comme un nom.
--
-- 20261101160000 avait corrigé les listes d'invités qui affichaient « L » tout
-- seul (prénom vide, nom d'une lettre) : on passait au @pseudo. En
-- introduisant profile_full_name, 20261102110000 a perdu cette règle, et la
-- liste repassait à « L ». Maintenant profile_full_name renvoie NULL quand le
-- résultat fait une lettre ou moins ; chaque appelant applique alors son repli
-- habituel (@pseudo, puis « Utilisateur Amiv » ou équivalent). « Léa M »
-- reste « Léa M ».
--
-- Les notifications de demande de +1, d'ajout comme co-organisateur et de
-- demande de coordination affichaient encore le prénom seul (ou une chaîne
-- vide) : elles passent à « Prénom Nom » avec le même repli.

create or replace function public.profile_full_name(p_first_name text, p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when length(r) > 1 then r end
  from (
    select case
      when f = '' and n = '' then null
      when f = '' then n
      when n = '' or lower(n) = lower(f) then f
      when lower(n) like lower(f) || ' %' then n
      else f || ' ' || n
    end as r
    from (select coalesce(btrim(p_first_name), '') as f, coalesce(btrim(p_name), '') as n) v
  ) x;
$$;

-- ── Notification de demande de +1 / réponse (corps repris de 20261028100100) ─
create or replace function public.notify_plus_one_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  requester_name text;
begin
  select id, user_id into ev from public.events where id = new.event_id;

  if new.plus_one_requested and new.plus_one_status = 'pending'
     and not (coalesce(old.plus_one_requested, false) and old.plus_one_status = 'pending') then
    if ev.user_id is null or ev.user_id = new.user_id then
      return new;
    end if;
    select coalesce(public.profile_full_name(first_name, name), '@' || nullif(btrim(username), ''))
      into requester_name from public.profiles where id = new.user_id;
    requester_name := coalesce(requester_name, 'Un invité');

    insert into public.notifications (user_id, type, title, body, data)
    values (
      ev.user_id,
      'plus_one_request',
      format('%s veut amener un +1', requester_name),
      new.plus_one_message,
      jsonb_build_object('event_id', new.event_id, 'rsvp_id', new.id, 'table', 'rsvps', 'requester_name', requester_name)
    );
  elsif new.plus_one_status in ('accepted', 'declined')
        and old.plus_one_status is distinct from new.plus_one_status
        and new.user_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'plus_one_response',
      case when new.plus_one_status = 'accepted' then '🎉 +1 accepté !' else '+1 refusé' end,
      null,
      jsonb_build_object('event_id', new.event_id, 'status', new.plus_one_status)
    );
  end if;
  return new;
end;
$$;

-- ── Ajout comme co-organisateur (corps tel qu'en base au 2026-10-31) ─────────
create or replace function public.notify_co_organizer_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  sender_id uuid;
  sender_name text;
begin
  if new.role <> 'co_organizer' or new.status <> 'approved' then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;
  sender_id := coalesce(auth.uid(), ev.user_id);
  if sender_id = new.user_id then
    return new;
  end if;

  select coalesce(public.profile_full_name(first_name, name), '@' || nullif(btrim(username), ''))
    into sender_name from public.profiles where id = sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.user_id,
    'co_organizer_added',
    'Tu es co-organisateur de ' || coalesce(ev.name, 'un événement'),
    coalesce(sender_name, 'Quelqu''un') || ' t''a ajouté(e) comme co-organisateur',
    jsonb_build_object('event_id', new.event_id, 'sender_id', sender_id)
  );

  return new;
end;
$$;

-- ── Demande de coordination (corps tel qu'en base au 2026-10-31) ─────────────
create or replace function public.notify_guest_leader_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  candidate_name text;
begin
  if new.role <> 'guest_leader' then
    return new;
  end if;

  select id, name, user_id into ev from public.events where id = new.event_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    if ev.user_id is null then
      return new;
    end if;
    select coalesce(public.profile_full_name(first_name, name), '@' || nullif(btrim(username), ''))
      into candidate_name from public.profiles where id = new.user_id;
    candidate_name := coalesce(candidate_name, 'Quelqu’un');

    insert into public.notifications (user_id, type, title, body, data, read)
    values (
      ev.user_id,
      'guest_leader_request',
      format('%s veut coordonner un anniversaire', candidate_name),
      format('%s souhaite coordonner l''espace secret de %s', candidate_name, ev.name),
      jsonb_build_object('event_id', new.event_id, 'sender_id', new.user_id),
      false
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, data, read)
    values (
      new.user_id,
      case when new.status = 'approved' then 'guest_leader_approved' else 'guest_leader_rejected' end,
      case when new.status = 'approved' then 'Tu es coordinateur ! ✦' else 'Demande de coordination' end,
      case
        when new.status = 'approved' then format('L''organisateur t''a confirmé comme coordinateur de %s', ev.name)
        else format('Ta demande pour %s n''a pas été retenue', ev.name)
      end,
      jsonb_build_object('event_id', new.event_id, 'sender_id', coalesce(auth.uid(), ev.user_id)),
      false
    );
  end if;
  return new;
end;
$$;
