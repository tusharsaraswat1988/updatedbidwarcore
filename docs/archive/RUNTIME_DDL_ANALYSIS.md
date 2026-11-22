# BidWar Runtime DDL Analysis

> Phase 1 read-only. Inspects every runtime `CREATE TABLE` / `ALTER TABLE` / related DDL that executes without an explicit migrate/push CLI.

---

## Two runtime mechanisms

| ID | Location | Trigger | Awaited? | Frequency |
|----|----------|---------|----------|-----------|
| **C** | `lib/db/src/index.ts` | Module import of `@workspace/db` | **No** (`void pool.query`) | Every API start + every importing script |
| **D** | `lib/db/src/ensure-schema.ts` via `ensureCoreSchema(pool)` | API `start()` before listen | **Yes** | Every API start |

Neither is gated by env flags. Both use mostly idempotent `IF NOT EXISTS` patterns.

---

## System C — `lib/db/src/index.ts` inventory

Approximate statement counts in this file: **35** `CREATE TABLE`, **71** `ALTER TABLE`, **83** index creates, **1** `DROP INDEX`, **1** `DROP COLUMN`, plus DML.

### CREATE TABLE IF NOT EXISTS (why it exists)

| Object | Why present | Still needed? | Notes |
|--------|-------------|---------------|-------|
| `branding_assets` | Heal DBs predating asset library | Redundant with A+D | Also in D |
| `player_spec_values` | Multi-sport sprint; includes **FK REFERENCES** | Needed until push always run; FK not in Drizzle | Unique + indexes |
| `player_sport_profiles` | Same; **FK REFERENCES** | Same | |
| `platform_audit_events` | Audit trail before migrate/push caught up | Overlaps B+A | Subset of B indexes |
| `purse_boosters` | Local/cloud purse boost feature | Overlaps B+A | |
| `creative_jobs` | Buzz Studio queue | Overlaps B+A | |
| 8× `badminton_*` | Badminton module bootstrap | Overlaps A | Large block |
| `master_sponsors`, `master_teams`, `player_team_assignments`, `player_statistics`, `master_player_id_mappings`, `master_sports_sync_log` | Master sports core | Overlaps A+V | Includes data repair |
| `tournament_player_profiles` | Badminton/master identity overlay | Overlaps A | Followed by INSERT backfill |
| Cricket scoring phase-1 tables (venues, officials, draws, groups, members, squads, match_player_stats, leaderboard, awards, dls) | Scoring expansion beyond migrate foundation | Overlaps A | Also ALTERs fixtures/matches |
| `contact_inquiries` | Public contact form | Overlaps A | |
| `google_sheet_syncs` | Sheets sync | Overlaps A | |
| `admin_notification_settings`, `admin_notifications` | Admin inbox | Overlaps A | |

### ALTER TABLE ADD COLUMN IF NOT EXISTS (representative)

| Target | Columns / purpose | Duplicated in |
|--------|-------------------|---------------|
| `teams` | owner_photo_url, owner_email, master_team_id | B, D (partial) |
| `players` | email, gender, jersey_size, payment fields, serial_no, photo originals | B, D |
| `tournaments` | registration payment/declaration/bid_value/fields | D (partial) |
| `branding_settings` | main_logo_reverse_url | — |
| `auction_sessions` | last_purse_booster/led/random/revision/re_auction | B, D |
| `global_players` | profile expansion columns | V, D (photo) |
| `badminton_players` | master_player_id | V |
| `organizers` | google sheets OAuth columns | — |
| `scoring_fixtures` / `scoring_matches` | draw/group/venue/officials | — |
| `player_team_assignments` / `player_statistics` / `master_sponsors` | evolutionary columns | V |
| `admin_*` | live/sound/category columns | — |

### Non-DDL runtime mutations (same import path)

| Statement | Purpose | Risk |
|-----------|---------|------|
| `UPDATE players` serial_no backfill + `SET NOT NULL` | Assign display serials | Locks / rewrite on large tables |
| `CREATE UNIQUE INDEX uq_players_tournament_serial_no` | Enforce uniqueness | Fails if duplicates exist |
| `UPDATE teams` access_code fill | Security gate backfill | Contends with writes |
| DO block `DROP COLUMN referee_name` | Legacy rename | Catalog lock; one-time |
| `UPDATE badminton_match_details` scorer_pin | PIN backfill | Write load |
| `DROP INDEX uq_pta_player_team_tournament` | Replace uniqueness model | |
| `DELETE` duplicate `player_team_assignments` | Dedupe | Data loss if logic wrong |
| `UPDATE` deactivate extra active cricket assignments | Enforce one active roster | |
| `CREATE UNIQUE INDEX uq_pta_active_roster` (partial) | New uniqueness | Build lock |
| `INSERT INTO tournament_player_profiles … SELECT` from badminton | Backfill | Idempotent NOT EXISTS |

### Does System C run every startup?

**Yes**, on every evaluation of `lib/db/src/index.ts` (once per process). Postgres still executes each statement; `IF NOT EXISTS` makes most no-ops after first success, but each statement still costs a round-trip / catalog check.

### Startup latency (System C)

- **Not measured in-repo** (no timers around the `void` queries).
- Lower bound: dozens of sequential/parallel pool queries against Neon (network RTT × statement count). Cold Neon compute adds seconds.
- Upper bound risk: unique index builds or large `UPDATE`s on hot tables can take **seconds to minutes**.
- Because queries are fire-and-forget, wall-clock to `listen` is dominated by System D + seeds, **not** by waiting for C — but C still consumes pool connections and can lock tables during early traffic.

---

## System D — `ensureCoreSchema` inventory

Awaited batches:

1. **tournaments** — registration, bid extension, cheer, local mode, export tokens, features, scoring columns  
2. **organizers** — whatsapp consent + photo  
3. **auction_sessions** — random/obs/re_auction/countdown/purse/led/last_outcome/revision  
4. **branding_assets** table + unique index  
5. **intelligence_archives** + 3 child tables (with FK CASCADE)  
6. **communication_*** seven tables + indexes  
7. **Cloudinary public_id columns** across players/teams/tournaments/organizers/global/badminton/branding/showcase/tpp + tpp auction fields  
8. **bulk_import_*** / **audit_logs** / **workbook_*** / **photo_source_assets** (+ many photo-item ALTERs)  
9. **owner_sessions** / **push_subscriptions** (+ verified columns)  
10. **academy_categories** / **academy_lessons**

### Why it exists

Comment in file: *“Idempotent column/table ensures for production DBs that predate newer schema fields. Drizzle SELECT * fails when a mapped column is missing — this runs before the API listens.”*

### Still needed?

**Operationally yes today**, because deploy docs do not guarantee `db:push`/`migrate` on every release, and System C is unawaited. Architecturally it duplicates A/B/C.

### Latency

- Blocks listen.  
- Multiple large multi-statement queries.  
- On warm DB with all objects present: typically modest (catalog checks).  
- On cold Neon or first boot after feature add: can be material (index creates, table creates).

---

## Production risks (runtime DDL)

| Risk | Mechanism | Severity |
|------|-----------|----------|
| Race between C and D on same objects | Concurrent IF NOT EXISTS | Medium (usually OK) |
| Multi-instance rolling deploy | Two pods both DDL + UPDATE/DELETE | **High** for DML blocks in C |
| Unique index create while app writes | C/D index builds | High |
| `SET NOT NULL` on `serial_no` | Fails or locks if nulls/dupes | High |
| Unawaited C errors | Only logged; app may listen with missing objects if D didn’t cover them | High |
| DROP COLUMN during traffic | referee_name migration | Medium (rare after first run) |
| Pool exhaustion | Many parallel void queries at import | Medium |
| Schema drift vs Drizzle | Runtime adds FKs/partial indexes Drizzle doesn’t know | Medium (push may try to reconcile oddly) |

---

## Can runtime DDL race another deployment?

**Yes.**

- Render/multi-instance: overlapping boots.  
- Operator runs `db:push` while API restarts: push transactions vs IF NOT EXISTS DDL.  
- Operator runs `migrate.ts` while System C backfills `player_team_assignments`: write conflicts.

Most DDL is defensive; **DML inside System C is the dangerous part under concurrency.**

---

## Overlap matrix (same object, multiple runtime/CLI creators)

| Object | C | D | B | A |
|--------|---|---|---|---|
| branding_assets | ✓ | ✓ | | ✓ |
| platform_audit_events | ✓ | | ✓ | ✓ |
| purse_boosters | ✓ | | ✓ | ✓ |
| creative_jobs | ✓ | | ✓ | ✓ |
| intelligence_* | | ✓ | ✓ | ✓ |
| academy_* | | ✓ | ✓ | ✓ |
| communication_* | | ✓ | | ✓ |
| owner_sessions / push | | ✓ | | ✓ |
| badminton_* | ✓ | (cols) | | ✓ |
| master sports set | ✓ | (cols) | | ✓ |
| scoring foundation | (phase1 extras) | | ✓ | ✓ |
| tournaments columns | ✓ | ✓ | ✓ | ✓ |
| auction_sessions columns | ✓ | ✓ | ✓ | ✓ |

---

## Verdict on necessity

| Mechanism | Needed for current deploy model? | Needed if push+migrate were mandatory & complete? |
|-----------|----------------------------------|---------------------------------------------------|
| System C DDL | Yes (de facto production migrator) | No (except intentional one-off data backfills) |
| System C DML backfills | Only until data healed | No |
| System D | Yes (blocks listen for ORM safety) | No if A covers all mapped columns |

Phase 1 does not recommend removal — only documents this dependency.
