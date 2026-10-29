-- get_friend_suggestions :
--  - un profil n'est exclu que s'il n'a NI nom NI pseudo (le front affiche le
--    nom, sinon @pseudo) ;
--  - exclut les personnes bloquées dans les deux sens (is_blocked_between,
--    appelée ici depuis une fonction SECURITY DEFINER, ne révèle rien au client).
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
    nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.name), ''))), ''),
    nullif(trim(p.username), ''),
    p.avatar_url
  from public.profiles p
  where p_user_id = auth.uid()
    and p.id <> p_user_id
    and coalesce(trim(p.first_name), '') || coalesce(trim(p.name), '') || coalesce(trim(p.username), '') <> ''
    and p.id not in (
      select addressee_id from public.friendships where requester_id = p_user_id
      union
      select requester_id from public.friendships where addressee_id = p_user_id
    )
    and not exists (
      select 1 from public.suggestion_dismissals d
      where d.user_id = p_user_id and d.dismissed_user_id = p.id
    )
    and not public.is_blocked_between(p_user_id, p.id)
  limit 10;
$$;

revoke execute on function public.get_friend_suggestions(uuid) from public, anon;
grant execute on function public.get_friend_suggestions(uuid) to authenticated;
