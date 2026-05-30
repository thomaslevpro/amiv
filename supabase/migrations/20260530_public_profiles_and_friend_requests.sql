drop policy if exists "public profiles with username are readable" on public.profiles;
create policy "public profiles with username are readable" on public.profiles
  for select
  to anon, authenticated
  using (username is not null);

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type%';

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'invitation_received','event_invitation','rsvp_received','message_received',
    'birthday_reminder','event_updated','friend_request','friend_accepted',
    'plus_one_request','plus_one_response'
  ));
