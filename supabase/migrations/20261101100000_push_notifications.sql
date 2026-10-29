-- Notifications push iOS (APNs).
--
--   device_tokens : un jeton APNs par appareil. L'app l'enregistre à chaque
--   lancement (register_device_token) et le supprime à la déconnexion ;
--   la suppression du compte l'efface en cascade (auth.users).
--
--   Chaque insertion dans notifications appelle l'Edge Function send-push
--   (pg_net, header x-cron-secret lu dans Vault, comme les crons), sauf si
--   le destinataire n'a aucun appareil ou a coupé ce type dans son profil :
--     notif_birthdays   → birthday_reminder, birthday_today
--     notif_invitations → event_invitation, invitation_received, invitation_reminder
--     notif_messages    → message_received
--   Les autres types (amis, RSVP, souvenirs…) sont toujours envoyés.
--   send-push relit la notification par son id (le contenu ne transite pas
--   par l'appel) et supprime les jetons refusés par APNs.
--
-- Vault (par projet) : project_url, publishable_key, cron_secret — déjà
-- présents pour les crons. Sans eux, aucun push n'est envoyé et l'insertion
-- de la notification n'est jamais bloquée.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios' check (platform in ('ios')),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own" on public.device_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own" on public.device_tokens
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own" on public.device_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own" on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.device_tokens from anon, authenticated;
grant select, insert, update, delete on public.device_tokens to authenticated;

-- Le jeton appartient à l'appareil : si un autre compte se connecte sur le
-- même iPhone, la ligne existante (invisible pour lui via RLS) lui est
-- réattribuée, sinon l'ancien compte continuerait de recevoir ses pushs ici.
create or replace function public.register_device_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'register_device_token requires an authenticated user';
  end if;
  if p_token is null or p_token !~ '^[0-9a-fA-F]{32,200}$' then
    raise exception 'Invalid device token';
  end if;

  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_user, lower(p_token), coalesce(p_platform, 'ios'), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

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
    when p_type = 'message_received' then coalesce(p.notif_messages, false)
    else true
  end
  from (select 1) as one
  left join public.profiles p on p.id = p_user_id;
$$;

revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;

create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_cron_secret text;
begin
  if not exists (select 1 from public.device_tokens where user_id = new.user_id) then
    return new;
  end if;
  if not public.push_allowed(new.user_id, new.type) then
    return new;
  end if;

  begin
    select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into v_publishable_key from vault.decrypted_secrets where name = 'publishable_key';
    select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'cron_secret';
    if v_project_url is null or v_cron_secret is null then
      raise warning 'enqueue_push_notification: Vault secrets missing, push skipped';
      return new;
    end if;

    perform net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', coalesce(v_publishable_key, ''),
        'x-cron-secret', v_cron_secret
      ),
      body := jsonb_build_object('notification_id', new.id),
      timeout_milliseconds := 30000
    );
  exception when others then
    -- Un push raté ne doit jamais annuler la notification in-app.
    raise warning 'enqueue_push_notification failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function public.enqueue_push_notification() from public, anon, authenticated;

drop trigger if exists trg_enqueue_push_notification on public.notifications;
create trigger trg_enqueue_push_notification
  after insert on public.notifications
  for each row
  execute function public.enqueue_push_notification();
