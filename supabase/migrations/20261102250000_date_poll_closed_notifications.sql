-- Sondage de dates clos : les notifications qui parlent encore du sondage
-- sont mises à jour pour tous les invités.
--
-- Quand l'organisateur choisit la date (events.poll_closed passe à true) :
--   - « Un sondage attend ta réponse » (poll_reminder) non lu → lu ;
--   - « Tu es invité(e) à … » (event_invitation) non lu, dont le texte disait
--     « Vote pour tes disponibilités » → même texte qu'un événement daté
--     (l'invitation reste à accepter ou décliner).
-- send_poll_reminders ignore déjà les sondages clos (aucun nouveau rappel).

create or replace function public.on_date_poll_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set read = true
   where type = 'poll_reminder'
     and read = false
     and data->>'event_id' = new.id::text;

  update public.notifications
     set body = 'Réponds à l’invitation sur Amiv'
   where type = 'event_invitation'
     and read = false
     and body = 'Vote pour tes disponibilités sur Amiv'
     and data->>'event_id' = new.id::text;

  return new;
end;
$$;

revoke execute on function public.on_date_poll_closed() from public, anon, authenticated;

drop trigger if exists trg_on_date_poll_closed on public.events;
create trigger trg_on_date_poll_closed
  after update of poll_closed on public.events
  for each row
  when (new.poll_closed and not coalesce(old.poll_closed, false))
  execute function public.on_date_poll_closed();

-- Rattrapage : sondages déjà clos.
update public.notifications n
   set read = true
  from public.events e
 where n.type = 'poll_reminder'
   and n.read = false
   and e.poll_closed
   and n.data->>'event_id' = e.id::text;

update public.notifications n
   set body = 'Réponds à l’invitation sur Amiv'
  from public.events e
 where n.type = 'event_invitation'
   and n.read = false
   and n.body = 'Vote pour tes disponibilités sur Amiv'
   and e.poll_closed
   and n.data->>'event_id' = e.id::text;
