-- budget_total était une colonne d'events, lisible par tous les invités,
-- personne fêtée comprise. Le budget passe dans event_budgets (1 ligne par
-- événement), réservée aux organisateurs hors personne fêtée
-- (is_event_planner), puis la colonne est supprimée.

create table if not exists public.event_budgets (
  event_id uuid primary key references public.events(id) on delete cascade,
  total numeric not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);

insert into public.event_budgets (event_id, total)
select e.id, greatest(e.budget_total, 0)
from public.events e
where coalesce(e.budget_total, 0) <> 0
on conflict (event_id) do nothing;

drop trigger if exists event_budgets_set_updated_at on public.event_budgets;
create trigger event_budgets_set_updated_at
  before update on public.event_budgets
  for each row execute function public.set_updated_at();

alter table public.event_budgets enable row level security;

revoke all on public.event_budgets from anon, authenticated;
grant select, delete on public.event_budgets to authenticated;
grant insert (event_id, total) on public.event_budgets to authenticated;
grant update (total) on public.event_budgets to authenticated;

drop policy if exists "Organisateurs : budget" on public.event_budgets;
create policy "Organisateurs : budget"
  on public.event_budgets for all to authenticated
  using (public.is_event_planner(event_id))
  with check (public.is_event_planner(event_id));

alter table public.events drop column if exists budget_total;
