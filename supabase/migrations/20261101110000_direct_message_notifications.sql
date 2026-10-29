-- Messages privés entre amis : chaque message crée une notification
-- message_received (data : conversation_id, sender_id) pour l'autre
-- participant, sauf s'il a mis la conversation en sourdine ou bloqué
-- l'expéditeur. Le push suit le réglage « Messages » (push_allowed).
--
-- Réglage « Messages » activé par défaut pour les nouveaux comptes :
-- l'autorisation iOS sert de consentement. Les comptes existants gardent
-- leur valeur actuelle.

alter table public.profiles alter column notif_messages set default true;

create or replace function public.push_allowed(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('birthday_reminder', 'birthday_today') then coalesce(p.notif_birthdays, true)
    when p_type in ('event_invitation', 'invitation_received', 'invitation_reminder') then coalesce(p.notif_invitations, true)
    when p_type = 'message_received' then coalesce(p.notif_messages, true)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
begin
  select coalesce(nullif(trim(first_name), ''), nullif(trim(name), ''), 'Un ami')
    into v_sender_name
  from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, data, read)
  select
    p.user_id,
    'message_received',
    format('Message de %s', coalesce(v_sender_name, 'Un ami')),
    case when char_length(new.content) > 40 then left(new.content, 40) || '…' else new.content end,
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id),
    false
  from public.direct_conversation_participants p
  where p.conversation_id = new.conversation_id
    and p.user_id is distinct from new.sender_id
    and coalesce(p.is_muted, false) = false
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = p.user_id and b.blocked_id = new.sender_id
    );

  return new;
end;
$$;

revoke execute on function public.notify_direct_message() from public, anon, authenticated;

drop trigger if exists trg_notify_direct_message on public.direct_messages;
create trigger trg_notify_direct_message
  after insert on public.direct_messages
  for each row
  execute function public.notify_direct_message();
