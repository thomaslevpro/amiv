-- Relance par email des invités sans compte Amiv (send-email, action
-- invitation_reminder). reminder_emailed_at limite l'envoi à un email par
-- invitation toutes les 12 heures, même si l'organisateur relance plus
-- souvent : l'adresse appartient à quelqu'un qui n'a pas de compte et ne
-- peut pas se désinscrire depuis l'app. Écrite uniquement par la fonction
-- (service role).

alter table public.invitations add column if not exists reminder_emailed_at timestamptz;

revoke update (reminder_emailed_at) on public.invitations from anon, authenticated;
