# BidWar Database Audit

> Generated: July 2026 — Read-only audit.

---

## Overview

- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM v0.45.2
- **Total tables:** ~92 (Drizzle-defined) + 1 legacy (`sessions`)
- **Schema management:** 4 parallel paths (technical debt — see TECHNICAL_DEBT_REPORT.md DB-ARCH-001)
- **Foreign keys:** Almost none defined in Drizzle; some in raw SQL migrations only

---

## 1. Schema Management Paths

| Path | File | When Run |
|------|------|----------|
| Drizzle Kit push | `lib/db/drizzle.config.ts` | `pnpm db:push:prod` |
| SQL migrations | `lib/db/migrations/0001_scoring_foundation.sql`, `0002_verified_push_subscriptions.sql` | `scripts/src/migrate.ts` |
| Runtime DDL | `lib/db/src/index.ts` | Every import of `@workspace/db` |
| ensure-schema.ts | `lib/db/src/ensure-schema.ts` | Called at API boot |
| `sessions` table | `scripts/src/migrate.ts` | `pnpm migrate` |

**Risk:** These four paths can produce different schema states in different environments. A developer adding a column must update multiple files.

---

## 2. Complete Table Inventory

### 2.1 Core Auction Domain

#### `tournaments`
**~70+ columns**

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `organizer_id` | integer | FK to organizers (logical only) |
| `name` | text | |
| `sport` | text | Legacy field; multi-sport now uses `sport_id` |
| `sport_id` | text | FK to sports.slug (logical) |
| `auction_code` | text (unique) | Public tournament code |
| `venue` | text | |
| `auction_date`, `auction_time` | text | |
| `organizer_name`, `organizer_mobile`, `organizer_email`, `organizer_password` | text | Per-tournament organizer (not organizer account) |
| `logo_url`, `logo_public_id` | text | Cloudinary |
| `sponsor_logos` | json | Array of sponsor logo objects |
| `auction_unit` | text | 'lakh' or 'thousand' |
| `base_purse`, `min_bid`, `bid_increment` | integer | Auction economics |
| `bid_tier1_up_to`, `bid_tier1_increment`, `bid_tier2_up_to`, `bid_tier2_increment`, `bid_tier3_increment` | integer | Tiered bidding |
| `bid_tiers` | json | |
| `timer_seconds`, `bid_timer_seconds` | integer | |
| `bid_extension_enabled` | boolean | |
| `bid_extension_threshold_seconds`, `bid_extension_seconds` | integer | |
| `player_selection_mode` | text | 'manual' or 'random' |
| `status` | text | Tournament lifecycle |
| `registration_deadline` | timestamp | |
| `registration_limit` | integer | |
| `enable_registration_payment`, `registration_fee`, `upi_id` | mixed | Payment config |
| `payment_verification_method`, `payment_collection_mode` | text | |
| `enable_registration_declaration`, `registration_declaration_text` | mixed | |
| `bid_value_mode`, `bid_value_options` | mixed | |
| `license_status`, `license_granted_at`, `license_granted_by` | mixed | |
| `admin_locked`, `admin_locked_at` | mixed | |
| `reset_count`, `last_reset_at`, `last_reset_by` | mixed | |
| `minimum_squad_size`, `maximum_squad_size` | integer | |
| `local_mode_enabled` | boolean | |
| `export_token`, `export_token_expires_at` | text | For local mode sync |
| `match_dates` | json | Scoring match dates |
| `registration_fields_json` | json | Custom registration fields |
| `scoring_enabled`, `scoring_phase`, `scoring_pin`, `scoring_settings_json` | mixed | |
| `features_json` | json | Per-tournament feature flags |
| `created_at`, `updated_at` | timestamp | |
| Various audio/cheer/banner fields | mixed | Display customization |

**Indexes:** `auctions_code_idx` (auction_code), `auctions_organizer_idx` (organizer_id)

---

#### `teams`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `tournament_id` | integer | **No index** — MEDIUM risk |
| `name`, `short_code` | text | |
| `owner_name`, `owner_mobile`, `owner_email` | text | |
| `owner_photo_url`, `owner_photo_public_id` | text | |
| `color`, `logo_url`, `logo_public_id` | text | |
| `master_team_id` | integer | FK to master_teams (logical) |
| `purse`, `purse_used` | integer | |
| `is_bidding_enabled` | boolean | |
| `access_code` | text | Owner login code |
| WhatsApp consent fields | mixed | |
| `created_at`, `updated_at` | timestamp | |

**Indexes:** `uq_teams_tournament_owner_mobile` (unique). **Missing index on `tournament_id`.**

---

#### `players`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `tournament_id` | integer | Indexed |
| `serial_no` | integer | Indexed (unique with tournament) |
| `category_id` | integer | |
| `team_id` | integer | |
| `name`, `city`, `role` | text | |
| `batting_style`, `bowling_style` | text | Sport-specific; being migrated to specs |
| `age`, `gender` | mixed | |
| Photo fields | text | Cloudinary |
| `base_price`, `selected_bid_value`, `bid_value_source` | integer/text | |
| `sold_price`, `retained_price` | integer | |
| `status` | text | unsold/available/sold/withdrawn |
| Jersey fields | text | |
| `achievements` | text | |
| `mobile_number`, `email` | text | |
| `crichero_url` | text | Legacy cricket hero link |
| `availability_dates`, `specialization` | text | |
| `global_player_id` | integer | FK to global_players (logical) |
| `player_tag`, `player_tag_team_id` | mixed | |
| `is_non_playing_member` | boolean | |
| WhatsApp consent fields | mixed | |
| Registration payment fields | mixed | |
| `created_at`, `updated_at` | timestamp | |

**Indexes:** `players_tournament_id_idx`, `uq_players_tournament_serial_no`, `players_mobile_idx`

---

#### `categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `tournament_id` | integer | **No index** — MEDIUM risk |
| `name`, `min_bid`, `bid_increment`, `bid_tiers`, `max_players`, `color_code`, `sort_order` | mixed | |
| `created_at`, `updated_at` | timestamp | |

---

#### `bids`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `tournament_id` | integer | **No index** — HIGH risk (hot path) |
| `player_id` | integer | **No index** |
| `team_id` | integer | **No index** |
| `amount` | integer | |
| `timestamp` | timestamp | |

⚠️ **Critical gap:** `bids` is written on every bid event and queried for bid history. No indexes beyond PK.

---

#### `auction_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `tournament_id` | integer (unique) | Indexed via unique constraint |
| `status` | text | Auction state machine |
| `current_player_id` | integer | |
| `current_bid`, `current_bid_team_id` | integer | |
| Timer fields | integer | |
| `last_action`, `last_outcome` | text | |
| Break/wheel/overlay fields | json | |
| `obs_context_json` | json | OBS overlay state |
| `display_player_filter` | json | |
| `random_draw_queue` | json | |
| `re_auction_strategy_json` | json | |
| Counters | integer | |
| `last_purse_booster_json` | json | |
| `last_led_toast_json` | json | |
| `revision` | integer | Optimistic concurrency |
| `updated_at` | timestamp | |

**Indexes:** Unique on `tournament_id`.

---

#### `purse_boosters`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (PK) | |
| `local_uuid` | text (unique) | Idempotency key |
| `tournament_id`, `team_id` | integer | Indexed |
| `amount`, `reason` | mixed | |
| `status` | text | pending/applied/rejected |
| Audit fields | mixed | |
| `previous_capacity`, `new_capacity` | integer | |
| `origin` | text | cloud/local |
| `sync_state` | text | |
| Timestamps | timestamp | |

**Indexes:** `ux_purse_boosters_local_uuid`, `purse_boosters_tournament_idx`, `purse_boosters_team_idx`

---

### 2.2 Organizers & Auth

#### `organizers`

| Column | Notes |
|--------|-------|
| `id` (PK), `name`, `email` (unique), `mobile` (unique) | Core identity |
| `password_hash`, `google_id` (unique), `google_email` | Auth |
| Google Sheets OAuth tokens | Integration |
| `license_status`, `max_tournaments` | License |
| `notes`, `photo_url`, `photo_public_id` | Profile |
| WhatsApp consent fields | |

---

#### `owner_sessions`

| Column | Notes |
|--------|-------|
| `id` (PK), `tournament_id`, `team_id` | Scoped to team |
| `verified_at`, `expires_at`, `last_seen_at` | Session management |

**Indexes:** `owner_sessions_team_idx`

---

#### `push_subscriptions`

| Column | Notes |
|--------|-------|
| `id` (PK), `tournament_id`, `team_id` | Scoped to team |
| `endpoint` (unique), `p256dh`, `auth` | VAPID keys |
| `verified_at`, `owner_session_id`, `last_seen_at` | Verification |

**Indexes:** `push_subscriptions_team_idx`

---

### 2.3 Branding & Settings

#### `branding_settings`
Singleton table. Brand identity, colors, fonts, visibility toggles, watermark, logo animation.

#### `branding_assets`
Typed asset library (favicon, splash, obs watermark, etc.) with versions and active flag.

**Indexes:** `branding_assets_type_active_idx`

#### `settings`
Key-value store. PK = `key`.

---

### 2.4 Global / Master Sports

#### `global_players` (alias `masterPlayersTable`)

| Column | Notes |
|--------|-------|
| `id` (text, `gp_*` prefix) | Global ID |
| `canonical_name`, `first_name`, `last_name`, `display_name` | Identity |
| `mobile_number`, `email`, `dob`, `gender`, `country`, `state`, `city`, `academy` | Profile |
| `handedness` | **DEPRECATED** — superseded by sport profiles |
| `world_ranking`, `national_ranking` | **DEPRECATED** |
| `sponsor_id`, `auction_player_id` | **DEPRECATED** |
| `sport`, `default_role` | **DEPRECATED** — superseded by `player_sport_profiles` |
| `age`, photo fields, `notes` | |

**Indexes:** `global_players_mobile_idx`, `global_players_canonical_name_idx`

**Note:** 4 deprecated columns need migration + drop.

---

#### `player_sport_profiles`

| Column | Notes |
|--------|-------|
| `global_player_id` (text), `sport_slug` (text) | Composite PK |
| `default_role` | |
| `profile_json` | Sport-specific attributes |

Replaces deprecated columns on `global_players`.

---

#### `player_spec_values`

| Column | Notes |
|--------|-------|
| `player_id` (integer), `spec_group_id` (integer) | Composite PK |
| `value_text` | |

FK to `players(id)` defined in runtime DDL (not Drizzle).

---

#### `tournament_player_profiles`

Auction-specific identity overlay: `initials`, `display_name`, photo override, seed/rating, `auction_data_json`. FK to players/tournaments (logical).

**Indexes:** `uq_tpp_tournament_initials`

---

#### `sports`, `sport_roles`, `role_spec_groups`, `role_spec_options`
Multi-sport specification hierarchy. Fully indexed.

---

#### `master_teams`, `master_sponsors`
Canonical entity tables. Indexed.

---

#### `player_team_assignments`
Cross-tournament roster assignments. Partially indexed.

**Indexes:** `pta_global_player_idx`, `pta_tournament_idx`; `uq_pta_active_roster` (partial, runtime DDL)

---

#### `player_statistics`
Per-sport aggregates. Indexed.

---

#### `master_player_id_mappings`, `master_sports_sync_log`
Migration/sync audit. Low traffic.

---

### 2.5 Auction Intelligence (Behavioral Logs)

#### `auction_bid_events`, `auction_player_events`, `auction_timer_events`

**No Drizzle indexes beyond PK.** These append-only tables log every bid, player selection, and timer event for post-auction analytics. Missing indexes on `tournament_id` mean analytics queries do full table scans.

#### `intelligence_archives` + child tables

Frozen copies of intelligence events when tournaments are deleted. Indexes exist in `migrate.ts` only, not in Drizzle schema.

---

### 2.6 Scoring (Cricket)

| Table | Purpose | Indexes |
|-------|---------|---------|
| `scoring_fixtures` | Optional fixture container | tournament_id |
| `scoring_matches` | Playable match unit | tournament_id, unique seq |
| `scoring_sessions` | Live match projection | unique on match_id |
| `scoring_events` | Append-only event store | tournament, match, sequence; unique on match+seq |
| `scoring_standings` | Team standings | tournament+team unique |
| `scoring_venues`, `scoring_officials`, `scoring_draws` | Tournament structure | tournament_id |
| `scoring_groups`, `scoring_group_members` | Group stage | tournament_id |
| `scoring_match_squads` | Per-match squad JSON | match_id |
| `scoring_match_player_stats` | Batting/bowling/fielding | match, player, innings |
| `scoring_leaderboard_snapshots` | Category leaderboards | tournament+category |
| `scoring_player_awards` | MoM etc. | match_id |
| `scoring_dls_calculations` | DLS revision history | match_id |

---

### 2.7 Badminton (8 Tables)

| Table | Notes |
|-------|-------|
| `badminton_players` | `global_player_id` (integer, DEPRECATED) + `master_player_id` (text) dual identity |
| `badminton_courts` | |
| `badminton_categories` | |
| `badminton_registrations` | Missing index on `player2_id` |
| `badminton_draws` | |
| `badminton_fixtures` | Indexed |
| `badminton_match_details` | |
| `badminton_analytics` | Low-traffic analytics |

---

### 2.8 Communication (Two Parallel Systems)

#### Legacy (`comm_*` tables)

| Table | Status |
|-------|--------|
| `consent_tokens` | Active (WhatsApp consent auth) |
| `otp_sessions` | Active (auth OTPs) |
| `comm_logs` | Active (WA/SMS audit) |
| `consent_blast_log` | Active (bulk WA consent) |
| `wa_quality_log` | Active (Meta webhook) |
| `wa_templates` | Active (WA template store) |
| `bot_sessions` | Low traffic |
| `wa_consent_events` | Low traffic |

#### New (`communication_*` tables)

| Table | Status |
|-------|--------|
| `communication_assets` | Active |
| `communication_templates` | Active |
| `communication_template_versions` | Active |
| `communication_jobs` | Active |
| `communication_job_recipients` | Active |
| `communication_logs` | Active |
| `communication_settings` | Active |

#### Overlap

`notification_logs` — legacy audit trail, partially duplicated by `communication_logs`.
`sms_notification_settings` — singleton DLT SMS configuration.

---

### 2.9 Bulk Import & Workbook

| Table | Purpose | Indexes |
|-------|---------|---------|
| `bulk_import_jobs` | Import job tracking | tournament_id, status |
| `bulk_import_job_items` | Per-player import items | job_id, status |
| `bulk_import_photo_items` | Photo import queue | job_id, cloudinary_public_id |
| `workbook_versions` | Excel workbook snapshots | tournament_id |
| `workbook_mapping_profiles` | Custom column mappings | |
| `photo_source_assets` | Google Drive/Dropbox photo cache | |
| `audit_logs` | Field-level entity audit | entity, tournament |
| `player_import_logs` | Import history | tournament_id |

---

### 2.10 Platform / CMS / Misc

| Table | Purpose | Traffic |
|-------|---------|---------|
| `platform_audit_events` | Structural changes log | Medium |
| `admin_notifications` | In-app admin notifications | Medium |
| `admin_notification_settings` | Admin notification preferences | Low |
| `showcase_events` | Marketing homepage gallery | Low |
| `display_auctions` | Landing page auction CMS | Low |
| `contact_inquiries` | Contact form submissions | Low |
| `creative_jobs` | Buzz Studio render queue | Medium |
| `google_sheet_syncs` | Google Sheets OAuth sync | Low |
| `academy_categories`, `academy_lessons` | Knowledge center CMS | Low |
| `sessions` | Express session store (legacy) | Low/None |

---

## 3. Index Gaps (Tables Without Adequate Indexing)

### CRITICAL

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `bids` | `tournament_id`, `player_id`, `team_id` | Full scan on every bid history query; auction hot path |

### HIGH

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `auction_bid_events` | `tournament_id` | Analytics/intelligence full scans |
| `auction_player_events` | `tournament_id` | Same |

### MEDIUM

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `categories` | `tournament_id` | Full scan per tournament load |
| `teams` | `tournament_id` | Full scan per tournament load |
| `auction_timer_events` | `tournament_id` | Analytics queries |
| `intelligence_archives` | Indexes only in migrate.ts | Inconsistent |
| `badminton_registrations` | `player2_id` | Doubles match queries |

---

## 4. Foreign Key Constraints

### Defined as Drizzle `references()`
Almost **none**. BidWar relies on application-level referential integrity.

### Defined as raw SQL
| Constraint | Defined in |
|-----------|-----------|
| `intelligence_archive_*` → `intelligence_archives(id)` CASCADE DELETE | `scripts/src/migrate.ts` |
| `academy_lessons.category_id` → `academy_categories(id)` | `scripts/src/migrate.ts` |
| `player_spec_values.player_id` → `players(id)` | `lib/db/src/index.ts` runtime DDL |
| `player_sport_profiles.global_player_id` → `global_players(id)` | `lib/db/src/index.ts` runtime DDL |
| `player_sport_profiles.sport_slug` → `sports(slug)` | `lib/db/src/index.ts` runtime DDL |

### Implicit (application-enforced only)
- `players.tournament_id` → `tournaments.id`
- `teams.tournament_id` → `tournaments.id`
- `bids.tournament_id` → `tournaments.id`
- `categories.tournament_id` → `tournaments.id`
- All other relationships

---

## 5. Deprecated / Redundant Columns

### `global_players` (4 deprecated columns)

| Column | Status | Replacement |
|--------|--------|-------------|
| `handedness` | **@deprecated** | `player_sport_profiles.profile_json` |
| `auction_player_id` | **@deprecated** | Relationship via `player_team_assignments` |
| `sport` | **@deprecated** | `player_sport_profiles.sport_slug` |
| `default_role` | **@deprecated** | `player_sport_profiles.default_role` |

### `badminton_players` (dual identity)

| Column | Status | Replacement |
|--------|--------|-------------|
| `global_player_id` (integer) | **Deprecated** | `master_player_id` (text, `gp_*` prefix) |

### `players` legacy fields

| Column | Status | Notes |
|--------|--------|-------|
| `batting_style`, `bowling_style` | Legacy | Being migrated to `player_spec_values` |
| `crichero_url` | Legacy | External link to cricket stats site; low usage |

---

## 6. Low-Traffic / Potentially Unused Tables

| Table | Assessment |
|-------|------------|
| `wa_quality_log` | Active but niche — Meta webhook quality signals |
| `master_sports_sync_log` | Audit/debug only; few writers |
| `badminton_analytics` | Written in service; limited read paths |
| `sms_notification_settings` | Active singleton — DLT SMS may be feature-flagged off |
| `display_auctions` | Marketing CMS — small table, niche use |
| `showcase_events` | Homepage gallery — small table |
| `bot_sessions` | Part of WA bot (minimal usage) |
| `scoring_fixtures` | Created but matches go directly to `scoring_matches`; may be vestigial |

---

## 7. Local Database (SQLite — bidwar-local)

**Location:** `lib/db-local/src/`
**Engine:** libSQL (SQLite compatible)

| Table | Purpose |
|-------|---------|
| `tournaments` | Subset of cloud schema |
| `teams` | Subset |
| `players` | Subset |
| `categories` | Subset |
| `bids` | Full bid history |
| `auction_sessions` | Live session state |
| `sync_queue` | Pending cloud sync items |
| `purse_boosters` | Booster events |
| `venue_snapshots` | Point-in-time snapshots for mirror |

**Gaps vs cloud:** No organizers, branding, scoring, badminton, communication, global players, or audit tables.

**Schema maintenance:** Incremental `ALTER TABLE` in `setup.ts` — manual, can drift from cloud schema.

---

## 8. Database Queries of Concern

| Query Pattern | Location | Risk |
|---------------|----------|------|
| `SELECT * FROM organizers WHERE ...` (loads all for uniqueness) | `routes/auth.ts` | Memory scaling issue |
| `SELECT * FROM bids WHERE tournament_id = ?` (no index) | Bid history endpoints | Full table scan |
| `SELECT * FROM auction_bid_events WHERE tournament_id = ?` (no index) | Intelligence service | Full scan on large tables |
| Raw SQL in lovableupdates (dead) | `lovableupdates/src/lib/bidwar-live.functions.ts` | Security risk if run against prod |

---

## 9. Recommended Database Actions (Priority Order)

1. **Add index on `bids.tournament_id`** — immediate relief for auction bid history queries
2. **Add index on `auction_bid_events.tournament_id`** and `auction_player_events.tournament_id` — intelligence queries
3. **Add index on `categories.tournament_id`** and `teams.tournament_id` — all tournament page loads
4. **Add index on `badminton_registrations.player2_id`** — doubles draw queries
5. **Drop deprecated columns on `global_players`** after completing migration
6. **Drop `badminton_players.global_player_id` integer column** after `master_player_id` migration
7. **Add Drizzle `references()` for key relationships** — at minimum `players`, `teams`, `categories` → `tournaments`
8. **Consolidate schema management into one path** — Drizzle migrations only, remove runtime DDL from index.ts
9. **Migrate `notification_logs`** writers to `communication_logs` then drop old table
10. **Add FK + cascade for `bids`** → `players`/`teams`/`tournaments` to prevent orphaned records
