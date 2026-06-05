create or replace function public.create_event_with_owner(
  p_name text,
  p_date timestamptz default null,
  p_location text default null,
  p_description text default null,
  p_type text default null,
  p_visibility text default 'Sur invitation',
  p_cover_image text default null,
  p_birthday_person_user_id uuid default null,
  p_date_options jsonb default '[]'::jsonb,
  p_invited_user_ids uuid[] default array[]::uuid[]
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.events;
  v_invited_user_ids uuid[] := array[]::uuid[];
  v_invalid_invitee_count integer := 0;
begin
  if v_actor is null then
    raise exception 'create_event_with_owner requires an authenticated user';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Event name is required';
  end if;

  if p_date_options is null then
    p_date_options := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_date_options) <> 'array' then
    raise exception 'p_date_options must be a JSON array';
  end if;

  if jsonb_array_length(p_date_options) > 4 then
    raise exception 'An event can have at most 4 date options';
  end if;

  select coalesce(array_agg(distinct invitee_id), array[]::uuid[])
    into v_invited_user_ids
  from unnest(coalesce(p_invited_user_ids, array[]::uuid[])) as invitees(invitee_id)
  where invitee_id is not null
    and invitee_id <> v_actor;

  select count(*)
    into v_invalid_invitee_count
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  where not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_actor and f.addressee_id = invitee_id)
        or (f.addressee_id = v_actor and f.requester_id = invitee_id)
      )
  );

  if v_invalid_invitee_count > 0 then
    raise exception 'All invited users must be accepted friends';
  end if;

  insert into public.events (
    name,
    date,
    location,
    description,
    type,
    visibility,
    user_id,
    cover_image,
    birthday_person_user_id
  )
  values (
    trim(p_name),
    p_date,
    p_location,
    p_description,
    p_type,
    coalesce(p_visibility, 'Sur invitation'),
    v_actor,
    nullif(p_cover_image, ''),
    p_birthday_person_user_id
  )
  returning * into v_event;

  insert into public.event_organizers (event_id, user_id, role)
  values (v_event.id, v_actor, 'owner');

  insert into public.event_date_options (event_id, proposed_date, proposed_time)
  select
    v_event.id,
    (option_row->>'date')::date,
    nullif(option_row->>'time', '')::time
  from jsonb_array_elements(p_date_options) as option_row
  where nullif(option_row->>'date', '') is not null;

  insert into public.invitations (event_id, invited_user_id, invited_by, status)
  select v_event.id, invitee_id, v_actor, 'pending'
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  on conflict (event_id, invited_user_id) do nothing;

  insert into public.rsvps (event_id, user_id, status)
  select v_event.id, invitee_id, 'pending'
  from unnest(v_invited_user_ids) as invitees(invitee_id)
  on conflict (event_id, user_id)
  do update set status = excluded.status;

  insert into public.notifications (user_id, type, title, body, data, read)
  select
    invitee_id,
    'event_invitation',
    format('Tu es invité(e) à %s', v_event.name),
    case
      when v_event.date is not null then 'Réponds à l’invitation sur Amiv'
      else 'Vote pour tes disponibilités sur Amiv'
    end,
    jsonb_build_object('event_id', v_event.id, 'sender_id', v_actor),
    false
  from unnest(v_invited_user_ids) as invitees(invitee_id);

  return v_event;
end;
$$;

revoke all on function public.create_event_with_owner(
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  uuid[]
) from public;

grant execute on function public.create_event_with_owner(
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  uuid[]
) to authenticated;
