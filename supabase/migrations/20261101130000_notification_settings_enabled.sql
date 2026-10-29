-- Réglages de notification activés pour tout le monde.
--
--   notif_birthdays, notif_invitations, notif_messages : les valeurs
--   « désactivé » actuelles viennent d'anciennes valeurs par défaut, pas
--   d'un choix des utilisateurs ; on les remet toutes à true. Ensuite
--   chacun reste libre de les couper depuis son profil.
--
--   Nouveaux comptes : handle_new_user ne renseigne pas ces colonnes, la
--   valeur par défaut (true) s'applique. NOT NULL empêche une valeur vide
--   qui serait lue différemment selon l'endroit.

update public.profiles
set notif_birthdays = true,
    notif_invitations = true,
    notif_messages = true
where notif_birthdays is not true
   or notif_invitations is not true
   or notif_messages is not true;

alter table public.profiles
  alter column notif_birthdays set default true,
  alter column notif_birthdays set not null,
  alter column notif_invitations set default true,
  alter column notif_invitations set not null,
  alter column notif_messages set default true,
  alter column notif_messages set not null;
