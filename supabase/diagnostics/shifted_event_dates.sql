-- Événements dont l'heure a été enregistrée décalée (lecture seule).
--
-- Avant le correctif de 20261102 (lib/eventDate.js), deux chemins enregistraient
-- l'heure saisie comme si c'était de l'heure UTC (+1 h l'hiver, +2 h l'été
-- à l'affichage) :
--   - « sondage »      : date confirmée depuis le sondage ;
--   - « modification » : date changée dans « Modifier l'événement ».
-- La création (Create.jsx) a toujours été correcte.
--
-- Repérage :
--   - sondage : events.date = (date + heure d'une option) lue en UTC, et
--     différente de la même option lue en heure de Paris → certain ;
--   - modification : events.date différente de la date donnée à la création
--     (activity 'event_created', gardée 12 mois), et pas une confirmation de
--     sondage correcte. Attention : une date modifiée APRÈS la mise en ligne
--     du correctif est juste mais ressort aussi → lancer avant la mise en
--     ligne, ou ignorer les lignes modifiées depuis.
--   - « sans trace » : pas de ligne activity (événement de plus de 12 mois ou
--     créé hors app) → impossible de savoir, listé pour information.
--
-- « date_corrigee_paris » = heure probable voulue, à vérifier avec
-- l'organisateur avant toute correction. Aucune modification ici.
--
--   supabase db query --linked -f supabase/diagnostics/shifted_event_dates.sql

begin transaction read only;

with created as (
  select distinct on (a.entity_id)
    a.entity_id as event_id,
    (a.data->>'event_date')::timestamptz as created_date
  from public.activity a
  where a.type = 'event_created'
    and a.entity_type = 'event'
  order by a.entity_id, a.created_at
),
options as (
  select o.event_id,
    (o.proposed_date + coalesce(o.proposed_time, time '00:00')) at time zone 'UTC' as as_utc,
    (o.proposed_date + coalesce(o.proposed_time, time '00:00')) at time zone 'Europe/Paris' as as_paris
  from public.event_date_options o
),
classified as (
  select
    e.id,
    e.name,
    e.date,
    e.created_at,
    case
      when e.poll_closed and exists (
        select 1 from options o where o.event_id = e.id and e.date = o.as_utc and e.date <> o.as_paris
      ) then 'sondage'
      when e.poll_closed and exists (
        select 1 from options o where o.event_id = e.id and e.date = o.as_paris
      ) then null
      when c.event_id is null then 'sans trace'
      when e.date is distinct from c.created_date then 'modification'
    end as cause
  from public.events e
  left join created c on c.event_id = e.id
  where e.date is not null
)
select
  cause,
  id,
  name,
  to_char(date at time zone 'Europe/Paris', 'YYYY-MM-DD HH24:MI') as affichee_paris,
  case when cause in ('sondage', 'modification')
    then to_char(date at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
  end as date_corrigee_paris,
  date >= now() as a_venir,
  to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM-DD') as creee_le
from classified
where cause is not null
order by cause, date;

commit;
