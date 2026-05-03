ALTER TABLE birthdays
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- Migrate existing data: first word → first_name, rest → last_name
UPDATE birthdays
SET
  first_name = split_part(name, ' ', 1),
  last_name  = NULLIF(trim(substring(name FROM position(' ' IN name) + 1)), '')
WHERE first_name IS NULL;
