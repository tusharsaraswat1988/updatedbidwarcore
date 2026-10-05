-- Migration: 0025_bpl_editions.sql
-- BidWar Premier League (BPL) edition foundation

CREATE TABLE IF NOT EXISTS bpl_editions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  edition_number integer NOT NULL,
  slug text NOT NULL,
  year integer NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  venue text,
  city text,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',
  linked_tournament_id integer REFERENCES tournaments(id) ON DELETE SET NULL,
  live_stream_url text,
  fan_page_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_edition_number ON bpl_editions (edition_number);
CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_slug ON bpl_editions (slug);
CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_single_live ON bpl_editions (status) WHERE status = 'LIVE';
CREATE INDEX IF NOT EXISTS ix_bpl_editions_linked_tournament_id ON bpl_editions (linked_tournament_id);
