-- Phase 5E: Canonical Member Authentication & Capability Migration
-- Additive, zero-data-mutation schema for Member Authentication & Sessions.
-- Coexists safely with legacy authentication without mutating historical data.

CREATE TABLE IF NOT EXISTS member_auth_identities (
  id SERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT,
  normalized_identifier TEXT,
  password_hash TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mai_provider_subject ON member_auth_identities (provider, provider_subject);
CREATE INDEX IF NOT EXISTS ix_mai_member_id ON member_auth_identities (member_id);
CREATE INDEX IF NOT EXISTS ix_mai_identifier ON member_auth_identities (normalized_identifier);
CREATE INDEX IF NOT EXISTS ix_mai_provider_identifier ON member_auth_identities (provider, normalized_identifier);

CREATE TABLE IF NOT EXISTS member_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  auth_identity_id INTEGER REFERENCES member_auth_identities(id) ON DELETE CASCADE,
  token_hash TEXT,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ms_member_id ON member_sessions (member_id);
CREATE INDEX IF NOT EXISTS ix_ms_expires_at ON member_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_ms_revoked_at ON member_sessions (revoked_at);
