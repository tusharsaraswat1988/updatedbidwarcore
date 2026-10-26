-- Slot range and status checks for sponsor / promo media.
-- Idempotent. Does not touch scoring tables.

ALTER TABLE cricket_sponsor_media_slots
  DROP CONSTRAINT IF EXISTS chk_cricket_sponsor_media_slot_number;
ALTER TABLE cricket_sponsor_media_slots
  ADD CONSTRAINT chk_cricket_sponsor_media_slot_number
  CHECK (slot_number BETWEEN 1 AND 4);

ALTER TABLE cricket_sponsor_media_slots
  DROP CONSTRAINT IF EXISTS chk_cricket_sponsor_media_status;
ALTER TABLE cricket_sponsor_media_slots
  ADD CONSTRAINT chk_cricket_sponsor_media_status
  CHECK (processing_status IN ('empty', 'uploading', 'processing', 'ready', 'failed', 'disabled'));

ALTER TABLE cricket_sponsor_media_slots
  DROP CONSTRAINT IF EXISTS chk_cricket_sponsor_media_version;
ALTER TABLE cricket_sponsor_media_slots
  ADD CONSTRAINT chk_cricket_sponsor_media_version
  CHECK (version >= 0);
