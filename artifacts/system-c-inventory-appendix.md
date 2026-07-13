### Batch 1 — line ~56

- **Purpose:** Ensure teams.owner_photo_url for team branding
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text` |

### Batch 2 — line ~61

- **Purpose:** Ensure branding_settings.main_logo_reverse_url
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS main_logo_reverse_url text` |

### Batch 3 — line ~66

- **Purpose:** Ensure branding_assets table + unique active asset index
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 2

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS branding_assets ( id SERIAL PRIMARY KEY, asset_type TEXT NOT NULL, file_u...` |
| 2 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS branding_assets_asset_type_active_idx ON branding_assets (asset_ty...` |

### Batch 4 — line ~88

- **Purpose:** Ensure players.email
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS email text` |

### Batch 5 — line ~93

- **Purpose:** Ensure players.gender
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS gender text` |

### Batch 6 — line ~98

- **Purpose:** Ensure players.jersey_size
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_size text` |

### Batch 7 — line ~103

- **Purpose:** Ensure teams.owner_email
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text` |

### Batch 8 — line ~108

- **Purpose:** Registration payment + declaration + bid-value tournament/player columns
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 17

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_payment boolean NOT NULL DEFAUL...` |
| 2 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_fee integer` |
| 3 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS upi_id text` |
| 4 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_verification_method text` |
| 5 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_collection_mode text NOT NULL DEFAULT 'manu...` |
| 6 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS registration_payment_status text` |
| 7 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS utr_number text` |
| 8 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_screenshot_url text` |
| 9 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz` |
| 10 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_declaration boolean NOT NULL DE...` |
| 11 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_declaration_text text` |
| 12 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_mode text NOT NULL DEFAULT 'system'` |
| 13 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_options text` |
| 14 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auto_approve_withdrawn_re_registration boolean NOT ...` |
| 15 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_bid_value integer` |
| 16 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS bid_value_source text` |
| 17 | ALTER_TABLE | True | `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_fields_json jsonb` |

### Batch 9 — line ~132

- **Purpose:** players.serial_no backfill + unique (tournament_id, serial_no)
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 5

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE players ADD COLUMN IF NOT EXISTS serial_no integer; WITH ranked AS ( SELECT id, ROW_NUMB...` |
| 2 | DML | False | `UPDATE players p SET serial_no = ranked.rn FROM ranked WHERE p.id = ranked.id` |
| 3 | DML | False | `UPDATE players SET serial_no = id WHERE serial_no IS NULL` |
| 4 | ALTER_TABLE | False | `ALTER TABLE players ALTER COLUMN serial_no SET NOT NULL` |
| 5 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_players_tournament_serial_no ON players (tournament_id, serial_...` |

### Batch 10 — line ~158

- **Purpose:** player_spec_values multi-sport specs
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 4

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS player_spec_values ( id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL RE...` |
| 2 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_psv_player_spec_group ON player_spec_values (player_id, spec_gr...` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_psv_player_id ON player_spec_values (player_id)` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_psv_spec_group_id ON player_spec_values (spec_group_id)` |

### Batch 11 — line ~177

- **Purpose:** player_sport_profiles multi-sport profiles
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 4

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS player_sport_profiles ( id SERIAL PRIMARY KEY, global_player_id TEXT NOT ...` |
| 2 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_psp_global_player_sport ON player_sport_profiles (global_player...` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_psp_global_player_id ON player_sport_profiles (global_player_id)` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_psp_sport_slug ON player_sport_profiles (sport_slug)` |

### Batch 12 — line ~197

- **Purpose:** platform_audit_events append-only audit trail
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 5

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS platform_audit_events ( id BIGSERIAL PRIMARY KEY, occurred_at TIMESTAMPTZ...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_audit_tournament_time ON platform_audit_events (tournament_id, occurre...` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_audit_occurred_at ON platform_audit_events (occurred_at DESC)` |
| 4 | ALTER_TABLE | True | `ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS critical_tags_json JSONB DEFAULT '[]'::js...` |
| 5 | ALTER_TABLE | True | `ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS monitoring_flags_json JSONB` |

### Batch 13 — line ~242

- **Purpose:** purse_boosters + auction_sessions LED/revision columns
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 7

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS purse_boosters ( id SERIAL PRIMARY KEY, local_uuid TEXT NOT NULL UNIQUE, ...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_purse_boosters_tournament_team_status ON purse_boosters (tournament_id...` |
| 3 | ALTER_TABLE | True | `ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_purse_booster_json TEXT` |
| 4 | ALTER_TABLE | True | `ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_led_toast_json TEXT` |
| 5 | ALTER_TABLE | True | `ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS random_draw_queue TEXT` |
| 6 | ALTER_TABLE | True | `ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0` |
| 7 | ALTER_TABLE | True | `ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS re_auction_strategy_json TEXT` |

### Batch 14 — line ~283

- **Purpose:** Backfill empty team access_code values
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | DML | False | `UPDATE teams SET access_code = SUBSTRING(MD5(RANDOM()::TEXT), 1, 8) WHERE access_code IS NULL OR TRI...` |

### Batch 15 — line ~292

- **Purpose:** creative_jobs render queue
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 5

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS creative_jobs ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tournament...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_creative_jobs_tournament_id ON creative_jobs (tournament_id)` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_creative_jobs_status ON creative_jobs (status)` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_creative_jobs_created_at ON creative_jobs (created_at)` |
| 5 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_creative_jobs_tournament_created ON creative_jobs (tournament_id, crea...` |

### Batch 16 — line ~322

- **Purpose:** Badminton tournament management schema (8 tables + indexes)
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 27

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_players ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bp_tournament_id ON badminton_players (tournament_id)` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bp_bwf_code ON badminton_players (bwf_code)` |
| 4 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_tournament_short_name ON badminton_players (tournament_id, s...` |
| 5 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_courts ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL,...` |
| 6 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bc_tournament_id ON badminton_courts (tournament_id)` |
| 7 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_categories ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT N...` |
| 8 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bcat_tournament_id ON badminton_categories (tournament_id)` |
| 9 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_registrations ( id SERIAL PRIMARY KEY, tournament_id INTEGER NO...` |
| 10 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_breg_tournament_id ON badminton_registrations (tournament_id)` |
| 11 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_breg_category_id ON badminton_registrations (category_id)` |
| 12 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_breg_player1_id ON badminton_registrations (player1_id)` |
| 13 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_draws ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL, ...` |
| 14 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bd_tournament_id ON badminton_draws (tournament_id)` |
| 15 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bd_category_id ON badminton_draws (category_id)` |
| 16 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_fixtures ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NUL...` |
| 17 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bfix_tournament_id ON badminton_fixtures (tournament_id)` |
| 18 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bfix_category_id ON badminton_fixtures (category_id)` |
| 19 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bfix_draw_id ON badminton_fixtures (draw_id)` |
| 20 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bfix_court_id ON badminton_fixtures (court_id)` |
| 21 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bfix_status ON badminton_fixtures (status)` |
| 22 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_match_details ( id SERIAL PRIMARY KEY, scoring_match_id INTEGER...` |
| 23 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bmd_tournament_id ON badminton_match_details (tournament_id)` |
| 24 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bmd_court_id ON badminton_match_details (court_id)` |
| 25 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bmd_scoring_match_id ON badminton_match_details (scoring_match_id)` |
| 26 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS badminton_analytics ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NU...` |
| 27 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_banalytics_tournament_id ON badminton_analytics (tournament_id)` |

### Batch 17 — line ~510

- **Purpose:** One-shot migrate referee_name -> umpire_name then drop
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 3

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | DO_BLOCK | True | `DO $$ BEGIN IF EXISTS ( SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND t...` |
| 2 | DML | False | `UPDATE badminton_match_details SET umpire_name = referee_name WHERE umpire_name IS NULL AND referee_...` |
| 3 | ALTER_TABLE | False | `ALTER TABLE badminton_match_details DROP COLUMN referee_name; END IF; END $$` |

### Batch 18 — line ~532

- **Purpose:** Backfill badminton match scorer PIN
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 1

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | DML | False | `UPDATE badminton_match_details SET scorer_pin = LPAD((1000 + floor(random() * 9000))::int::text, 4, ...` |

### Batch 19 — line ~542

- **Purpose:** Master Sports Core identity (global players, sponsors, teams, PTA, stats, profiles)
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 54

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS first_name TEXT` |
| 2 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS last_name TEXT` |
| 3 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS display_name TEXT` |
| 4 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS email TEXT` |
| 5 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS dob TEXT` |
| 6 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS gender TEXT` |
| 7 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS country TEXT` |
| 8 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS state TEXT` |
| 9 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS academy TEXT` |
| 10 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS handedness TEXT` |
| 11 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS world_ranking INTEGER` |
| 12 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS national_ranking INTEGER` |
| 13 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sponsor_id TEXT` |
| 14 | ALTER_TABLE | True | `ALTER TABLE global_players ADD COLUMN IF NOT EXISTS auction_player_id INTEGER` |
| 15 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_auction_player_id ON global_players (auction_player_id) WHER...` |
| 16 | ALTER_TABLE | True | `ALTER TABLE teams ADD COLUMN IF NOT EXISTS master_team_id TEXT` |
| 17 | ALTER_TABLE | True | `ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS master_player_id TEXT` |
| 18 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_bp_master_player_id ON badminton_players (master_player_id)` |
| 19 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS master_sponsors ( id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT,...` |
| 20 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_ms_name ON master_sponsors (name)` |
| 21 | ALTER_TABLE | True | `ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS is_title_sponsor BOOLEAN NOT NULL DEFAULT false` |
| 22 | ALTER_TABLE | True | `ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS is_co_sponsor BOOLEAN NOT NULL DEFAULT false` |
| 23 | ALTER_TABLE | True | `ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS sponsor_priority INTEGER NOT NULL DEFAULT 0` |
| 24 | ALTER_TABLE | True | `ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS priority_type TEXT NOT NULL DEFAULT 'NORMAL'` |
| 25 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS master_teams ( id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT, ...` |
| 26 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_mt_name ON master_teams (name)` |
| 27 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_mt_sponsor_id ON master_teams (sponsor_id)` |
| 28 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS player_team_assignments ( id SERIAL PRIMARY KEY, player_id TEXT NOT NULL,...` |
| 29 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_pta_player_id ON player_team_assignments (player_id)` |
| 30 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_pta_team_id ON player_team_assignments (team_id)` |
| 31 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_pta_tournament_id ON player_team_assignments (tournament_id)` |
| 32 | DROP | True | `DROP INDEX IF EXISTS uq_pta_player_team_tournament` |
| 33 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS player_statistics ( id SERIAL PRIMARY KEY, player_id TEXT NOT NULL, sport...` |
| 34 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_player_sport_tournament ON player_statistics (player_id, spo...` |
| 35 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_ps_player_id ON player_statistics (player_id)` |
| 36 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS master_player_id_mappings ( id SERIAL PRIMARY KEY, source_module TEXT NOT...` |
| 37 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_mpim_source ON master_player_id_mappings (source_module, source...` |
| 38 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_mpim_master_player_id ON master_player_id_mappings (master_player_id)` |
| 39 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS master_sports_sync_log ( id SERIAL PRIMARY KEY, action TEXT NOT NULL, sou...` |
| 40 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_mssl_created_at ON master_sports_sync_log (created_at DESC)` |
| 41 | ALTER_TABLE | True | `ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT '...` |
| 42 | ALTER_TABLE | True | `ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true` |
| 43 | ALTER_TABLE | True | `ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ` |
| 44 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_pta_active ON player_team_assignments (tournament_id, is_active)` |
| 45 | DML | False | `DELETE FROM player_team_assignments a USING player_team_assignments b WHERE a.id > b.id AND a.player...` |
| 46 | DML | False | `UPDATE player_team_assignments SET is_active = false, ended_at = NOW() WHERE id IN ( SELECT id FROM ...` |
| 47 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_pta_active_roster ON player_team_assignments (player_id, tourna...` |
| 48 | ALTER_TABLE | True | `ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS stats_json JSONB` |
| 49 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS tournament_player_profiles ( id SERIAL PRIMARY KEY, tournament_id INTEGER...` |
| 50 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_master_player ON tournament_player_profiles (tou...` |
| 51 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_tpp_tournament_id ON tournament_player_profiles (tournament_id)` |
| 52 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_tpp_master_player_id ON tournament_player_profiles (master_player_id)` |
| 53 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_initials ON tournament_player_profiles (tourname...` |
| 54 | DML | False | `INSERT INTO tournament_player_profiles ( tournament_id, master_player_id, display_name, initials, ph...` |

### Batch 20 — line ~729

- **Purpose:** Cricket scoring Phase 1 venues/officials/draws/squads/stats/awards/DLS
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 39

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_venues ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL, n...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_venues_tournament_id ON scoring_venues (tournament_id)` |
| 3 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_officials ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL...` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_officials_tournament_id ON scoring_officials (tournament_id)` |
| 5 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_draws ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL, na...` |
| 6 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_draws_tournament_id ON scoring_draws (tournament_id)` |
| 7 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_groups ( id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL, d...` |
| 8 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_groups_tournament_id ON scoring_groups (tournament_id)` |
| 9 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_groups_draw_id ON scoring_groups (draw_id)` |
| 10 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_group_members ( id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL,...` |
| 11 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_group_members_group_team ON scoring_group_members (grou...` |
| 12 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_group_members_group_id ON scoring_group_members (group_id)` |
| 13 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_match_squads ( id SERIAL PRIMARY KEY, match_id INTEGER NOT NULL, ...` |
| 14 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_match_squads_match_team ON scoring_match_squads (match_...` |
| 15 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_match_squads_match_id ON scoring_match_squads (match_id)` |
| 16 | ALTER_TABLE | True | `ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS draw_id INTEGER` |
| 17 | ALTER_TABLE | True | `ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS group_id INTEGER` |
| 18 | ALTER_TABLE | True | `ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_round INTEGER` |
| 19 | ALTER_TABLE | True | `ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_slot INTEGER` |
| 20 | ALTER_TABLE | True | `ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS venue_id INTEGER` |
| 21 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_draw_id ON scoring_fixtures (draw_id)` |
| 22 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_group_id ON scoring_fixtures (group_id)` |
| 23 | ALTER_TABLE | True | `ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS venue_id INTEGER` |
| 24 | ALTER_TABLE | True | `ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS officials_json JSONB` |
| 25 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_match_player_stats ( id SERIAL PRIMARY KEY, match_id INTEGER NOT ...` |
| 26 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_mps_match_player_innings ON scoring_match_player_stats ...` |
| 27 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_mps_tournament_id ON scoring_match_player_stats (tournament_id...` |
| 28 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_mps_match_id ON scoring_match_player_stats (match_id)` |
| 29 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_mps_player_id ON scoring_match_player_stats (player_id)` |
| 30 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_leaderboard_snapshots ( id SERIAL PRIMARY KEY, tournament_id INTE...` |
| 31 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_lb_tournament_category ON scoring_leaderboard_snapshots...` |
| 32 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_lb_tournament_id ON scoring_leaderboard_snapshots (tournament_...` |
| 33 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_player_awards ( id SERIAL PRIMARY KEY, match_id INTEGER NOT NULL,...` |
| 34 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_awards_match_type ON scoring_player_awards (match_id, a...` |
| 35 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_awards_tournament_id ON scoring_player_awards (tournament_id)` |
| 36 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_awards_player_id ON scoring_player_awards (player_id)` |
| 37 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS scoring_dls_calculations ( id SERIAL PRIMARY KEY, match_id INTEGER NOT NU...` |
| 38 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_dls_match_id ON scoring_dls_calculations (match_id)` |
| 39 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_scoring_dls_tournament_id ON scoring_dls_calculations (tournament_id)` |

### Batch 21 — line ~878

- **Purpose:** Website contact_inquiries inbox
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 4

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS contact_inquiries ( id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, email...` |
| 2 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_contact_inquiries_created_at ON contact_inquiries (created_at DESC)` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_contact_inquiries_status ON contact_inquiries (status)` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_contact_inquiries_email ON contact_inquiries (email)` |

### Batch 22 — line ~901

- **Purpose:** Organizer Google Sheets OAuth token columns
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 4

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | ALTER_TABLE | True | `ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_refresh_token text` |
| 2 | ALTER_TABLE | True | `ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_access_token text` |
| 3 | ALTER_TABLE | True | `ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_token_expiry timestamptz` |
| 4 | ALTER_TABLE | True | `ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_connected_email text` |

### Batch 23 — line ~912

- **Purpose:** google_sheet_syncs persistent sheet linkage
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 2

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS google_sheet_syncs ( id SERIAL PRIMARY KEY, organizer_id INTEGER NOT NULL...` |
| 2 | CREATE_INDEX | True | `CREATE UNIQUE INDEX IF NOT EXISTS google_sheet_syncs_tournament_id_idx ON google_sheet_syncs (tourna...` |

### Batch 24 — line ~933

- **Purpose:** Admin notification settings + inbox
- **Function:** `systemCQuery` (module init side effect in `lib/db/src/index.ts`)
- **Runs every startup:** yes (void fire-and-forget at import)
- **Statements:** 9

| # | Cat | Idempotent | Object / preview |
|---|-----|------------|------------------|
| 1 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS admin_notification_settings ( id SERIAL PRIMARY KEY, admin_name TEXT NOT ...` |
| 2 | CREATE_TABLE | True | `CREATE TABLE IF NOT EXISTS admin_notifications ( id SERIAL PRIMARY KEY, type TEXT NOT NULL, title TE...` |
| 3 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_admin_notifications_is_read ON admin_notifications (is_read)` |
| 4 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_admin_notifications_priority ON admin_notifications (priority)` |
| 5 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_admin_notifications_type ON admin_notifications (type)` |
| 6 | CREATE_INDEX | True | `CREATE INDEX IF NOT EXISTS ix_admin_notifications_created_at ON admin_notifications (created_at DESC...` |
| 7 | ALTER_TABLE | True | `ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS live_notifications_enabled BOOLEAN ...` |
| 8 | ALTER_TABLE | True | `ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN ...` |
| 9 | ALTER_TABLE | True | `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'System'` |


