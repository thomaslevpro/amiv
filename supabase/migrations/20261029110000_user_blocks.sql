-- Blocage d'utilisateurs (App Store 1.2). Une ligne = blocker_id a bloqué
-- blocked_id. Seul le bloqueur voit, crée et supprime ses blocages : la
-- personne bloquée ne peut pas savoir qu'elle l'est.
-- Les effets (messages privés, invitations, demandes d'ami, chats
-- d'événement) sont appliqués dans 20261029110100_user_blocks_enforcement.

create table if not exists public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

revoke all on public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;

drop policy if exists "Blocages : lecture des siens" on public.user_blocks;
create policy "Blocages : lecture des siens"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Blocages : création" on public.user_blocks;
create policy "Blocages : création"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "Blocages : suppression" on public.user_blocks;
create policy "Blocages : suppression"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Vrai si l'un des deux a bloqué l'autre. Réservée aux triggers et fonctions
-- SECURITY DEFINER : exposée aux clients, elle révélerait qui bloque qui.
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Bloquer annule les demandes d'ami en attente entre les deux personnes
-- (dans les deux sens). Une amitié déjà acceptée est conservée.
create or replace function public.on_user_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships f
  where f.status = 'pending'
    and ((f.requester_id = new.blocker_id and f.addressee_id = new.blocked_id)
      or (f.requester_id = new.blocked_id and f.addressee_id = new.blocker_id));
  return new;
end;
$$;

drop trigger if exists trg_on_user_blocked on public.user_blocks;
create trigger trg_on_user_blocked
  after insert on public.user_blocks
  for each row execute function public.on_user_blocked();
