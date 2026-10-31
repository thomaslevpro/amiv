-- Points du calendrier : jour de l'événement en heure de Paris.
--
-- Avant : e.date::date prenait le jour en UTC (fuseau de la session), donc un
-- événement entre minuit et 1 h (hiver) ou 2 h (été), heure de Paris, avait
-- son point la veille. Même règle que memories_revealed / reveal_due_memories.
-- search_path fixé au passage (fonction security definer).

create or replace function public.get_calendar_dots(month_start date, month_end date)
returns table(event_date date, dot_type text)
language sql
stable
security definer
set search_path = public
as $$
  select (e.date at time zone 'Europe/Paris')::date, 'invited'
  from public.events e
  join public.rsvps r on r.event_id = e.id
  where r.user_id = auth.uid()
    and e.user_id <> auth.uid()
    and (e.date at time zone 'Europe/Paris')::date between month_start and month_end

  union all

  select (e.date at time zone 'Europe/Paris')::date, 'own'
  from public.events e
  where e.user_id = auth.uid()
    and (e.date at time zone 'Europe/Paris')::date between month_start and month_end;
$$;

revoke all on function public.get_calendar_dots(date, date) from public, anon;
grant execute on function public.get_calendar_dots(date, date) to authenticated;
