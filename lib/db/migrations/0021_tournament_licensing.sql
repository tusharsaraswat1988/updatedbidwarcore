-- Tournament licensing requests and admin notification resolution tracking
-- Additive, zero-data-mutation schema for module licensing workflows.

ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolution_status text NOT NULL DEFAULT 'pending';
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS action_metadata jsonb;
CREATE INDEX IF NOT EXISTS ix_admin_notifications_resolution_status ON admin_notifications (resolution_status);

CREATE TABLE IF NOT EXISTS tournament_license_requests (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  requested_modules TEXT NOT NULL DEFAULT 'auction',
  status TEXT NOT NULL DEFAULT 'pending',
  organizer_mobile TEXT,
  notes TEXT,
  payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payment_amount INTEGER,
  payment_mode TEXT,
  payment_ref TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_tournament_id ON tournament_license_requests (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_organizer_id ON tournament_license_requests (organizer_id);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_status ON tournament_license_requests (status);
