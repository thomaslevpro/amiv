-- Flux agenda (webcal). Avant : policy "Public read by token" (qual = true) sur
-- calendar_tokens et vue calendar_feed_items lisible par anon / authenticated —
-- la clé anon publique suffisait pour lire les tokens, événements et anniversaires
-- de tous les utilisateurs.
-- Après : la vue n'est plus exposée ; api/calendar/[token].ts appelle
-- get_calendar_feed(p_token), qui ne renvoie que le flux du token donné.
-- Un utilisateur connecté ne lit / gère que son propre token.

revoke all on public.calendar_feed_items from anon, authenticated;

drop policy if exists "Public read by token" on public.calendar_tokens;
drop policy if exists "Users can manage their own calendar token" on public.calendar_tokens;

revoke all on public.calendar_tokens from anon;

create policy "Users can manage their own calendar token" on public.calendar_tokens
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_calendar_feed(p_token uuid)
returns table (
  item_id uuid,
  item_type text,
  title text,
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  emoji text,
  uid_source text
)
language sql
stable
security definer
set search_path = public
as $$
  select f.item_id, f.item_type, f.title, f.description, f.location, f.start_at, f.end_at, f.emoji, f.uid_source
  from public.calendar_feed_items f
  where p_token is not null
    and f.calendar_token = p_token;
$$;

revoke execute on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;
