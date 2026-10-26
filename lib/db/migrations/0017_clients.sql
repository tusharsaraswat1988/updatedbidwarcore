-- Clients table: Brand logos, company names, and auction partners
-- Supports 'brand' and 'organisation' classifications with optional website links

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_public_id TEXT,
  website_url TEXT,
  client_type TEXT NOT NULL DEFAULT 'brand',
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_clients_active ON clients (active);
CREATE INDEX IF NOT EXISTS ix_clients_display_order ON clients (display_order);

-- Seed initial 8 clients if table is empty
INSERT INTO clients (name, client_type, display_order, active)
SELECT seed.name, seed.client_type, seed.display_order, true
FROM (
  VALUES
    ('Vyapari Network', 'brand', 0),
    ('Rotary Shine', 'organisation', 1),
    ('SJMAA (St. John''s Marhauli Alumni Association)', 'organisation', 2),
    ('Lions Diamond Varanasi', 'organisation', 3),
    ('Heritage Hospitals', 'brand', 4),
    ('Good Morning', 'brand', 5),
    ('Live VNS Studio', 'brand', 6),
    ('KV Tech Media', 'brand', 7)
) AS seed(name, client_type, display_order)
WHERE NOT EXISTS (SELECT 1 FROM clients LIMIT 1);
