-- Organizer phone verification (2026-07-23).
-- Apply to Neon staging then production BEFORE deploying app code that requires these columns.
-- Idempotent additive only — no DROP/RENAME.

ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- Phase 1 grandfather: existing real Indian mobiles stay usable without re-OTP.
-- Placeholder mobiles (eml: / gid_) remain unverified and must complete profile after login.
UPDATE organizers
SET
  phone_verified = true,
  phone_verified_at = COALESCE(phone_verified_at, created_at, NOW())
WHERE phone_verified = false
  AND mobile !~ '^(eml:|gid_)'
  AND mobile ~ '^[6-9][0-9]{9}$';
