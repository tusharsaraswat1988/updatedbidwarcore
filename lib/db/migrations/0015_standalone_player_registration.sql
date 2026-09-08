-- Standalone Player Registration (sr_*) — Phase 1 foundation.
-- Fully isolated from BidWar players / tournaments / auction registration.
-- No FKs to existing BidWar registration tables.
-- Apply via psql / Neon SQL Editor BEFORE production deploy (expand-only).

-- ─── sr_tournaments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_tournaments (
  id serial PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  logo_url text,
  banner_url text,
  registration_title text NOT NULL,
  registration_description text,
  registration_fee integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  registration_deadline timestamptz,
  contact_name text,
  contact_mobile text,
  contact_email text,
  terms_and_conditions text,
  privacy_notice text,
  success_message text,
  payment_instructions text,
  registration_id_prefix text NOT NULL,
  next_registration_seq integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  allow_duplicate_registrations boolean NOT NULL DEFAULT false,
  require_declaration boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_tournaments_slug ON sr_tournaments (slug);
CREATE INDEX IF NOT EXISTS ix_sr_tournaments_is_active ON sr_tournaments (is_active);

-- ─── sr_form_fields ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_form_fields (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  section text NOT NULL DEFAULT 'personal',
  required boolean NOT NULL DEFAULT false,
  options_json jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sr_form_fields_tournament
    FOREIGN KEY (tournament_id) REFERENCES sr_tournaments(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_form_fields_tournament_key
  ON sr_form_fields (tournament_id, field_key);
CREATE INDEX IF NOT EXISTS ix_sr_form_fields_tournament_order
  ON sr_form_fields (tournament_id, sort_order);

-- ─── sr_categories ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_categories (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  min_age integer,
  max_age integer,
  gender text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sr_categories_tournament
    FOREIGN KEY (tournament_id) REFERENCES sr_tournaments(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_categories_tournament_code
  ON sr_categories (tournament_id, code);
CREATE INDEX IF NOT EXISTS ix_sr_categories_tournament ON sr_categories (tournament_id);

-- ─── sr_registrations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_registrations (
  id serial PRIMARY KEY,
  registration_id text NOT NULL,
  tournament_id integer NOT NULL,
  player_name text NOT NULL,
  parent_name text,
  date_of_birth text NOT NULL,
  calculated_age integer NOT NULL,
  gender text NOT NULL,
  mobile text NOT NULL,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  playing_role text NOT NULL,
  batting_style text,
  bowling_style text,
  cricket_experience text,
  previous_tournament_experience text,
  jersey_size text,
  preferred_jersey_number text,
  category_id integer,
  cricket_data_json jsonb,
  field_values_json jsonb,
  status text NOT NULL DEFAULT 'PAYMENT_PENDING',
  declaration_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sr_registrations_tournament
    FOREIGN KEY (tournament_id) REFERENCES sr_tournaments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sr_registrations_category
    FOREIGN KEY (category_id) REFERENCES sr_categories(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_registrations_registration_id
  ON sr_registrations (registration_id);
-- Duplicate protection: same mobile + same standalone tournament
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_registrations_tournament_mobile
  ON sr_registrations (tournament_id, mobile);
CREATE INDEX IF NOT EXISTS ix_sr_registrations_tournament_status
  ON sr_registrations (tournament_id, status);
CREATE INDEX IF NOT EXISTS ix_sr_registrations_email ON sr_registrations (email);
CREATE INDEX IF NOT EXISTS ix_sr_registrations_player_name ON sr_registrations (player_name);

-- ─── sr_payments (Phase 1 foundation only — no gateway integration yet) ──────
CREATE TABLE IF NOT EXISTS sr_payments (
  id serial PRIMARY KEY,
  registration_pk integer NOT NULL,
  registration_id text NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  order_id text,
  payment_id text,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'PENDING',
  gateway_metadata jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sr_payments_registration
    FOREIGN KEY (registration_pk) REFERENCES sr_registrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_sr_payments_registration_pk ON sr_payments (registration_pk);
CREATE INDEX IF NOT EXISTS ix_sr_payments_registration_id ON sr_payments (registration_id);
CREATE INDEX IF NOT EXISTS ix_sr_payments_status ON sr_payments (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_payments_order_id
  ON sr_payments (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_payments_payment_id
  ON sr_payments (payment_id) WHERE payment_id IS NOT NULL;

-- ─── sr_documents (metadata only — no public URLs for sensitive proofs) ──────
CREATE TABLE IF NOT EXISTS sr_documents (
  id serial PRIMARY KEY,
  registration_pk integer NOT NULL,
  document_type text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'pending',
  storage_key text,
  original_filename text,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  status text NOT NULL DEFAULT 'pending_upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sr_documents_registration
    FOREIGN KEY (registration_pk) REFERENCES sr_registrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_sr_documents_registration_pk ON sr_documents (registration_pk);
CREATE INDEX IF NOT EXISTS ix_sr_documents_type ON sr_documents (document_type);

-- ─── sr_audit_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_audit_logs (
  id bigserial PRIMARY KEY,
  tournament_id integer,
  registration_pk integer,
  registration_id text,
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  details_json jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sr_audit_tournament_time
  ON sr_audit_logs (tournament_id, created_at);
CREATE INDEX IF NOT EXISTS ix_sr_audit_registration
  ON sr_audit_logs (registration_pk, created_at);
CREATE INDEX IF NOT EXISTS ix_sr_audit_action
  ON sr_audit_logs (action, created_at);
