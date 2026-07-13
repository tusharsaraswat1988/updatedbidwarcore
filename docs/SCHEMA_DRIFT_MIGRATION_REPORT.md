# Schema Drift Migration Report

**Generated:** 2026-07-13  
**Production:** Neon `jolly-tree-42208228` (BidWar Production)  
**Sources compared:**
- Drizzle schemas: `lib/db/src/schema/**/*.ts` (92 tables)
- Boot DDL: `lib/db/src/ensure-schema.ts` (System D) + `lib/db/src/index.ts` (System C)
- Live DB: `information_schema.columns` + `pg_indexes`

**Machine-readable companion:** [`SCHEMA_DRIFT_REPORT.json`](./SCHEMA_DRIFT_REPORT.json)  
**Re-run audits:** `node scripts/schema-drift-vs-prod.mjs`

---

## Executive verdict

| Priority | Finding | Action |
|----------|---------|--------|
| **P0** | `tournaments.city` was in Drizzle, absent from production | **FIXED 2026-07-13** — column applied on Neon production; migration `0003_tournaments_city.sql` |
| **P1** | 15 named indexes declared in Drizzle are missing in production | Optional `CREATE INDEX IF NOT EXISTS` (see below) |
| **P2** | Boot DDL does not cover many legacy base columns/tables | Hygiene only — production already has them |
| **Info** | Legacy `sessions` table exists in production, not in Drizzle | Leave as-is |
| **Enums** | No `pgEnum` usage in Drizzle | Nothing to sync |

**Tables:** 92+ in Drizzle ↔ 93 in production (extra = `sessions`).  
**Critical column drift:** **0** after P0 fix.  
**Governance:** see `docs/SCHEMA_DRIFT_PREVENTION_ADR.md`.

---

## P0 — Production column migration (RESOLVED)

### Drift (historical)

| Table | Column | Drizzle type | In production (now) | In boot DDL |
|-------|--------|--------------|---------------------|-------------|
| `tournaments` | `city` | `text("city")` nullable | **YES** | ensure path + migration |

Added in commit `691c181` (2026-07-13) without a matching `ALTER TABLE … ADD COLUMN` ensure.  
Any `db.select().from(tournamentsTable)` emits `city` → Postgres error → Express 500 HTML → Google OAuth catch redirects `?error=google_failed`.

### Applied to production

```sql
-- P0: sync Drizzle tournaments.city → production (applied 2026-07-13)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
```

### Apply to boot DDL (prevent regression)

Add to a future governance/migration path (System D is marked frozen — prefer an approved migration; until then, adding this ensure is the practical fix):

```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
```

Also recommend ensuring these tournament columns that exist in production + Drizzle but are **not** in `ensure-schema.ts` / System C (fresh DB risk):

```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_unit text NOT NULL DEFAULT 'rupee';
-- registration_fields_json already ensured in System C (lib/db/src/index.ts)
```

---

## P1 — Indexes in Drizzle missing from production

These do **not** cause 500s; they affect query performance / uniqueness expectations.

```sql
-- communication
CREATE INDEX IF NOT EXISTS ix_communication_assets_asset_type
  ON communication_assets (asset_type);
CREATE INDEX IF NOT EXISTS ix_communication_templates_event_type
  ON communication_templates (event_type);
CREATE INDEX IF NOT EXISTS ix_communication_templates_is_active
  ON communication_templates (is_active);
CREATE INDEX IF NOT EXISTS ix_communication_templates_is_draft
  ON communication_templates (is_draft);
CREATE INDEX IF NOT EXISTS ix_communication_template_versions_template_id
  ON communication_template_versions (template_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_channel
  ON communication_jobs (channel);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_template_id
  ON communication_jobs (template_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_entity
  ON communication_jobs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_next_retry_at
  ON communication_jobs (next_retry_at);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_pending_reason
  ON communication_jobs (pending_reason);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_bulk_campaign_id
  ON communication_jobs (bulk_campaign_id);
CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_role
  ON communication_job_recipients (recipient_role);
CREATE INDEX IF NOT EXISTS ix_communication_logs_action
  ON communication_logs (action);
CREATE INDEX IF NOT EXISTS ix_communication_logs_recipient_email
  ON communication_logs (recipient_email);

-- entity audit
CREATE INDEX IF NOT EXISTS ix_audit_logs_tournament
  ON audit_logs (tournament_id, performed_at);
```

Also add matching `CREATE INDEX IF NOT EXISTS` lines to boot DDL when governance allows.

**Note:** 50 other Drizzle-named indexes already exist in production but are not listed in boot DDL (boot coverage gap only — no prod action).

---

## P2 — Boot DDL coverage (not production-breaking today)

### Tables with zero boot CREATE/ALTER coverage

All **already exist in production**. Risk is **new empty databases** / restore from schema-only dumps.

| Table | Schema file | In production |
|-------|-------------|---------------|
| `auction_bid_events` | auction_events.ts | yes |
| `auction_player_events` | auction_events.ts | yes |
| `auction_timer_events` | auction_events.ts | yes |
| `bids` | bids.ts | yes |
| `bot_sessions` | comm.ts | yes |
| `categories` | categories.ts | yes |
| `comm_logs` | comm.ts | yes |
| `consent_blast_log` | comm.ts | yes |
| `consent_tokens` | comm.ts | yes |
| `display_auctions` | display-auctions.ts | yes |
| `notification_logs` | notifications.ts | yes |
| `otp_sessions` | comm.ts | yes |
| `player_import_logs` | player_import_logs.ts | yes |
| `role_spec_groups` | sports.ts | yes |
| `role_spec_options` | sports.ts | yes |
| `scoring_events` | scoring_events.ts | yes |
| `scoring_sessions` | scoring_sessions.ts | yes |
| `scoring_standings` | scoring_standings.ts | yes |
| `settings` | settings.ts | yes |
| `sms_notification_settings` | sms-settings.ts | yes |
| `sport_roles` | sports.ts | yes |
| `sports` | sports.ts | yes |
| `wa_consent_events` | comm.ts | yes |
| `wa_quality_log` | comm.ts | yes |
| `wa_templates` | comm.ts | yes |

### Partial boot coverage (noise filter)

`ensure-schema` / System C only `ADD COLUMN` for **newer** fields. Base columns (`id`, `name`, `created_at`, …) on tables like `tournaments`, `players`, `organizers`, `teams` are intentionally not re-listed.  

**True hygiene gaps** (in Drizzle + typically in prod, but never ensured in boot):

| Table | Columns missing from boot DDL (notable) |
|-------|----------------------------------------|
| `tournaments` | **`city`** (P0), `auction_unit` |
| `organizers` | `google_id`, `google_email`, sheets token columns are partially covered in System C; core identity cols are legacy |
| `branding_settings` | `main_logo_reverse_url` is in System C; most branding cols are legacy CREATE |

Do **not** treat every base column as a migration candidate — production already has them.

---

## Informational

### Production-only table: `sessions`

| Column | Type |
|--------|------|
| `sid` | varchar |
| `sess` | json |
| `expire` | timestamp |

Legacy session store. Not referenced by current JWT cookie auth (`bidwar_auth`). Safe to leave; optional later cleanup after confirming no traffic.

### Constraints / enums

- No Drizzle `pgEnum` definitions in the repo.
- Unique indexes that exist in both Drizzle and production were not re-audited for column-order mismatches beyond name presence.
- Foreign keys: boot DDL uses sparse `REFERENCES`; Drizzle often omits DB-level FKs. No P0 FK drift identified for the Google auth path.

---

## Recommended sync checklist

1. **[P0] Production:** run `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;`
2. **[P0] Code:** add the same ensure to the approved migration / boot path so deploys cannot regress.
3. **[P0 verify]:** `GET /api/auth/organizer-account/me` with a valid organizer cookie → 200 JSON (not HTML 500).
4. **[P0 verify]:** Google Sign-In → `/organizer?google_ok=1` (not `?error=google_failed`).
5. **[P1 optional]:** create the 15 missing communication/audit indexes.
6. **[P2 later]:** governance pass to document legacy tables as “pre-provisioned” vs expand boot DDL for greenfield installs.

---

## Method notes

- Drizzle column extraction parses `pgTable("…", { field: type("col") })` across all schema files.
- Boot coverage = any `ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS (…)` in System C/D.
- Production comparison uses live Neon `information_schema` / `pg_indexes`.
- **Critical** = in Drizzle, missing in production (breaks SELECT *).  
- **Boot gap** = in Drizzle, missing from boot DDL (may still be fine in prod).
