-- Add onboarding tracking columns to profiles
alter table profiles
  add column if not exists first_name       text,
  add column if not exists birthday         date,
  add column if not exists onboarding_step  smallint not null default 0,
  add column if not exists onboarding_completed boolean not null default false;

-- Existing users who already set their name are considered onboarded
update profiles
set onboarding_completed = true, onboarding_step = 5
where name is not null and name <> '';
