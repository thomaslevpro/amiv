-- Rattrapage de birthdays.was_manual.
--
-- 20261102210000_friend_birthdays a converti en lignes automatiques les
-- anniversaires déjà liés à la main à un ami (linked_profile_id), mais
-- was_manual n'est apparu qu'avec 20261102220000, à false par défaut : ces
-- lignes auraient été supprimées à la fin de l'amitié au lieu de redevenir
-- manuelles.
--
-- Les lignes converties sont celles liées à un ami qui existaient avant
-- 20261102210000. En prod, la copie birthdays_backup_20261031 a été faite
-- juste avant : elle les identifie exactement. Sans cette copie (staging,
-- aucune amitié acceptée lors de la conversion), rien à rattraper.

do $$
begin
  if to_regclass('public.birthdays_backup_20261031') is not null then
    update public.birthdays b
       set was_manual = true
     where b.friend_user_id is not null
       and not b.was_manual
       and exists (select 1 from public.birthdays_backup_20261031 k where k.id = b.id);
  end if;
end;
$$;
