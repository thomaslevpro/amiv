-- is_event_planner : l'owner garde toujours l'accès à la préparation
-- (checklist_items, event_expenses, event_budgets), même s'il est la personne
-- fêtée : il organise son propre anniversaire, il n'y a pas de surprise à
-- protéger sur la logistique. La personne fêtée reste exclue si elle n'est que
-- co-organisatrice. L'espace secret (can_access_secret_space : cadeaux,
-- cagnotte, souvenirs, cartes, chat secret) n'est pas modifié : il contient ce
-- que les invités préparent pour elle et reste fermé à la personne fêtée,
-- owner compris.
--
-- get_dm_other_last_read : présence « Vu il y a… » dans ConversationScreen.
-- La policy SELECT de direct_conversation_participants ne montre que ses
-- propres lignes ; plutôt que l'élargir (elle exposerait aussi is_muted), la
-- RPC renvoie uniquement last_read_at de l'autre participant, pour une
-- conversation dont l'appelant fait partie, et rien en cas de blocage.

create or replace function public.is_event_planner(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_event_organizer(p_event_id)
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and (
          e.birthday_person_user_id is distinct from auth.uid()
          or e.user_id = auth.uid()
          or exists (
            select 1 from public.event_organizers o
            where o.event_id = p_event_id
              and o.user_id = auth.uid()
              and o.role = 'owner'
              and o.status = 'approved'
          )
        )
    );
$$;

revoke all on function public.is_event_planner(uuid) from public, anon;
grant execute on function public.is_event_planner(uuid) to authenticated;

create or replace function public.get_dm_other_last_read(p_conversation_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select o.last_read_at
  from public.direct_conversation_participants o
  where o.conversation_id = p_conversation_id
    and o.user_id <> auth.uid()
    and exists (
      select 1 from public.direct_conversation_participants me
      where me.conversation_id = p_conversation_id
        and me.user_id = auth.uid()
    )
    and not public.is_blocked_between(auth.uid(), o.user_id)
  limit 1;
$$;

revoke all on function public.get_dm_other_last_read(uuid) from public, anon;
grant execute on function public.get_dm_other_last_read(uuid) to authenticated;
