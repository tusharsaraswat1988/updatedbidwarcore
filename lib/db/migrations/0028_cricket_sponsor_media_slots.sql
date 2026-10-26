-- Cricket sponsor / promo media slots.
-- Additive. Does not touch scoring tables.

CREATE TABLE IF NOT EXISTS cricket_sponsor_media_slots (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  asset_type text,
  original_url text,
  original_public_id text,
  broadcast_url text,
  broadcast_public_id text,
  poster_url text,
  duration_ms integer NOT NULL DEFAULT 10000,
  file_size_bytes integer,
  original_file_size_bytes integer,
  mime_type text,
  width integer,
  height integer,
  has_audio boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'empty',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 0,
  checksum text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cricket_sponsor_media_slots_tournament_slot
  ON cricket_sponsor_media_slots (tournament_id, slot_number);

CREATE INDEX IF NOT EXISTS ix_cricket_sponsor_media_slots_tournament_id
  ON cricket_sponsor_media_slots (tournament_id);
