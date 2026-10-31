-- Chat d'événement : mêmes interactions que les messages privés
-- (20261102170000) : réactions emoji, réponse à un message, suppression de
-- ses propres messages.

-- ── Réactions ──────────────────────────────────────────────────────────────
create table if not exists public.event_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '🎉', '👍', '😮', '😢')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.event_message_reactions enable row level security;

revoke all on public.event_message_reactions from anon, authenticated;
grant select, insert, delete on public.event_message_reactions to authenticated;

-- Lisible par qui peut lire le message (la règle de messages s'applique dans
-- la sous-requête : canal Général / Secret, auteurs bloqués exclus). Les
-- réactions des personnes que j'ai bloquées ne me sont pas montrées.
drop policy if exists "read reactions of readable messages" on public.event_message_reactions;
create policy "read reactions of readable messages"
  on public.event_message_reactions for select to authenticated
  using (
    exists (select 1 from public.messages m where m.id = event_message_reactions.message_id)
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = event_message_reactions.user_id
    )
  );

-- Pour soi-même, sur un message (pas système) d'un canal auquel on a accès
drop policy if exists "insert own reactions" on public.event_message_reactions;
create policy "insert own reactions"
  on public.event_message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = event_message_reactions.message_id
        and m.system_type is null
        and (
          (not m.is_secret and public.can_access_event_chat(m.event_id))
          or (m.is_secret and public.can_access_secret_space(m.event_id))
        )
    )
  );

drop policy if exists "delete own reactions" on public.event_message_reactions;
create policy "delete own reactions"
  on public.event_message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Pas de réaction entre l'auteur du message et quelqu'un qu'il a bloqué (ou
-- qui l'a bloqué)
create or replace function public.guard_event_message_reaction_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.messages m
    where m.id = new.message_id
      and m.user_id is not null
      and m.user_id <> new.user_id
      and public.is_blocked_between(m.user_id, new.user_id)
  ) then
    raise exception 'Impossible de réagir à ce message.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_event_message_reaction_block() from public, anon, authenticated;

drop trigger if exists trg_guard_event_message_reaction_block on public.event_message_reactions;
create trigger trg_guard_event_message_reaction_block
  before insert on public.event_message_reactions
  for each row execute function public.guard_event_message_reaction_block();

-- ── Réponse à un message ───────────────────────────────────────────────────
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

-- Le message cité doit être du même événement et du même canal : jamais une
-- citation du Secret dans le Général
create or replace function public.guard_event_message_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.reply_to_id
      and m.event_id = new.event_id
      and m.is_secret = new.is_secret
  ) then
    raise exception 'Message cité introuvable.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_event_message_reply() from public, anon, authenticated;

drop trigger if exists trg_guard_event_message_reply on public.messages;
create trigger trg_guard_event_message_reply
  before insert or update of reply_to_id on public.messages
  for each row execute function public.guard_event_message_reply();

-- Lecture : mêmes règles qu'avant, reply_to_id en plus
drop function if exists public.get_event_messages(uuid, boolean);
create function public.get_event_messages(p_event_id uuid, p_is_secret boolean)
returns table(id uuid, event_id uuid, user_id uuid, content text, created_at timestamptz, is_secret boolean, is_hidden boolean, system_type text, system_data jsonb, reply_to_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         m.event_id,
         m.user_id,
         case when b.blocked_id is null then m.content end,
         m.created_at,
         m.is_secret,
         b.blocked_id is not null,
         m.system_type,
         case when b.blocked_id is null then m.system_data end,
         m.reply_to_id
  from public.messages m
  left join public.user_blocks b
    on b.blocker_id = auth.uid() and b.blocked_id = m.user_id
  where m.event_id = p_event_id
    and m.is_secret = p_is_secret
    and auth.uid() is not null
    and (
      m.user_id = auth.uid()
      or (not p_is_secret and public.can_access_event_chat(p_event_id))
      or (p_is_secret and public.can_access_secret_space(p_event_id))
    )
  order by m.created_at;
$$;

revoke execute on function public.get_event_messages(uuid, boolean) from public, anon;
grant execute on function public.get_event_messages(uuid, boolean) to authenticated;

-- ── Supprimer ses propres messages (jamais un message système) ─────────────
grant delete on public.messages to authenticated;
drop policy if exists "delete own message" on public.messages;
create policy "delete own message"
  on public.messages for delete to authenticated
  using (user_id = auth.uid() and system_type is null);

-- ── Temps réel ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_message_reactions'
  ) then
    alter publication supabase_realtime add table public.event_message_reactions;
  end if;
end;
$$;
