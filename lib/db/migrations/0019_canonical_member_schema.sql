-- Phase 5C: Canonical Member Identity Schema Introduction
-- Additive, zero-data-mutation schema foundation for canonical Member identity.
-- All tables created empty; no historical data is migrated or modified.

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  primary_mobile TEXT,
  primary_email TEXT,
  is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  dob TEXT,
  gender TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  avatar_url TEXT,
  avatar_public_id TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_members_display_name ON members (display_name);
CREATE INDEX IF NOT EXISTS ix_members_primary_mobile ON members (primary_mobile);
CREATE INDEX IF NOT EXISTS ix_members_primary_email ON members (primary_email);
CREATE INDEX IF NOT EXISTS ix_members_account_status ON members (account_status);

CREATE TABLE IF NOT EXISTS member_roles (
  id SERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES scoring_matches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_member_roles_member_id ON member_roles (member_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_role ON member_roles (role);
CREATE INDEX IF NOT EXISTS ix_member_roles_scope ON member_roles (scope);
CREATE INDEX IF NOT EXISTS ix_member_roles_tournament_id ON member_roles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_team_id ON member_roles (team_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_match_id ON member_roles (match_id);

CREATE TABLE IF NOT EXISTS member_sport_profiles (
  id SERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sport_slug TEXT NOT NULL,
  primary_role TEXT,
  secondary_role TEXT,
  handedness TEXT,
  federation_code TEXT,
  profile_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_msp_member_sport ON member_sport_profiles (member_id, sport_slug);
CREATE INDEX IF NOT EXISTS ix_msp_member_id ON member_sport_profiles (member_id);
CREATE INDEX IF NOT EXISTS ix_msp_sport_slug ON member_sport_profiles (sport_slug);

CREATE TABLE IF NOT EXISTS tournament_participations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'active',
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  category_id INTEGER,
  display_name_override TEXT,
  initials TEXT,
  jersey_number TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tp_tournament_member_role ON tournament_participations (tournament_id, member_id, role);
CREATE INDEX IF NOT EXISTS ix_tp_tournament_id ON tournament_participations (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tp_member_id ON tournament_participations (member_id);
CREATE INDEX IF NOT EXISTS ix_tp_team_id ON tournament_participations (team_id);
CREATE INDEX IF NOT EXISTS ix_tp_role ON tournament_participations (role);
CREATE INDEX IF NOT EXISTS ix_tp_status ON tournament_participations (status);

CREATE TABLE IF NOT EXISTS member_identity_links (
  id SERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'direct_fk',
  confidence_score INTEGER NOT NULL DEFAULT 100,
  provenance_json JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mil_source_record_member ON member_identity_links (source_table, source_record_id, member_id);
CREATE INDEX IF NOT EXISTS ix_mil_member_id ON member_identity_links (member_id);
CREATE INDEX IF NOT EXISTS ix_mil_source ON member_identity_links (source_table, source_record_id);
CREATE INDEX IF NOT EXISTS ix_mil_status ON member_identity_links (status);
