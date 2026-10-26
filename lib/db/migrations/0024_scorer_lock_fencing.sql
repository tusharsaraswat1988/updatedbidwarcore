-- Scorer Match Lock Lease Fencing & Expiry
-- Add lease_id, lease_version, expires_at to scorer_match_locks

ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_id TEXT;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill any existing rows
UPDATE scorer_match_locks SET lease_id = gen_random_uuid()::text WHERE lease_id IS NULL;
UPDATE scorer_match_locks SET expires_at = last_heartbeat_at + INTERVAL '180 seconds' WHERE expires_at IS NULL;

ALTER TABLE scorer_match_locks ALTER COLUMN lease_id SET NOT NULL;
ALTER TABLE scorer_match_locks ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_lease_id ON scorer_match_locks (lease_id);
