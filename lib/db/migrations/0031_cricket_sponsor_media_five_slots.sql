-- Auction OBS plays the same sponsor spots as cricket, with a fifth slot.
-- Idempotent. Does not touch scoring tables.

ALTER TABLE cricket_sponsor_media_slots
  DROP CONSTRAINT IF EXISTS chk_cricket_sponsor_media_slot_number;
ALTER TABLE cricket_sponsor_media_slots
  ADD CONSTRAINT chk_cricket_sponsor_media_slot_number
  CHECK (slot_number BETWEEN 1 AND 5);
