-- Flashback : l'auteur supprime ou remplace son souvenir, jusqu'à la
-- révélation. Indépendante de 20261102120000 (contenu réservé à l'auteur) :
-- les deux peuvent être déployées ensemble ou séparément.
--
-- Révélation : memories_revealed(event) = jour de l'événement atteint
-- (Europe/Paris) pour un anniversaire avec personne fêtée. C'est la date
-- utilisée par can_view_revealed_memories (et donc can_read_memory_content),
-- réécrite ici pour s'appuyer dessus, sans changer son résultat.
--
-- Suppression : l'auteur seulement, avant la révélation. Personne d'autre,
-- organisateurs compris (les suppressions en cascade d'un événement ou d'un
-- compte ne passent pas par la RLS).
--
-- Modification : même règle que la suppression (auteur, avant la révélation).
-- La policy reprend la condition de 20261102120000 (pas de déplacement vers
-- un événement sans accès à l'espace secret) et y ajoute memories_revealed.
--
-- Remplacement : replace_flashback_memory insère le nouveau souvenir puis
-- supprime l'ancien dans la même transaction, avec les droits de l'appelant
-- (mêmes policies). Le message système de l'ancien disparaît du chat Secret
-- (trigger secret_activity_message), le nouveau en ajoute un.
--
-- Images : un souvenir supprimé, ou dont l'image change, met son fichier
-- memory-images dans storage_deletion_queue (purge-storage l'efface via l'API
-- Storage, appel immédiat puis cron de rattrapage), sauf si un autre souvenir
-- y renvoie encore. image_url ne peut désormais pointer que vers le dossier
-- de l'auteur pour cet événement (ou une URL http) : on ne peut ni lire ni
-- faire effacer le fichier d'un autre en le référençant.
--
-- Pas de limite de souvenirs par personne (aucune contrainte, inchangé).

-- ── Révélation ─────────────────────────────────────────────────────────────
create or replace function public.memories_revealed(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.birthday_person_user_id is not null
      and e.date is not null
      and (e.date at time zone 'Europe/Paris')::date <= (now() at time zone 'Europe/Paris')::date
  );
$$;

revoke all on function public.memories_revealed(uuid) from public, anon;
grant execute on function public.memories_revealed(uuid) to authenticated;

create or replace function public.can_view_revealed_memories(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.birthday_person_user_id = auth.uid()
    )
    and public.memories_revealed(p_event_id);
$$;

-- ── Suppression ────────────────────────────────────────────────────────────
drop policy if exists "delete own memory" on public.collective_memories;
drop policy if exists "Flashback : suppression par l'auteur" on public.collective_memories;
create policy "Flashback : suppression par l'auteur"
  on public.collective_memories for delete to authenticated
  using (contributor_id = auth.uid() and not public.memories_revealed(event_id));

-- ── Modification ───────────────────────────────────────────────────────────
drop policy if exists "update own memory" on public.collective_memories;
create policy "update own memory"
  on public.collective_memories for update to authenticated
  using (contributor_id = auth.uid() and not public.memories_revealed(event_id))
  with check (
    contributor_id = auth.uid()
    and public.can_access_secret_space(event_id)
    and not public.memories_revealed(event_id)
  );

-- ── Chemin des images ──────────────────────────────────────────────────────
-- not valid : les lignes existantes ne sont pas revérifiées.
alter table public.collective_memories drop constraint if exists collective_memories_image_url_owner;
alter table public.collective_memories add constraint collective_memories_image_url_owner check (
  image_url is null
  or image_url ~* '^https?://'
  or (split_part(image_url, '/', 1) = event_id::text and split_part(image_url, '/', 2) = contributor_id::text)
) not valid;

-- ── Nettoyage des images ───────────────────────────────────────────────────
create or replace function public.enqueue_memory_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.image_url is not null
    and old.image_url !~* '^https?://'
    and split_part(old.image_url, '/', 2) = old.contributor_id::text
    and (tg_op = 'DELETE' or new.image_url is distinct from old.image_url)
    and not exists (
      select 1 from public.collective_memories m
      where m.image_url = old.image_url and m.id <> old.id
    )
  then
    insert into public.storage_deletion_queue (bucket_id, name)
    values ('memory-images', old.image_url)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

revoke all on function public.enqueue_memory_image() from public, anon, authenticated;

drop trigger if exists trg_enqueue_memory_image on public.collective_memories;
create trigger trg_enqueue_memory_image
  after delete or update of image_url on public.collective_memories
  for each row execute function public.enqueue_memory_image();

drop trigger if exists trg_request_storage_purge on public.collective_memories;
create trigger trg_request_storage_purge
  after delete or update of image_url on public.collective_memories
  for each statement execute function public.request_storage_purge_after_delete();

-- ── Remplacement ───────────────────────────────────────────────────────────
create or replace function public.replace_flashback_memory(
  p_memory_id uuid,
  p_text text,
  p_emoji text,
  p_image_url text,
  p_bg_color text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.collective_memories%rowtype;
  v_new_id uuid;
begin
  select * into v_old
  from public.collective_memories
  where id = p_memory_id and contributor_id = auth.uid();
  if not found then
    raise exception 'souvenir introuvable' using errcode = 'P0002';
  end if;

  if nullif(trim(p_text), '') is null and nullif(trim(p_emoji), '') is null and nullif(trim(p_image_url), '') is null then
    raise exception 'souvenir vide' using errcode = '22023';
  end if;

  insert into public.collective_memories (card_id, event_id, contributor_id, text, emoji, image_url, bg_color)
  values (v_old.card_id, v_old.event_id, auth.uid(), nullif(trim(p_text), ''), nullif(trim(p_emoji), ''),
          nullif(trim(p_image_url), ''), coalesce(nullif(trim(p_bg_color), ''), '#fbeaf0'))
  returning id into v_new_id;

  -- Refusée par la RLS après la révélation : tout est annulé.
  delete from public.collective_memories where id = p_memory_id;
  if not found then
    raise exception 'souvenir verrouillé' using errcode = '42501';
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.replace_flashback_memory(uuid, text, text, text, text) from public, anon;
grant execute on function public.replace_flashback_memory(uuid, text, text, text, text) to authenticated;
