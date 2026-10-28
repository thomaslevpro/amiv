-- Checklist par défaut des anniversaires.
-- 1. trigger_create_checklist testait type = 'birthday', valeur que l'app n'écrit
--    jamais (le type est 'Anniversaire') : aucune checklist n'a jamais été créée.
-- 2. create_default_checklist insérait 7 tâches sans catégorie, différentes des
--    suggestions de l'espace organisateur : elle insère désormais les mêmes tâches
--    que SUGGESTIONS.birthday (OrganizerSpacePage), avec leur catégorie, créées
--    au nom du propriétaire de l'événement.
-- 3. Les deux fonctions sont SECURITY DEFINER sans search_path fixé, et
--    create_default_checklist était exécutable par anon / authenticated : n'importe
--    qui pouvait ajouter des tâches à la checklist de n'importe quel événement.
--    Le trigger n'a pas besoin de ces droits (EXECUTE n'est vérifié qu'à la création
--    du trigger, et la fonction appelée tourne avec les droits de son propriétaire).
--
-- Le trigger reste AFTER INSERT uniquement : passer un événement existant en
-- Anniversaire ne crée pas de tâches (l'espace organisateur propose les suggestions
-- quand la checklist est vide).

create or replace function public.create_default_checklist(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.checklist_items (event_id, label, category, position, done, created_by)
  select p_event_id, t.label, t.category, t.position, false, e.user_id
  from public.events e
  cross join (values
    ('Réserver le lieu', 'logistics', 0),
    ('Commander le gâteau', 'food', 1),
    ('Créer les invitations', 'logistics', 2),
    ('Prévoir la playlist', 'other', 3),
    ('Acheter les décorations', 'decoration', 4)
  ) as t(label, category, position)
  where e.id = p_event_id;
$$;

create or replace function public.trigger_create_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'Anniversaire' then
    perform public.create_default_checklist(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.create_default_checklist(uuid) from public, anon, authenticated;
revoke execute on function public.trigger_create_checklist() from public, anon, authenticated;
