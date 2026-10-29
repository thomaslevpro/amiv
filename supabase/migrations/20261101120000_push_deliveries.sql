-- Une notification ne part en push qu'une seule fois : send-push insère
-- sa ligne ici avant d'appeler APNs ; une deuxième insertion échoue
-- (clé primaire) et l'appel est refusé. Table serveur uniquement (RLS sans
-- policy, aucun droit pour anon / authenticated) : un utilisateur ne peut
-- ni marquer ni « dé-marquer » une notification comme envoyée.
-- Supprimée en cascade avec la notification (rétention 6 mois).

create table if not exists public.push_deliveries (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.push_deliveries enable row level security;

revoke all on public.push_deliveries from anon, authenticated;
grant select, insert, delete on public.push_deliveries to service_role;
