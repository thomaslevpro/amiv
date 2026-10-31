-- Wishlist : « Je prends en charge » ou « Via la cagnotte », annulation de la
-- réservation, suppression des cadeaux collectifs réservée aux coordinateurs.
--
-- Existant réutilisé :
--   gift_items : idées de la wishlist (claimed_by = « je prends en charge »).
--   gifts      : cadeaux collectifs (section « Cadeaux collectifs », cagnotte).
--
-- « Via la cagnotte » crée un cadeau collectif à partir de l'idée et la relie
-- par gift_items.collective_gift_id : l'idée disparaît de la wishlist. Si le
-- cadeau collectif est supprimé, la clé repasse à null et l'idée réapparaît.
--
-- Avant :
--   - gift_items : tout membre de l'espace secret pouvait modifier toutes les
--     colonnes de toutes les idées (donc retirer la réservation d'un autre) ;
--   - gifts : suppression par l'auteur du cadeau (added_by) seulement, les
--     organisateurs et le coordinateur ne pouvaient pas supprimer.
-- La personne fêtée n'a jamais accès (can_access_secret_space l'exclut, même
-- organisatrice) : ni avant ni après.

-- ── Lien wishlist → cadeau collectif ───────────────────────────────────────
alter table public.gift_items
  add column if not exists collective_gift_id uuid
    references public.gifts(id) on delete set null;

create unique index if not exists gift_items_collective_gift_id_key
  on public.gift_items (collective_gift_id);

-- ── Réserver / annuler : seulement pour soi ────────────────────────────────
-- La RLS ne voit pas l'ancienne valeur : on limite les lignes modifiables
-- (libres ou à soi) et le résultat (libre ou à soi). Seule la colonne
-- claimed_by est modifiable, donc les seuls passages possibles sont
-- null → moi (« Je prends en charge ») et moi → null (« Annuler »).
revoke update on public.gift_items from anon, authenticated;
grant update (claimed_by) on public.gift_items to authenticated;

drop policy if exists "Espace secret : réservation idée cadeau" on public.gift_items;
create policy "Espace secret : réservation idée cadeau"
  on public.gift_items for update to authenticated
  using (
    public.can_access_secret_space(event_id)
    and collective_gift_id is null
    and (claimed_by is null or claimed_by = auth.uid())
  )
  with check (
    public.can_access_secret_space(event_id)
    and collective_gift_id is null
    and (claimed_by is null or claimed_by = auth.uid())
  );

-- ── « Via la cagnotte » ────────────────────────────────────────────────────
-- Une seule transaction : le cadeau collectif n'existe jamais sans le lien.
create or replace function public.move_gift_item_to_cagnotte(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.gift_items%rowtype;
  v_gift_id uuid;
begin
  select * into v_item from public.gift_items where id = p_item_id for update;

  if not found or not public.can_access_secret_space(v_item.event_id) then
    raise exception 'Idée cadeau introuvable' using errcode = '42501';
  end if;
  if v_item.claimed_by is not null or v_item.collective_gift_id is not null then
    raise exception 'Ce cadeau est déjà pris' using errcode = '55000';
  end if;

  insert into public.gifts (event_id, name, price, added_by, needs_contribution)
  values (v_item.event_id, v_item.label, v_item.price_estimate, v_item.added_by, true)
  returning id into v_gift_id;

  update public.gift_items set collective_gift_id = v_gift_id where id = p_item_id;
  return v_gift_id;
end;
$$;

revoke execute on function public.move_gift_item_to_cagnotte(uuid) from public, anon;
grant execute on function public.move_gift_item_to_cagnotte(uuid) to authenticated;

-- ── Suppression d'un cadeau collectif : coordinateurs seulement ────────────
-- can_manage_cagnotte = organisateur, co-organisateur approuvé ou guest_leader
-- approuvé, toujours dans l'espace secret (jamais la personne fêtée).
drop policy if exists "Espace secret : suppression de ses cadeaux" on public.gifts;
drop policy if exists "Espace secret : suppression cadeau par les coordinateurs" on public.gifts;
create policy "Espace secret : suppression cadeau par les coordinateurs"
  on public.gifts for delete to authenticated
  using (public.can_manage_cagnotte(event_id));
