-- Court-level scorer assignment (Match PIN still overrides when set).
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_pin TEXT;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_name TEXT;
