ALTER TABLE birthdays
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;
