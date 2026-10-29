-- Suggestions d'amis masquées. Une ligne = user_id ne veut plus voir
-- dismissed_user_id dans ses suggestions. Seul l'auteur voit, crée et
-- supprime ses lignes. Les deux colonnes suivent auth.users en cascade :
-- la suppression d'un compte efface ses lignes (dans les deux sens).

create table if not exists public.suggestion_dismissals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dismissed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint suggestion_dismissals_pair_key unique (user_id, dismissed_user_id),
  check (user_id <> dismissed_user_id)
);

create index if not exists suggestion_dismissals_dismissed_user_id_idx
  on public.suggestion_dismissals (dismissed_user_id);

alter table public.suggestion_dismissals enable row level security;

revoke all on public.suggestion_dismissals from anon, authenticated;
grant select, delete on public.suggestion_dismissals to authenticated;
grant insert (dismissed_user_id) on public.suggestion_dismissals to authenticated;

drop policy if exists "Suggestions masquées : lecture des siennes" on public.suggestion_dismissals;
create policy "Suggestions masquées : lecture des siennes"
  on public.suggestion_dismissals for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Suggestions masquées : création" on public.suggestion_dismissals;
create policy "Suggestions masquées : création"
  on public.suggestion_dismissals for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Suggestions masquées : suppression" on public.suggestion_dismissals;
create policy "Suggestions masquées : suppression"
  on public.suggestion_dismissals for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- get_friend_suggestions : renvoie user_id (le front lisait s.user_id alors
-- que la RPC renvoyait id, donc « Ajouter » envoyait undefined), exclut les
-- profils masqués et les profils incomplets (sans nom ou sans pseudo).
-- ---------------------------------------------------------------------------
drop function if exists public.get_friend_suggestions(uuid);
create function public.get_friend_suggestions(p_user_id uuid)
returns table (user_id uuid, name text, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.name), ''))),
    p.username,
    p.avatar_url
  from public.profiles p
  where p_user_id = auth.uid()
    and p.id <> p_user_id
    and coalesce(trim(p.first_name), '') || coalesce(trim(p.name), '') <> ''
    and coalesce(trim(p.username), '') <> ''
    and p.id not in (
      select addressee_id from public.friendships where requester_id = p_user_id
      union
      select requester_id from public.friendships where addressee_id = p_user_id
    )
    and not exists (
      select 1 from public.suggestion_dismissals d
      where d.user_id = p_user_id and d.dismissed_user_id = p.id
    )
  limit 10;
$$;

revoke execute on function public.get_friend_suggestions(uuid) from public, anon;
grant execute on function public.get_friend_suggestions(uuid) to authenticated;
