# BidWar Schema Ownership Map

> Phase 1 read-only. For each cloud table: who creates, who modifies, who owns, who validates, multi-system conflicts.  
> Legend: **A**=Drizzle push, **B**=migrate.ts, **C**=index.ts runtime, **D**=ensure-schema, **O**=orphan SQL files, **V**=verify-master-sports-db.ts, **—**=none/ORM only.

**Validation:** No system validates schema versions. “Validates” below means “ensures existence via IF NOT EXISTS” or “ORM assumes shape.”

**Primary owner:** The system that should be treated as canonical for that object’s definition today (judgment from where the fullest TypeScript definition lives). For almost all tables that is **Drizzle schema (A)**; runtime systems are healers.

---

## Conflicting ownership summary

| Conflict class | Examples | Systems |
|----------------|----------|---------|
| Triple+ create | `platform_audit_events`, `purse_boosters`, `creative_jobs`, scoring foundation tables, intelligence archives, academy | A + B + C and/or D |
| Dual create (boot) | `branding_assets`, communication_*, bulk_import_*, owner_sessions, push columns | C and/or D (+ A) |
| Dual create (CLI+boot) | scoring_*, tournaments scoring columns | A + B + D |
| Runtime-only extras | partial indexes `uq_pta_active_roster`, `uq_bp_tournament_short_name`, `ix_gp_auction_player_id`; FK REFERENCES on player_spec_values / player_sport_profiles | C only (not in Drizzle) |
| migrate-only | `sessions` | B only (not in Drizzle) |
| Orphan duplicate | scoring foundation, push/owner_sessions | O duplicates B/D/A |
| Drizzle-only (no runtime ensure) | `bids`, `categories`, core auction tables, `auction_*_events`, most `comm_*`, `sports` hierarchy, `notification_logs`, `settings`, etc. | A only — **missing columns break at query time** unless push was run |

---

## Core auction domain

| Table | Created by | Modified by | Primary owner | Ensured/validated by | Multi-system? |
|-------|------------|-------------|---------------|----------------------|---------------|
| `tournaments` | A | A; B (scoring/features/bid-extension/local-mode cols); C (registration payment/declaration/bid_value/fields); D (same + scoring + export + cheer) | A (`schema/tournaments.ts`) | D/C heal columns | **YES — heavy** |
| `teams` | A | A; B (owner_photo/email + unique index); C (owner_photo/email, master_team_id, access_code UPDATE); D (logo/owner photo public_id) | A | C/D/B | **YES** |
| `players` | A | A; B (email); C (email/gender/jersey/payment/serial_no + unique index); D (photo public_ids, originals) | A | C/D | **YES** |
| `categories` | A | A | A | — (no runtime ensure) | No |
| `bids` | A | A | A | — | No |
| `auction_sessions` | A | A; B (purse/led/random/obs cols); C (same + revision + re_auction); D (same set) | A | B/C/D | **YES** |
| `purse_boosters` | A, B, C | A/B/C | A | B/C | **YES** |

---

## Auth / organizers / sessions

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `organizers` | A | A; B (google unique, whatsapp, photo); C (google sheets tokens); D (whatsapp, photo, photo_public_id) | A | B/C/D | **YES** |
| `owner_sessions` | A, D, O | A/D | A | D | **YES** |
| `push_subscriptions` | A, D, O | A/D/O (O also DELETEs all rows) | A | D | **YES** |
| `sessions` | **B only** | B | **B (orphan from ORM)** | B | migrate-only |

---

## Branding / settings / CMS

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `branding_settings` | A | A; C (`main_logo_reverse_url`) | A | C | Mild |
| `branding_assets` | A, C, D | A/C/D (public_id, metadata) | A | C/D | **YES** |
| `settings` | A | A | A | — | No |
| `sms_notification_settings` | A | A | A | — | No |
| `display_auctions` | A | A | A | — | No |
| `showcase_events` | A | A; D (`image_public_id`) | A | D | Mild |
| `academy_categories` | A, B, D | A/B/D | A | B/D | **YES** |
| `academy_lessons` | A, B, D | A/B/D | A | B/D | **YES** |
| `contact_inquiries` | A, C | A/C | A | C | **YES** |
| `creative_jobs` | A, B, C | A/B/C | A | B/C | **YES** |

---

## Intelligence / audit

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `auction_bid_events` | A | A | A | — | No |
| `auction_player_events` | A | A | A | — | No |
| `auction_timer_events` | A | A | A | — | No |
| `intelligence_archives` (+ 3 child tables) | A, B, D | A/B/D; B/D add FKs CASCADE on children | A (indexes missing in Drizzle; present in B) | B/D | **YES — index ownership split** |
| `platform_audit_events` | A, B, C | A/B/C | A | B/C | **YES** |
| `audit_logs` (`entity-audit-logs`) | A, D | A/D | A | D | **YES** |
| `player_import_logs` | A | A | A | — | No |

---

## Global / master sports / specs

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `global_players` | A | A; C/V (many profile columns + partial unique on auction_player_id); D (photo_public_id) | A | C/D/V | **YES** |
| `player_sport_profiles` | A, C | A/C (**C adds FK REFERENCES**) | A | C | **YES** |
| `player_spec_values` | A, C | A/C (**C adds FK REFERENCES**) | A | C | **YES** |
| `sports`, `sport_roles`, `role_spec_groups`, `role_spec_options` | A | A | A | — | No |
| `master_sponsors`, `master_teams` | A, C, V | A/C/V | A | C/V | **YES** |
| `player_team_assignments` | A, C, V | A/C/V (assignment_type, is_active, ended_at; DROP old unique; CREATE partial unique; DELETE dedupe) | A | C/V | **YES — CRITICAL runtime data mutation** |
| `player_statistics` | A, C, V | A/C/V (`stats_json`) | A | C/V | **YES** |
| `master_player_id_mappings` | A, C, V | A/C/V | A | C/V | **YES** |
| `master_sports_sync_log` | A, C, V | A/C/V | A | C/V | **YES** |
| `tournament_player_profiles` | A, C | A/C (INSERT backfill); D (extra auction fields, photo_override_public_id) | A | C/D | **YES** |

---

## Scoring (cricket platform)

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `scoring_fixtures` | A, B, O | A/B; C adds draw/group/bracket/venue cols | A | B/C | **YES** |
| `scoring_matches` | A, B, O | A/B; C adds venue_id, officials_json | A | B/C | **YES** |
| `scoring_sessions` | A, B, O | A/B | A | B | Dual |
| `scoring_events` | A, B, O | A/B | A | B | Dual |
| `scoring_standings` | A, B, O | A/B | A | B | Dual |
| `scoring_venues`, `scoring_officials`, `scoring_draws`, `scoring_groups`, `scoring_group_members`, `scoring_match_squads` | A, C | A/C | A | C | Dual |
| `scoring_match_player_stats`, `scoring_leaderboard_snapshots`, `scoring_player_awards`, `scoring_dls_calculations` | A, C | A/C | A | C | Dual |

---

## Badminton

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| All 8 badminton_* tables | A, C | A/C; C DROP referee_name; C/D photo public_ids; C master_player_id | A | C/D | **YES** |

---

## Communication (legacy + new)

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `consent_tokens`, `otp_sessions`, `comm_logs`, `consent_blast_log`, `wa_quality_log`, `wa_templates`, `bot_sessions`, `wa_consent_events` | A | A | A | — | No |
| `communication_*` (7 tables) | A, D | A/D | A | D | Dual |
| `notification_logs` | A | A | A | — | No |

---

## Bulk import / workbook / photos / sheets / admin notifications

| Table | Created by | Modified by | Primary owner | Ensured by | Multi? |
|-------|------------|-------------|---------------|------------|--------|
| `bulk_import_jobs`, `bulk_import_job_items`, `bulk_import_photo_items` | A, D | A/D (many ALTER columns on photo items) | A | D | Dual |
| `workbook_versions`, `workbook_mapping_profiles` | A, D | A/D | A | D | Dual |
| `photo_source_assets` | A, D | A/D | A | D | Dual |
| `google_sheet_syncs` | A, C | A/C | A | C | Dual |
| `admin_notifications`, `admin_notification_settings` | A, C | A/C | A | C | Dual |

---

## Local SQLite ownership (separate domain)

| Concern | Owner |
|---------|-------|
| Table create/alter | `lib/db-local/src/setup.ts` only |
| Sync with cloud | Application sync layer — **not** Drizzle push |
| Drift risk | High vs cloud `tournaments`/`players`/etc. |

---

## Ownership conclusions

1. **Drizzle TypeScript schema is the ORM contract** for 92 tables (+ `sessions` outside ORM).  
2. **No single system owns physical DDL end-to-end.**  
3. **Worst conflicts:** `tournaments`, `players`, `auction_sessions`, `player_team_assignments`, scoring foundation, intelligence archives, academy, platform_audit, purse_boosters, creative_jobs.  
4. **Silent gap risk:** Tables with **A only** (e.g. `bids`, `categories`) get new columns **only** if someone runs push — runtime healers will not add them.
