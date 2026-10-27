-- Relance des invités. L'ancien flux ne pouvait pas marcher :
--   - edge function send-reminder non déployée (et relais d'email sans authentification) ;
--   - update invitations status = 'reminded' : valeur hors invitations_status_check,
--     colonne updated_at inexistante, aucun droit d'update pour l'organisateur.
-- On garde le statut de réponse intact (pending / maybe) et on trace la relance à part.

alter table public.invitations add column if not exists reminded_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invitation_received', 'event_invitation', 'rsvp_received', 'message_received',
  'birthday_reminder', 'birthday_today', 'event_updated', 'friend_request',
  'friend_accepted', 'plus_one_request', 'plus_one_response', 'co_organizer_added',
  'guest_leader_request', 'guest_leader_approved', 'guest_leader_rejected',
  'invitation_reminder'
));

-- Renvoie le nombre de personnes notifiées (les invitations par email sans compte
-- Amiv sont marquées relancées mais ne reçoivent pas de notification).
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
