# System C Execution Analysis

> **Analysis only — no code, schema, or behaviour changes.**  
> Date: 2026-07-11  
> Baseline: [DATABASE_BOOT_BASELINE.md](./DATABASE_BOOT_BASELINE.md) (staging avg System C **4748 ms**)  
> Source of truth: `lib/db/src/index.ts` (frozen System C runtime DDL)

---

## 1. Why System C runs ~191 DDL statements every startup

System C is not a migration runner. It is a **module-load side effect**: importing `@workspace/db` immediately fires **24** `void systemCQuery(...)` batches. Each batch is a `pool.query(sql)` containing one or more SQL statements.

Those statements accumulated as **historical “ensure schema on boot” patches** so production/staging could pick up columns/tables/indexes without a separate migrate step. Almost all use `IF NOT EXISTS` / `IF EXISTS`, so on a current schema they **still execute**, but Postgres typically performs only **catalog checks** (no table rewrite). Metrics still count every statement.

**Baseline classifier totals (matches staging Diagnostics):**

| Category | Count | Role in the “191 DDL” figure |
|----------|------:|------------------------------|
| CREATE TABLE | 35 | DDL |
| ALTER TABLE | 71 | DDL |
| CREATE INDEX | 83 | DDL |
| DROP (TABLE/INDEX/COLUMN) | 2 | DDL |
| **DDL subtotal** | **191** | User baseline “191 DDL” |
| DML (UPDATE/INSERT/DELETE) | 10 | Extra boot work (not DDL) |
| **Classified total** | **201** | Same heuristics as `classifySqlStatements` in `boot-metrics.ts` |

Also: **System B** (`scripts/src/migrate.ts`) and **System D** (`ensureCoreSchema`) repeat overlapping ensures. System C alone still re-checks its full list every process start.

---

## 2. Execution model

| Item | Detail |
|------|--------|
| **File** | `lib/db/src/index.ts` |
| **Entry** | Module top-level `void systemCQuery(...)` (lines ~56–972) |
| **Function** | `systemCQuery` → `observeSystemCQuery` → `pool.query(sql)` |
| **Await before listen?** | No — fire-and-forget; API can listen while C is still running |
| **Batches** | 24 parallel-registered queries (pool `max: 10` → contention) |
| **Finalize** | `finalizeSystemCTracking()` after last registration |
| **Wall-clock measured** | First C query start → all C promises settled (~4.3–5.2 s on staging) |

**Implication for timing:** Category estimates below are **attribution shares of System C wall-clock**, calibrated to staging avg **4748 ms**. They are not sequential sums (batches overlap on the pool).

---

## 3. Category time contribution (estimated)

Calibration: staging baseline avg System C = **4748 ms**.  
Relative weights (catalog / index / scan heuristics): CREATE TABLE 1.0 · ALTER 1.25 · CREATE INDEX 1.55 · DROP 0.9 · DML 2.2.

| Category | Statements | Estimated wall-clock share | Notes |
|----------|----------:|---------------------------:|-------|
| **CREATE TABLE** | 35 | **~600 ms** | `IF NOT EXISTS` → catalog probe when table exists |
| **ALTER TABLE** | 71 | **~1530 ms** | Mostly `ADD COLUMN IF NOT EXISTS`; one `SET NOT NULL` |
| **CREATE INDEX** | 83 | **~2210 ms** | Largest DDL class; each `IF NOT EXISTS` still hits catalogs |
| **DROP** | 2 | **~30 ms** | `DROP INDEX IF EXISTS`; `DROP COLUMN` inside DO (legacy) |
| **DML** | 10 | **~380 ms** | Backfills / dedupe / INSERT…SELECT (often 0 rows when current) |
| **Total** | 201 | **~4748 ms** | Matches baseline avg |

### Example (requested shape)

| Category | Statements | Estimated |
|----------|----------:|----------:|
| CREATE TABLE | 35 | ~600 ms |
| ALTER TABLE | 71 | ~1530 ms |
| CREATE INDEX | 83 | ~2210 ms |
| DROP | 2 | ~30 ms |
| DML | 10 | ~380 ms |

**Largest batch groups (share of System C time):**

| Rank | Batch | ~Line | Est. share | Contents |
|-----:|------:|------:|-----------:|----------|
| 1 | 19 | 542 | ~1270 ms | Master Sports Core (ALTER + CREATE + INDEX + heavy DML) |
| 2 | 20 | 729 | ~910 ms | Cricket scoring Phase 1 schema |
| 3 | 16 | 322 | ~640 ms | Badminton schema (8 tables + indexes) |
| 4 | 8 | 108 | ~365 ms | Registration payment / declaration ALTERs |
| 5 | 24 | 933 | ~205 ms | Admin notifications |

---

## 4. Duplicate detection

### 4.1 Exact duplicated DDL inside System C

**None.** No two System C statements are byte-identical. No duplicate CREATE INDEX **names**. No duplicate `ALTER … ADD COLUMN IF NOT EXISTS` for the same `table.column` within System C.

### 4.2 Semantic / self-duplication (CREATE then ALTER same columns)

These ALTERs re-add columns **already defined in a CREATE TABLE in the same System C file**. After first install they are always no-ops:

| Column | CREATE defines it | ALTER also runs |
|--------|-------------------|-----------------|
| `platform_audit_events.critical_tags_json` | Yes (batch 12) | Yes (same batch) |
| `platform_audit_events.monitoring_flags_json` | Yes | Yes |
| `master_sponsors.is_title_sponsor` | Yes (batch 19) | Yes (same batch) |
| `master_sponsors.is_co_sponsor` | Yes | Yes |
| `master_sponsors.sponsor_priority` | Yes | Yes |
| `master_sponsors.priority_type` | Yes | Yes |
| `admin_notification_settings.live_notifications_enabled` | Yes (batch 24) | Yes |
| `admin_notification_settings.notification_sound_enabled` | Yes | Yes |
| `admin_notifications.category` | Yes | Yes |

**9 ALTER statements** are redundant with CREATE in the same file (historical “add column after table already shipped with column” patches left in place).

### 4.3 Cross-system duplication (System C ∩ System B migrate)

Same ensures appear in **System B** (`scripts/src/migrate.ts`) and System C:

**Tables:** `creative_jobs`, `platform_audit_events`, `purse_boosters`  
**ALTER ADD COLUMN (examples):** `teams.owner_photo_url`, `teams.owner_email`, `players.email`, `auction_sessions.last_purse_booster_json`, `last_led_toast_json`, `random_draw_queue`, `platform_audit_events.critical_tags_json`, `monitoring_flags_json`

### 4.4 Cross-system duplication (System C ∩ System D ensureCoreSchema)

| Kind | Overlap count | Examples |
|------|--------------:|----------|
| CREATE TABLE | 1 | `branding_assets` |
| CREATE INDEX | 1 | `branding_assets_asset_type_active_idx` |
| ALTER ADD COLUMN | 15 | Registration payment columns on `tournaments`; several `auction_sessions.*` |

System D adds **more** tournament/organizer/auction ensures that System C does not duplicate — but the 15 overlapping ALTERs run in **both** C and D every boot.

### 4.5 Duplicated CREATE INDEX statements

- **Within System C:** no duplicate index **names**.
- **Across C/D:** one shared index name (`branding_assets_asset_type_active_idx`).
- **Redundant coverage (not exact duplicates):** e.g. `ix_creative_jobs_tournament_id` + `ix_creative_jobs_tournament_created` both keyed on `tournament_id` (second is composite); badminton/scoring tables often have both table-wide and FK indexes — intentional for queries, not copy-paste duplicates.

---

## 5. Statements that always run but cannot change a current schema

On staging (schema already current), effectively:

| Class | Count | Behaviour when schema current |
|-------|------:|--------------------------------|
| `CREATE TABLE IF NOT EXISTS` | 35 | Exists → no create |
| `CREATE INDEX IF NOT EXISTS` | 83 | Exists → no build |
| `ALTER … ADD COLUMN IF NOT EXISTS` | ~69 | Exists → no add |
| `DROP INDEX IF EXISTS` (legacy name) | 1 | Missing → no drop |
| DO block (`referee_name` migration) | 1 | Column gone → IF branch skipped |
| DML with `WHERE … IS NULL` / `NOT EXISTS` | most of 10 | **0 rows** updated/inserted when backfill complete |

**~188** System C statements are explicitly idempotent DDL.  
**~191 DDL** catalog operations still run every startup even when nothing changes.

Exceptions that can still mutate data on a “current” DB only if residual bad rows exist:

1. `UPDATE teams … access_code` where blank  
2. `UPDATE badminton_match_details … scorer_pin` where blank  
3. `DELETE` / `UPDATE` dedupe on `player_team_assignments`  
4. `INSERT … SELECT` into `tournament_player_profiles` for missing rows  

On a clean staging baseline these typically affect **0 rows** but still pay planning/scan cost.

---

## 6. Top 20 most expensive startup operations (estimated)

Estimates = weighted share of **4748 ms** System C average, with extra weight for scanning DML. Rank is relative, not measured per-statement.

| Rank | Est. | Category | Batch / line | Operation |
|-----:|-----:|----------|--------------|-----------|
| 1 | ~150 ms | DML | 19 / ~661 | `DELETE FROM player_team_assignments` self-join dedupe |
| 2 | ~130 ms | DML | 19 / ~668 | `UPDATE player_team_assignments` deactivate duplicate actives |
| 3 | ~130 ms | DML | 9 / ~146 | `UPDATE players SET serial_no = id WHERE serial_no IS NULL` |
| 4 | ~110 ms | DML | 19 / ~707 | `INSERT INTO tournament_player_profiles … SELECT` from badminton |
| 5 | ~95 ms | DML | 14 / ~283 | `UPDATE teams` backfill blank `access_code` |
| 6 | ~95 ms | DML | 18 / ~532 | `UPDATE badminton_match_details` backfill `scorer_pin` |
| 7 | ~85 ms | DML+DDL | 9 / ~135 | `WITH ranked … UPDATE players` serial_no window backfill |
| 8 | ~50 ms | DO_BLOCK | 17 / ~510 | `information_schema` probe + conditional DROP COLUMN |
| 9 | ~45 ms | ALTER | 9 / ~148 | `ALTER players … serial_no SET NOT NULL` |
| 10 | ~40 ms | DML | 17 / ~520 | Conditional `UPDATE … umpire_name = referee_name` (inside DO) |
| 11–20 | ~27 ms each | CREATE INDEX | 16 & 20 | Individual `CREATE INDEX IF NOT EXISTS` on badminton/scoring tables (catalog checks; many similar) |

**Takeaway:** A handful of **legacy data backfills** dominate per-statement cost; the **volume** cost is **83 CREATE INDEX + 71 ALTER** catalog checks.

---

## 7. Per-statement requirements (summary matrix)

Common answers for **almost all** System C DDL:

| Question | Typical answer |
|----------|----------------|
| **File** | `lib/db/src/index.ts` |
| **Function** | `systemCQuery` (module init) |
| **Why it exists** | Ship schema without requiring operators to run migrate |
| **Required for app correctness today?** | Schema objects are required; **re-running ensures every boot is not required** once schema is governed |
| **Runs every startup?** | **Yes** |
| **Idempotent?** | **Yes** for DDL (`IF NOT EXISTS` / `IF EXISTS`) |
| **Could it still change anything after initial install?** | DDL: only if object missing. DML: only if matching residual rows |

### CREATE TABLE (35) — all required objects; re-ensure not required each boot

`branding_assets`, `player_spec_values`, `player_sport_profiles`, `platform_audit_events`, `purse_boosters`, `creative_jobs`, 8× badminton_*, 7× master-sports related, 10× scoring_*, `contact_inquiries`, `google_sheet_syncs`, `admin_notification_settings`, `admin_notifications`.

### ALTER TABLE (71) — feature columns

Clusters: registration payment/declaration; player contact fields; audit JSON columns; auction session LED/revision; global_players master fields; scoring fixture/match columns; organizer Google Sheets tokens; admin notification flags.  
Several overlap System B/D. Nine overlap CREATE in the same file.

### CREATE INDEX (83) — query support

Mostly `ix_*` / `uq_*` on new feature tables. Required for performance; **recreating/checking every boot is not**.

### DROP (2)

1. `DROP INDEX IF EXISTS uq_pta_player_team_tournament` — legacy rename cleanup.  
2. `DROP COLUMN referee_name` inside DO — one-shot rename to `umpire_name`.

### DML (10)

One-shot / residual backfills (serial_no, access_code, scorer_pin, PTA dedupe, profile INSERT). Should be **migration-time only**, not every process start.

---

## 8. Recommendations — move to versioned migrations (do not implement here)

Priority = (runs every boot) × (cost) × (safe to make one-shot).

### P0 — Stop running every boot (highest value)

1. **All scanning DML** (serial_no backfill, access_code fill, scorer_pin fill, PTA DELETE/UPDATE, tournament_player_profiles INSERT).  
2. **DO block referee_name → umpire_name** (one-shot; already skipped when column absent).  
3. **`DROP INDEX IF EXISTS uq_pta_player_team_tournament`**.

### P1 — Large schema islands → System B versioned migrations only

4. **Batch 19 Master Sports Core** (biggest batch).  
5. **Batch 20 Cricket scoring Phase 1**.  
6. **Batch 16 Badminton schema**.  
7. **Batch 15 creative_jobs**, **12 platform_audit_events**, **13 purse_boosters** (already partly in System B — consolidate, don’t dual-run).

### P2 — Column drip ALTERs → single migrate revision

8. Registration payment/declaration ALTERs (also duplicated in System D).  
9. `global_players` / organizer Google Sheets / admin notification ALTERs.  
10. Remove **CREATE+same-column ALTER** pairs (9 redundant ALTERs).

### P3 — Governance end-state

11. System C becomes **empty or read-only assert** (“schema revision ≥ N”) instead of applying DDL.  
12. System D slimmed to the same revision gate (or removed once migrate is mandatory in deploy).  
13. Keep Drizzle `schema/*` as the type source of truth; migrations as the only applicator.

---

## 9. Machine-readable inventory

| Artifact | Contents |
|----------|----------|
| `artifacts/system-c-inventory.csv` | One row per parsed statement (category, batch, line, object, preview) |
| `artifacts/system-c-inventory-raw.json` | Full JSON inventory |
| Appendix below | Human-readable inventory by batch |

**Counting note:** Statement splitter yields ~199 structural statements; baseline regex on raw SQL yields **201** classified tokens (DO block contributes nested `UPDATE` + `DROP COLUMN`). Both describe the same System C source.

---

## 10. Complete inventory by batch

Each batch: **file** `lib/db/src/index.ts` · **function** `systemCQuery` · **runs every startup** yes · **idempotent** as marked.

### Batch 1 — line ~56

- **Purpose:** Ensure `teams.owner_photo_url` for team branding  
- **Why:** Feature column shipped without migrate  
- **Required object:** yes · **Re-run needed every boot:** no · **Post-install mutable:** only if column missing  
- Statements: 1× ALTER `teams.owner_photo_url` (idempotent; also in System B)

### Batch 2 — line ~61

- **Purpose:** `branding_settings.main_logo_reverse_url`  
- Statements: 1× ALTER (idempotent)

### Batch 3 — line ~66

- **Purpose:** Branding asset store  
- Statements: CREATE `branding_assets`; UNIQUE INDEX `branding_assets_asset_type_active_idx`  
- Overlap: System D recreates same table/index

### Batch 4–7 — lines ~88–103

- **Purpose:** Player/team contact fields  
- Statements: ALTER `players.email`, `players.gender`, `players.jersey_size`, `teams.owner_email`  
- `email` / `owner_email` also in System B

### Batch 8 — line ~108

- **Purpose:** Registration payment, declaration, bid-value mode columns  
- Statements: **17× ALTER** on `tournaments` / `players`  
- Heavy overlap with System D registration ALTERs  
- Est. share ~365 ms

### Batch 9 — line ~132

- **Purpose:** Tournament-scoped `players.serial_no`  
- Statements: ALTER add column; WITH/UPDATE backfill; UPDATE fallback; ALTER SET NOT NULL; UNIQUE INDEX `(tournament_id, serial_no)`  
- DML is one-shot backfill left on the hot path — top cost contributor

### Batch 10 — line ~158

- **Purpose:** Multi-sport `player_spec_values`  
- Statements: CREATE TABLE + 3 indexes (1 unique)

### Batch 11 — line ~177

- **Purpose:** `player_sport_profiles`  
- Statements: CREATE TABLE + 3 indexes

### Batch 12 — line ~197

- **Purpose:** `platform_audit_events`  
- Statements: CREATE TABLE; 2 indexes; 2 ALTER JSON columns (**redundant with CREATE**)  
- Also created/altered in System B

### Batch 13 — line ~242

- **Purpose:** Purse boosters + auction session LED/revision fields  
- Statements: CREATE `purse_boosters`; 1 index; 5 ALTER on `auction_sessions`  
- Overlap System B/D on several auction columns

### Batch 14 — line ~283

- **Purpose:** Backfill blank team access codes  
- Statements: 1× UPDATE teams (DML every boot; no-op when all codes set)

### Batch 15 — line ~292

- **Purpose:** `creative_jobs` render queue  
- Statements: CREATE TABLE + 4 indexes  
- Also in System B

### Batch 16 — line ~322

- **Purpose:** Badminton tournament management  
- Statements: **8 CREATE TABLE** + **~19 CREATE INDEX**  
- Est. share ~640 ms — third largest batch

### Batch 17 — line ~510

- **Purpose:** Rename `referee_name` → `umpire_name`  
- Statements: DO $$ … UPDATE … DROP COLUMN … $$  
- After migration: always no-op branch; still pays `information_schema` lookup

### Batch 18 — line ~532

- **Purpose:** Backfill scorer PINs  
- Statements: 1× UPDATE (DML every boot)

### Batch 19 — line ~542

- **Purpose:** Master Sports Core  
- Statements: many ALTER on `global_players` / links; CREATE master_* / PTA / stats / mappings / sync_log / tournament_player_profiles; indexes; DROP legacy index; DELETE/UPDATE PTA; INSERT profiles  
- **Largest batch (~1270 ms share)** — mix of forever-DDL-checks + residual DML

### Batch 20 — line ~729

- **Purpose:** Cricket scoring Phase 1  
- Statements: 10 CREATE TABLE + indexes + ALTER `scoring_fixtures` / `scoring_matches`  
- Est. share ~910 ms — second largest

### Batch 21 — line ~878

- **Purpose:** Website `contact_inquiries`  
- Statements: CREATE TABLE + 3 indexes

### Batch 22 — line ~901

- **Purpose:** Organizer Google Sheets OAuth columns  
- Statements: 4× ALTER `organizers`

### Batch 23 — line ~912

- **Purpose:** `google_sheet_syncs`  
- Statements: CREATE TABLE + unique index on `tournament_id`

### Batch 24 — line ~933

- **Purpose:** Admin notification settings + inbox  
- Statements: 2 CREATE TABLE; 4 indexes; 3 ALTER (**redundant with CREATE** for 3 columns)

---

## 11. Full statement appendix

The line-by-line table for all ~199 parsed statements (category, idempotency, preview) is generated at:

- [artifacts/system-c-inventory-appendix.md](./artifacts/system-c-inventory-appendix.md)  
- [artifacts/system-c-inventory.csv](./artifacts/system-c-inventory.csv)

---

## 12. Conclusion

System C executes ~191 DDL statements every startup because **the entire historical ensure-schema patch list is re-applied on module import**, not because the schema is incomplete. Staging proof: Diagnostics shows **0 startup failures** and stable DDL counts while wall-clock stays **~4.3–5.2 s**, dominated by **CREATE INDEX** and **ALTER** catalog work plus a few leftover **backfill DML** statements.

No optimisation was performed in this document. Next engineering step (separate change control): move one-shot DML and frozen DDL into **versioned System B migrations** and replace System C with a revision assertion.
