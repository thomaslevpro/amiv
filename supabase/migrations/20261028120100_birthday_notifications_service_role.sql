-- create_birthday_today_notifications n'est appelée que par l'edge function
-- birthday-today-reminders (service role, déclenchée par le cron). Elle était
-- exécutable par anon et authenticated.
-- generate_birthday_notifications n'est appelée nulle part (ni front, ni edge, ni cron).

revoke execute on function public.create_birthday_today_notifications() from public, anon, authenticated;
grant execute on function public.create_birthday_today_notifications() to service_role;

revoke execute on function public.generate_birthday_notifications() from public, anon, authenticated;
grant execute on function public.generate_birthday_notifications() to service_role;
