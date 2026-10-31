-- Messages privés : réactions emoji, réponse à un message, suppression de ses
-- propres messages.
--
-- message_reactions a été créée à la main (hors migrations) : tout est écrit
-- pour s'appliquer sur une base qui l'a déjà comme sur une base qui ne l'a pas.

-- ── Réactions ──────────────────────────────────────────────────────────────
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, emoji)
);

-- Les 6 emojis proposés par l'app. NOT VALID : n'examine pas d'éventuelles
-- anciennes lignes, mais s'applique à toutes les nouvelles.
alter table public.message_reactions drop constraint if exists message_reactions_emoji_check;
alter table public.message_reactions
  add constraint message_reactions_emoji_check
  check (emoji in ('❤️', '😂', '🎉', '👍', '😮', '😢')) not valid;

alter table public.message_reactions enable row level security;

revoke all on public.message_reactions from anon;
revoke update, truncate, references, trigger on public.message_reactions from authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

drop policy if exists "Users can read reactions in their conversations" on public.message_reactions;
create policy "Users can read reactions in their conversations"
  on public.message_reactions for select to authenticated
  using (exists (
    select 1
    from public.direct_messages dm
    join public.direct_conversation_participants dcp on dcp.conversation_id = dm.conversation_id
    where dm.id = message_reactions.message_id and dcp.user_id = auth.uid()
  ));

-- Pour soi-même, et seulement sur un message de ses conversations
drop policy if exists "Users can insert their own reactions" on public.message_reactions;
create policy "Users can insert their own reactions"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.direct_messages dm
      join public.direct_conversation_participants dcp on dcp.conversation_id = dm.conversation_id
      where dm.id = message_reactions.message_id and dcp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own reactions" on public.message_reactions;
create policy "Users can delete their own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Comme pour les messages : pas de réaction entre deux personnes qui se sont
-- bloquées (is_blocked_between n'est pas exécutable par les utilisateurs,
-- d'où le trigger plutôt qu'une règle RLS).
create or replace function public.guard_message_reaction_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.direct_messages dm
    join public.direct_conversation_participants p on p.conversation_id = dm.conversation_id
    where dm.id = new.message_id
      and p.user_id <> new.user_id
      and public.is_blocked_between(p.user_id, new.user_id)
  ) then
    raise exception 'Impossible de réagir à ce message.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_message_reaction_block() from public, anon, authenticated;

drop trigger if exists trg_guard_message_reaction_block on public.message_reactions;
create trigger trg_guard_message_reaction_block
  before insert on public.message_reactions
  for each row execute function public.guard_message_reaction_block();

-- ── Réponse à un message ───────────────────────────────────────────────────
alter table public.direct_messages
  add column if not exists reply_to_id uuid references public.direct_messages(id) on delete set null;

-- Le message cité doit appartenir à la même conversation
create or replace function public.guard_direct_message_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.direct_messages dm
    where dm.id = new.reply_to_id and dm.conversation_id = new.conversation_id
  ) then
    raise exception 'Message cité introuvable.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_direct_message_reply() from public, anon, authenticated;

drop trigger if exists trg_guard_direct_message_reply on public.direct_messages;
create trigger trg_guard_direct_message_reply
  before insert or update of reply_to_id on public.direct_messages
  for each row execute function public.guard_direct_message_reply();

-- ── Supprimer ses propres messages ─────────────────────────────────────────
-- Ses réactions partent avec (cascade), les réponses perdent leur citation.
drop policy if exists "sender can delete own message" on public.direct_messages;
create policy "sender can delete own message"
  on public.direct_messages for delete to authenticated
  using (sender_id = auth.uid());

-- ── Temps réel ─────────────────────────────────────────────────────────────
-- direct_messages y est déjà en prod (pas sur staging) : sans effet si présent.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['message_reactions', 'direct_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
