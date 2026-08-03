-- P0.2 Tournament Engine — additive category/group config (backward compatible)

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS current_stage TEXT;

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS ranking_rules_json JSONB;

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS qualifiers_per_group SMALLINT;

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS qualifier_mode TEXT;

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS promoted_knockout_at TIMESTAMPTZ;

ALTER TABLE badminton_groups
  ADD COLUMN IF NOT EXISTS qualifiers_count SMALLINT;

-- Existing categories keep null ranking_rules_json → legacy comparator at runtime.
-- New categories receive product-default ranking rules on INSERT via API.
