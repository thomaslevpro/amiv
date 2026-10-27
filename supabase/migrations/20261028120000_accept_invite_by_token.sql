-- Réponse d'un utilisateur connecté via /invite/<invite_token>.
-- La page envoyait tout le monde dans guest_rsvps (formulaire anonyme) : un compte
-- Amiv qui répondait n'était lié à rien (ni invitation ni RSVP), l'événement
-- n'apparaissait pas dans son app. Et il ne peut pas créer ces lignes lui-même
-- (RLS : seuls les organisateurs invitent).

create or replace function public.accept_invite_by_token(p_token uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.events;
  v_invitation_status text;
  v_invitation_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_status not in ('going', 'declined', 'pending') then
    raise exception 'Réponse invalide' using errcode = '22023';
  end if;

  select * into v_event from public.events where p_token is not null and invite_token = p_token;
  if v_event.id is null then
    raise exception 'Événement introuvable' using errcode = 'P0002';
  end if;

  if v_event.user_id = v_actor then
    return v_event.id;
  end if;

  v_invitation_status := case p_status when 'going' then 'accepted' when 'declined' then 'declined' else 'pending' end;

  -- Invitation existante (par compte ou par email) : on la met à jour et on la rattache au compte.
  update public.invitations
     set status = v_invitation_status,
         invited_user_id = coalesce(invited_user_id, v_actor)
   where id = (
     select i.id from public.invitations i
     where i.event_id = v_event.id
       and (i.invited_user_id = v_actor or lower(i.invited_email) = lower(auth.email()))
     order by (i.invited_user_id = v_actor) desc nulls last
     limit 1
   )
  returning id into v_invitation_id;

  -- Sinon : invitation "rejoint via le lien" (invited_by = soi, pas de notification d'invitation).
  if v_invitation_id is null then
    insert into public.invitations (event_id, invited_user_id, invited_by, status)
    values (v_event.id, v_actor, v_actor, v_invitation_status);
  end if;

  -- Déclenche notify_rsvp_going pour l'organisateur si 'going'.
  insert into public.rsvps (event_id, user_id, status)
  values (v_event.id, v_actor, p_status)
  on conflict (event_id, user_id) do update set status = excluded.status;

  return v_event.id;
end;
$$;

revoke execute on function public.accept_invite_by_token(uuid, text) from public, anon;
grant execute on function public.accept_invite_by_token(uuid, text) to authenticated;
