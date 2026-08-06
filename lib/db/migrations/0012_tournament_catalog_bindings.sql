-- EPIC-01: Platform Tournament Creation — catalog binding columns (additive, nullable).
-- Tournament stores references only. Rule/Presentation definitions stay in CatalogRegistry.

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS variant_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS competition_type_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_version text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_version text;
