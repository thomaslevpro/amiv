-- Rappels d'anniversaire coupés : réactivés.
--
-- L'interrupteur qui coupait le rappel (reminder_enabled) n'existe plus dans
-- l'app : la fiche affiche « Rappel le jour J : Actif » et les jours J-1 à
-- J-14, mais create_birthday_today_notifications n'envoie rien pour une ligne
-- à false. Ces lignes ne pouvaient plus être réactivées (l'app ne repasse à
-- true qu'en enregistrant des jours de rappel, depuis cette version).
--
-- Seule reminder_enabled change : les triggers de birthdays ne réagissent pas
-- à cette colonne (guard_friend_birthday laisse la ligne telle quelle hors
-- rôle authenticated).

update public.birthdays
set reminder_enabled = true
where reminder_enabled = false;
