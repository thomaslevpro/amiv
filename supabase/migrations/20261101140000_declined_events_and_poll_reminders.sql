-- Invitations : refus et rappel de sondage.
--
--   Refus : une personne qui a répondu « Non » à un événement ne reçoit plus
--   aucune notification pour cet événement (data.event_id), donc aucun push
--   non plus (le push part d'un trigger after insert). Au moment du refus, ses
--   notifications non lues de l'événement passent en lues. « Peut-être »
--   (pending) ne change rien. Source : rsvps.status, toujours écrit par
--   l'app ; à défaut de ligne rsvps, invitations.status.
--
--   Rappel de sondage : quand une personne accepte (rsvps.status → going) un
--   événement dont le sondage de dates est ouvert, poll_reminders retient
--   l'heure d'acceptation. Toutes les 15 min, send_poll_reminders() envoie un
--   seul rappel (poll_reminder) 24 h après si elle participe toujours, que le
--   sondage est encore ouvert, qu'elle n'a voté pour aucune date et que son
--   réglage « Nouvelles invitations » est activé. Le push suit ce même réglage
--   (push_allowed). Un seul rappel par personne et par événement, même après
--   un refus puis une nouvelle acceptation.

-- ── Refus ────────────────────────────────────────────────────────────────────
create or replace function public.has_declined_event(p_user_id uuid, p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.events e where e.id = p_event_id and e.user_id = p_user_id)
    and coalesce(
      (select r.status = 'declined' from public.rsvps r
        where r.event_id = p_event_id and r.user_id = p_user_id limit 1),
      exists (select 1 from public.invitations i
        where i.event_id = p_event_id and i.invited_user_id = p_user_id and i.status = 'declined')
    );
$$;

revoke execute on function public.has_declined_event(uuid, uuid) from public, anon, authenticated;

create or replace function public.skip_declined_event_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if new.data is null or not (new.data ? 'event_id') then
    return new;
  end if;
  begin
    v_event_id := (new.data->>'event_id')::uuid;
  exception when others then
    return new;
  end;
  if public.has_declined_event(new.user_id, v_event_id) then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.skip_declined_event_notification() from public, anon, authenticated;

drop trigger if exists trg_skip_declined_event_notification on public.notifications;
create trigger trg_skip_declined_event_notification
  before insert on public.notifications
  for each row
  execute function public.skip_declined_event_notification();

-- ── Rappel de sondage ────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder', 'memories_revealed', 'memories_surprise',
  'poll_reminder'
));

create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder', 'poll_reminder') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

-- Table serveur uniquement (RLS sans policy, aucun droit client).
create table if not exists public.poll_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  reminded_at timestamptz,
  primary key (event_id, user_id)
);

create index if not exists poll_reminders_due_idx on public.poll_reminders(accepted_at) where reminded_at is null;

alter table public.poll_reminders enable row level security;
revoke all on public.poll_reminders from anon, authenticated;

create or replace function public.on_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'going' then
    insert into public.poll_reminders (event_id, user_id, accepted_at)
    select new.event_id, new.user_id, now()
    from public.events e
    where e.id = new.event_id
      and e.user_id is distinct from new.user_id
      and coalesce(e.poll_closed, false) = false
      and exists (select 1 from public.event_date_options o where o.event_id = e.id)
    on conflict (event_id, user_id) do update
      set accepted_at = excluded.accepted_at
      where public.poll_reminders.reminded_at is null;
  elsif new.status = 'declined' then
    update public.notifications
       set read = true
     where user_id = new.user_id
       and read = false
       and data->>'event_id' = new.event_id::text;
  end if;
  return new;
end;
$$;

revoke execute on function public.on_rsvp_status_change() from public, anon, authenticated;

drop trigger if exists trg_on_rsvp_status_change on public.rsvps;
create trigger trg_on_rsvp_status_change
  after insert or update of status on public.rsvps
  for each row
  execute function public.on_rsvp_status_change();

-- Renvoie le nombre de rappels créés. Chaque ligne échue (24 h passées,
-- personne toujours « going ») est traitée une seule fois, rappel envoyé ou
-- non ; une personne qui n'est plus « going » garde sa ligne pour une
-- éventuelle nouvelle acceptation.
create or replace function public.send_poll_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer := 0;
begin
  with due as (
    select pr.event_id, pr.user_id
    from public.poll_reminders pr
    where pr.reminded_at is null
      and pr.accepted_at <= now() - interval '24 hours'
      and exists (
        select 1 from public.rsvps r
        where r.event_id = pr.event_id and r.user_id = pr.user_id and r.status = 'going'
      )
    for update of pr skip locked
  ),
  processed as (
    update public.poll_reminders pr
       set reminded_at = now()
      from due
     where pr.event_id = due.event_id and pr.user_id = due.user_id
    returning pr.event_id, pr.user_id
  ),
  sent as (
    insert into public.notifications (user_id, type, title, body, data, read)
    select
      p.user_id,
      'poll_reminder',
      format('Un sondage attend ta réponse : %s', e.name),
      'Indique tes disponibilités pour aider à choisir la date',
      jsonb_build_object('event_id', e.id),
      false
    from processed p
    join public.events e on e.id = p.event_id
    left join public.profiles pf on pf.id = p.user_id
    where coalesce(e.poll_closed, false) = false
      and coalesce(pf.notif_invitations, true)
      and exists (select 1 from public.event_date_options o where o.event_id = e.id)
      and not exists (
        select 1
        from public.event_date_votes v
        join public.event_date_options o on o.id = v.option_id
        where o.event_id = e.id and v.user_id = p.user_id
      )
    returning 1
  )
  select count(*) into v_sent from sent;

  return v_sent;
end;
$$;

revoke all on function public.send_poll_reminders() from public, anon, authenticated;
grant execute on function public.send_poll_reminders() to service_role;

-- SQL pur : aucun appel HTTP, le push part du trigger des notifications.
select cron.unschedule('poll-reminders')
where exists (select 1 from cron.job where jobname = 'poll-reminders');

select cron.schedule('poll-reminders', '*/15 * * * *', $$select public.send_poll_reminders();$$);
