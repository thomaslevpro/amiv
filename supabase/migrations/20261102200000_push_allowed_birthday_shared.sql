-- « Anniversaire partagé » (birthday_shared) suit à nouveau le réglage
-- « Nouvelles invitations » (notif_invitations), comme prévu par
-- 20261101170000_birthday_requests. Le type avait disparu de push_allowed
-- quand 20261101190000_secret_space_chat_link l'a redéfinie.

create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder', 'poll_reminder', 'secret_space_reminder', 'birthday_shared') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    when p_type = 'cagnotte_reminder' then coalesce(p.notif_cagnotte, true)
    when p_type in ('event_photos_added', 'event_photos_expiring') then coalesce(p.notif_photos, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;
