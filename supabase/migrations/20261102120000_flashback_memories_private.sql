-- Flashback : le contenu d'un souvenir (texte, emoji, image, couleur) n'est
-- lisible que par son auteur avant la révélation.
--
-- Avant : toute personne ayant accès à l'espace secret (organisateurs,
-- co-organisateurs, invités ayant accepté ou « peut-être ») lisait toutes les
-- lignes de collective_memories et toutes les images memory-images de
-- l'événement. La personne fêtée les lit à partir du jour de l'événement
-- (can_view_revealed_memories, inchangé).
--
-- Après :
--   - can_read_memory_content(event, auteur) est la seule règle de lecture
--     du contenu : l'auteur (s'il a accès à l'espace secret) ou la personne
--     fêtée révélée. C'est ici qu'il faudra brancher une révélation aux
--     invités.
--   - get_flashback_entries renvoie à tout membre de l'espace secret la liste
--     des souvenirs SANS contenu (id, auteur, date) : compteurs, « Qui a
--     contribué » et cartes masquées.
--   - Images : lisibles seulement si l'appelant peut lire une ligne de
--     collective_memories qui y renvoie (la sous-requête passe par la RLS
--     ci-dessus). Bucket privé, URLs signées.
--
-- memory_reactions : ses policies lisent collective_memories sous RLS, donc
-- ne portent plus que sur les souvenirs lisibles (aucun usage côté app).

-- ── Règle de lecture du contenu ────────────────────────────────────────────
create or replace function public.can_read_memory_content(p_event_id uuid, p_contributor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      (p_contributor_id = auth.uid() and public.can_access_secret_space(p_event_id))
      or public.can_view_revealed_memories(p_event_id)
    );
$$;

revoke all on function public.can_read_memory_content(uuid, uuid) from public, anon;
grant execute on function public.can_read_memory_content(uuid, uuid) to authenticated;

drop policy if exists "Espace secret : lecture souvenirs" on public.collective_memories;
drop policy if exists "Personne fêtée : souvenirs révélés" on public.collective_memories;
drop policy if exists "Flashback : lecture du contenu" on public.collective_memories;
create policy "Flashback : lecture du contenu"
  on public.collective_memories for select to authenticated
  using (public.can_read_memory_content(event_id, contributor_id));

-- La modification ne permet plus de déplacer un souvenir vers un événement
-- dont on n'a pas l'espace secret.
drop policy if exists "update own memory" on public.collective_memories;
create policy "update own memory"
  on public.collective_memories for update to authenticated
  using (contributor_id = auth.uid())
  with check (contributor_id = auth.uid() and public.can_access_secret_space(event_id));

revoke all on public.collective_memories from anon;

-- ── Liste sans contenu ─────────────────────────────────────────────────────
create or replace function public.get_flashback_entries(p_event_id uuid)
returns table(id uuid, contributor_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.contributor_id, m.created_at
  from public.collective_memories m
  where m.event_id = p_event_id
    and (public.can_access_secret_space(p_event_id) or public.can_view_revealed_memories(p_event_id))
  order by m.created_at desc, m.id;
$$;

revoke all on function public.get_flashback_entries(uuid) from public, anon;
grant execute on function public.get_flashback_entries(uuid) to authenticated;

-- ── Bucket memory-images ───────────────────────────────────────────────────
-- Recréé ici à l'identique s'il manque (staging), toujours privé.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-images', 'memory-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do update set public = false;

drop policy if exists "Souvenirs : envoi d'image" on storage.objects;
create policy "Souvenirs : envoi d'image"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memory-images'
    and split_part(name, '/', 2) = auth.uid()::text
    and public.can_access_secret_space(public.memory_image_event_id(name))
  );

-- Même visibilité que la ligne du souvenir : un invité ne peut ni lister ni
-- signer l'image d'un autre.
drop policy if exists "Souvenirs : lecture d'image" on storage.objects;
create policy "Souvenirs : lecture d'image"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memory-images'
    and exists (
      select 1 from public.collective_memories m
      where m.image_url = objects.name
    )
  );

drop policy if exists "Souvenirs : suppression de son image" on storage.objects;
create policy "Souvenirs : suppression de son image"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memory-images' and split_part(name, '/', 2) = auth.uid()::text);
