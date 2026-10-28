-- La cagnotte (lien, objectif, cadeau associé) vivait dans events, que la
-- personne fêtée peut lire dès qu'elle est invitée : la surprise fuitait.
-- Elle passe dans event_cagnottes (1 ligne par événement) :
--   lecture  : can_access_secret_space(event_id), donc jamais la personne fêtée ;
--   écriture : organisateurs (owner + co-organisateurs approuvés), et jamais la
--              personne fêtée même si elle est co-organisatrice.
-- created_by est rempli par défaut avec auth.uid() et n'est pas modifiable par
-- le client (droits par colonne). Les colonnes events.cagnotte_* sont
-- supprimées dans une migration séparée.

create table if not exists public.event_cagnottes (
  event_id uuid primary key references public.events(id) on delete cascade,
  url text not null check (url ~* '^https?://'),
  goal numeric check (goal is null or goal >= 0),
  gift_id uuid references public.gifts(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reprise des données existantes. Un lien sans schéma reçoit https:// pour
-- respecter la contrainte ; une ligne sans lien n'a rien d'utilisable.
insert into public.event_cagnottes (event_id, url, goal, gift_id, created_by)
select e.id,
       case when trim(e.cagnotte_url) ~* '^https?://' then trim(e.cagnotte_url)
            else 'https://' || trim(e.cagnotte_url) end,
       e.cagnotte_goal,
       case when exists (select 1 from public.gifts g where g.id = e.cagnotte_gift_id and g.event_id = e.id)
            then e.cagnotte_gift_id end,
       case when exists (select 1 from auth.users u where u.id = e.cagnotte_created_by)
            then e.cagnotte_created_by end
from public.events e
where nullif(trim(e.cagnotte_url), '') is not null
on conflict (event_id) do nothing;

drop trigger if exists event_cagnottes_set_updated_at on public.event_cagnottes;
create trigger event_cagnottes_set_updated_at
  before update on public.event_cagnottes
  for each row execute function public.set_updated_at();

alter table public.event_cagnottes enable row level security;

revoke all on public.event_cagnottes from anon, authenticated;
grant select, delete on public.event_cagnottes to authenticated;
grant insert (event_id, url, goal, gift_id) on public.event_cagnottes to authenticated;
grant update (url, goal, gift_id) on public.event_cagnottes to authenticated;

drop policy if exists "Espace secret : lecture cagnotte" on public.event_cagnottes;
create policy "Espace secret : lecture cagnotte"
  on public.event_cagnottes for select to authenticated
  using (public.can_access_secret_space(event_id));

drop policy if exists "Organisateurs : création cagnotte" on public.event_cagnottes;
create policy "Organisateurs : création cagnotte"
  on public.event_cagnottes for insert to authenticated
  with check (
    public.is_event_organizer(event_id)
    and public.can_access_secret_space(event_id)
    and (gift_id is null or exists (
      select 1 from public.gifts g where g.id = gift_id and g.event_id = event_cagnottes.event_id
    ))
  );

drop policy if exists "Organisateurs : modification cagnotte" on public.event_cagnottes;
create policy "Organisateurs : modification cagnotte"
  on public.event_cagnottes for update to authenticated
  using (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id))
  with check (
    public.is_event_organizer(event_id)
    and public.can_access_secret_space(event_id)
    and (gift_id is null or exists (
      select 1 from public.gifts g where g.id = gift_id and g.event_id = event_cagnottes.event_id
    ))
  );

drop policy if exists "Organisateurs : suppression cagnotte" on public.event_cagnottes;
create policy "Organisateurs : suppression cagnotte"
  on public.event_cagnottes for delete to authenticated
  using (public.is_event_organizer(event_id) and public.can_access_secret_space(event_id));
