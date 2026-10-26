-- Migration: 0026_bpl_edition_sponsors.sql
-- BidWar Premier League (BPL) Edition Sponsors

CREATE TABLE IF NOT EXISTS bpl_edition_sponsors (
  id serial PRIMARY KEY,
  edition_id integer NOT NULL REFERENCES bpl_editions(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  category text NOT NULL DEFAULT 'PARTNER',
  website_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_edition_id ON bpl_edition_sponsors (edition_id);
CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_order ON bpl_edition_sponsors (edition_id, display_order);
