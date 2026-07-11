# System C Governance Report

> **Evidence only. No implementation. No refactoring. No deletion.**  
> Date: 2026-07-11  
> Companion: [SYSTEM_C_EXECUTION_ANALYSIS.md](./SYSTEM_C_EXECUTION_ANALYSIS.md) · [DATABASE_FREEZE_REPORT.md](./DATABASE_FREEZE_REPORT.md) · [DATABASE_BOOT_BASELINE.md](./DATABASE_BOOT_BASELINE.md)

---

## 1. Why System C exists (historical answer)

System C is the **“ship schema with the deploy”** pattern BidWar used while iterating features on Render/Neon without a reliable, mandatory migrate step in every environment.

### Evidence of the pattern’s intent

| Evidence | Source |
|----------|--------|
| Comment on earliest column ensures | `lib/db/src/index.ts`: *“Idempotent column adds so new fields persist without a manual migrate step.”* |
| Feature docs treat boot DDL as safe additive deploy | `docs/REGRESSION_AUDIT.md` §2.5 — badminton block described as `void pool.query` + `IF NOT EXISTS`, cannot crash server |
| Same file also hosts one-shot data backfills | Access-code fill, serial_no fill, scorer_pin fill, PTA dedupe — left on import path so **already-deployed DBs** heal after code push |
| Parallel systems grew for the same problem | System B (`scripts/src/migrate.ts`) and System D (`ensureCoreSchema`) — same “ensure” idea, different triggers |

### Timeline of System C growth (Jun–Jul 2026)

| Period | What was added via System C |
|--------|-----------------------------|
| ~2026-06-07 | Column drip: owner photo/email, player email |
| 2026-06-08 | Audit log, purse boosters, badminton tables |
| 2026-06-09 | Master Sports Core, cricket scoring foundation |
| 2026-06-14–17 | Gender, jersey, registration payment/declaration/bid value, branding reverse logo, contact form |
| 2026-06-18 | Creative jobs, badminton broadcast/scorer PIN |
| 2026-06-24–27 | Branding assets, multi-sport specs/profiles, serial_no index, Google Sheets |
| 2026-06-26 | Team access_code backfill (secure bidding) |
| 2026-06-30 | Re-auction strategy column (auction_sessions) |
| 2026-07-03 | Admin notifications |
| 2026-07-11 | Freeze + metrics wrapper (`systemCQuery`) — **behaviour unchanged** |

**Governance conclusion:** System C exists because **feature velocity outran migration discipline**. It is not a designed long-term schema engine; it is an accumulated compatibility layer so `git push` → Render deploy would not leave API code selecting columns/tables that Neon did not yet have.

---

## 2. Method (this report)

| Step | What was done |
|------|----------------|
| Batch map | 24 `void systemCQuery` batches in `lib/db/src/index.ts` (see Execution Analysis) |
| Introducing commit | `git log -S <distinctive SQL>` on `lib/db/src/index.ts` (freeze commit rewrote blame; pickaxe used) |
| Current usage | Code search in `artifacts/api-server`, `artifacts/auction-platform`, `lib/db/src/schema`, plus feature flags |
| Placement | Recommendation only — **not implemented** |

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| **Active** | Product surface still ships; runtime reads/writes schema |
| **Partially used** | Schema or subset still referenced; primary path may have moved |
| **Legacy** | One-shot migration / superseded path; safe residual only |
| **Dead** | No runtime dependency found |

**Placement vocabulary**

| Placement | Meaning |
|-----------|---------|
| **Runtime boot** | Must run every process start (almost nothing in System C qualifies long-term) |
| **Versioned migration** | Apply once per environment via System B / future migrate pipeline |
| **One-time installer** | Fresh DB bootstrap / `db:setup` only |
| **Legacy archive** | Keep record; do not re-execute (completed data migrations) |

---

## 3. Batch-by-batch governance

### Batch 1 — `teams.owner_photo_url` (~L56)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `5b167f6` (2026-06-07) — *Validate Indian mobiles and improve tournament/org UX* |
| **Feature** | Team owner photo on team records / reports / notifications |
| **Still used today?** | **Yes** — `routes/teams.ts`, `pages/teams.tsx`, team reports, notification payloads; schema `lib/db/src/schema/teams.ts` |
| **Status** | **Active** |
| **Runtime depends on schema?** | Yes — Drizzle/API select/update owner photo |
| **If removed (DDL ensure only)** | Existing DBs keep column; **new** DBs without migrate would break photo upload/reports |
| **If column dropped** | Team photo UI, PDF reports, owner emails break |
| **Belongs in** | **Versioned migration** (also already mirrored in System B). Not runtime boot. |

---

### Batch 2 — `branding_settings.main_logo_reverse_url` (~L61)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `29cb548` (2026-06-17) — *Unify branding-driven assets and legal routing* |
| **Feature** | Dark/reverse logo URL on legacy branding settings row |
| **Still used today?** | **Partial** — `branding-service.ts` legacy sync; hooks still aware; primary path is `branding_assets` |
| **Status** | **Partially used** (fallback / legacy column beside asset library) |
| **Runtime depends?** | Soft dependency — reverse logo falls back if asset missing |
| **If removed** | Reverse logo may blank until assets populated; admin branding largely OK |
| **Belongs in** | **Versioned migration**; column retention until branding_assets fully canonical. Not boot. |

---

### Batch 3 — `branding_assets` + unique index (~L66)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `da34469` (2026-06-24) — *Integrate branding assets across apps…* |
| **Feature** | Admin branding asset library (logos, favicon, etc.) |
| **Still used today?** | **Yes** — `branding-service.ts`, `routes/branding.ts`, `admin-branding.tsx`, schema `branding-assets.ts` |
| **Status** | **Active** |
| **Runtime depends?** | Yes — core admin branding + email/PWA logos |
| **If removed** | Admin asset library and branding resolution break; System D also ensures this table |
| **Belongs in** | **Versioned migration** / **one-time installer** for empty DBs. Duplicate of System D ensure — not boot. |

---

### Batch 4 — `players.email` (~L88)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `9755acd` (2026-06-07) — *Add optional player/owner email fields…* |
| **Feature** | Player email for registration & sold/comms emails |
| **Still used today?** | **Yes** — players routes/UI, `player-sold-email-service.ts`, exports |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Registration, sold emails, exports break on missing column |
| **Belongs in** | **Versioned migration** (also in System B). Not boot. |

---

### Batch 5 — `players.gender` (~L93)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `47f4572` (2026-06-14) — *Add player gender, consistent serial numbers…* |
| **Feature** | Player gender on registration, filters, scoring avatars |
| **Still used today?** | **Yes** — players UI, register, workbook import, reports, scoring UI |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Player CRUD/filters/import/LED portraits break |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 6 — `players.jersey_size` (~L98)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `ea7522f` (2026-06-16) — *Add player jersey size and city fields…* |
| **Feature** | Jersey size on registration/reports |
| **Still used today?** | **Yes** — register/players UI, admin/team reports, `registration-fields.ts` |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Jersey fields/reports break |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 7 — `teams.owner_email` (~L103)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `9755acd` (2026-06-07) — same email-fields commit as Batch 4 |
| **Feature** | Team owner email for comms / recovery |
| **Still used today?** | **Yes** — teams routes/UI, communication dashboard |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Team owner email flows break |
| **Belongs in** | **Versioned migration** (also System B). Not boot. |

---

### Batch 8 — Registration payment / declaration / bid-value columns (~L108)

| Field | Evidence |
|-------|----------|
| **Introduced by** | Layered: payment (`5271420` 2026-06-16), declaration (`0421d36` 2026-06-16), bid value (`10fc548` 2026-06-17) — SQL now one batch |
| **Feature** | Paid registration, declaration consent, player-selected bid values |
| **Still used today?** | **Yes** — tournament settings, `/player-register`, `registration-payment.ts`, `bid-value.ts` |
| **Status** | **Active** |
| **Runtime depends?** | Yes — tournament + player columns |
| **If removed** | Public registration payment/declaration/bid-value modes break; System D also ensures many of these |
| **Belongs in** | **Versioned migration**. Deduplicate with System D. Not boot. |

---

### Batch 9 — `players.serial_no` backfill + unique index (~L132)

| Field | Evidence |
|-------|----------|
| **Introduced by** | Gender/serial work `47f4572` (2026-06-14); unique index / ensure block solidified in multi-sport era (`096eaf6` 2026-06-25 pickaxe on index name) |
| **Feature** | Tournament-scoped display serial # for auction order |
| **Still used today?** | **Yes** — `player-serial.ts`, auction operator, LED/selection |
| **Status** | **Active** schema; **Legacy** backfill DML (one-shot for NULL serials) |
| **Runtime depends?** | Column + unique index: yes. Boot UPDATE: only if NULL rows remain |
| **If ensure removed after migrate** | OK if column/index already present. If column dropped: auction serial ordering breaks |
| **Belongs in** | Column/index → **versioned migration**. Backfill UPDATE → **legacy archive** / one-time migrate. **Not** runtime boot. |

---

### Batch 10 — `player_spec_values` (~L158)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `096eaf6` (2026-06-25) — *Add multi-sport player specs, sport profiles…* |
| **Feature** | Role/spec group values (multi-sport Sprint 1) |
| **Still used today?** | **Yes** when `PLAYER_SPECS_V2_ENABLED` (default ON) — specification service, players/register UI |
| **Status** | **Active** (flag-gated, default on) |
| **Runtime depends?** | Yes when flag on; legacy player columns when off |
| **If removed** | Spec V2 registration/LED fields break under default flags |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 11 — `player_sport_profiles` (~L177)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `096eaf6` (2026-06-25) — same multi-sport commit |
| **Feature** | Per-sport profiles on global player identity |
| **Still used today?** | **Yes** when `PLAYER_SPORT_PROFILES_ENABLED` (default ON) — master-sports sync, global-players API |
| **Status** | **Active** (flag-gated) |
| **Runtime depends?** | Yes when flag on |
| **If removed** | Multi-sport global identity paths break |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 12 — `platform_audit_events` (~L197)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `898f64e` (2026-06-08) — *Add platform audit logging…* |
| **Feature** | Append-only admin investigation / monitoring trail |
| **Still used today?** | **Yes** — `audit-service.ts`, `routes/audit.ts`, system logs UI; writes from critical routes |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Audit UI/export and critical-action logging break; also in System B |
| **Belongs in** | **Versioned migration**. CREATE+ALTER same columns are historical redundancy. Not boot. |

---

### Batch 13 — `purse_boosters` + auction_sessions LED/revision columns (~L242)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `cdf2870` (2026-06-08) purse boosters; later columns: `random_draw_queue` (`bc1a1bd`), `re_auction_strategy_json` (`3bdfa24` 2026-06-30) |
| **Feature** | Purse capacity boosts, LED toasts, random draw, re-auction strategy, session revision |
| **Still used today?** | **Yes** — purse-boosters routes/UI, auction.ts, owner-app LiveBid, schema |
| **Status** | **Active** |
| **Runtime depends?** | Yes — core live auction paths |
| **If removed** | Booster CRUD, LED toast, random draw, re-auction strategy, optimistic concurrency break |
| **Belongs in** | **Versioned migration** (partially already in System B/D). Not boot. |

---

### Batch 14 — Team `access_code` backfill DML (~L283)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `4ce454d` (2026-06-26) — *Phase 5 — secure bidding…* |
| **Feature** | Ensure every team has a non-blank access code for owner bid gate |
| **Still used today?** | **Column/gate: Active**. **Boot UPDATE: Legacy one-shot healer** |
| **Status** | **Active** feature; **Legacy** boot DML |
| **Runtime depends?** | Bidding requires access_code (`auction.ts`, owner-app). Boot UPDATE only heals blank rows |
| **If boot UPDATE removed** | Safe once all teams have codes; new teams should set code in app. If codes blank and UPDATE gone: owner bids rejected |
| **Belongs in** | **Legacy archive** / one-time migrate. Gate logic stays in app. **Not** runtime boot. |

---

### Batch 15 — `creative_jobs` (~L292)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `9bf5e78` (2026-06-18) — *Fix API startup and add Buzz Studio creative jobs* |
| **Feature** | Buzz Studio / media-center render queue |
| **Still used today?** | **Yes** — creative-jobs service/worker/routes, template studio UI |
| **Status** | **Active** |
| **Runtime depends?** | Yes for media-center renders |
| **If removed** | Template studio job queue/history break; also in System B |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 16 — Badminton schema (8 tables + indexes) (~L322)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `01906ca` (2026-06-08) — *Badminton Tournament Management & Live Scoring* |
| **Feature** | Full badminton hub (players, courts, categories, registrations, draws, fixtures, match_details, analytics) |
| **Still used today?** | **Yes** when scoring/badminton enabled (`SCORING` / legacy `ENABLE_BADMINTON` + tournament `scoring_enabled`) — large `routes/badminton.ts` + `pages/badminton/*` |
| **Status** | **Active** (platform/tournament gated). `badminton_analytics`: **Partially used** (writes on delete/purge; UI aggregates elsewhere) |
| **Runtime depends?** | Yes for badminton product path |
| **If removed** | Entire badminton tournament/scorer/broadcast stack breaks when enabled |
| **Belongs in** | **Versioned migration** / installer for scoring-enabled envs. Not every-boot DDL. |

---

### Batch 17 — `referee_name` → `umpire_name` DO block (~L510)

| Field | Evidence |
|-------|----------|
| **Introduced by** | Column era `01906ca` / rename in broadcast suite `f21449e` (2026-06-18); hardened `eb2fe4d` (2026-06-27) when column already gone |
| **Feature** | One-shot rename of badminton official field |
| **Still used today?** | **No** runtime reads `referee_name`. App uses `umpireName` only |
| **Status** | **Legacy** (completed migration) |
| **Runtime depends?** | No — after column dropped |
| **If removed from boot** | Nothing on current staging/prod once migrated |
| **Belongs in** | **Legacy archive**. Never runtime boot. |

---

### Batch 18 — Badminton `scorer_pin` backfill (~L532)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `f21449e` (2026-06-18) — *badminton broadcast suite…* |
| **Feature** | Per-match scorer PIN for public scorer console |
| **Still used today?** | **Column/auth: Active**. **Boot UPDATE: Legacy healer** |
| **Status** | **Active** + **Legacy** DML |
| **Runtime depends?** | Yes — `x-scorer-pin`, matches UI, `use-badminton-match.ts` |
| **If boot UPDATE removed** | OK if all rows have pins; new matches should set PIN in app |
| **Belongs in** | Column creation → **versioned migration**. Backfill → **legacy archive**. Not boot. |

---

### Batch 19 — Master Sports Core (~L542)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `bc1a1bd` (2026-06-09) — *Add Master Sports Core…* |
| **Feature** | Shared identity: `global_players` extensions, `master_sponsors` / `master_teams`, PTA, stats, ID mappings, sync log, `tournament_player_profiles` |
| **Still used today?** | **Yes / partial by sport path** — global-players API, cricket roster sync, badminton master-player import, workbook profiles |
| **Status** | **Active** for scoring/master-sports paths; less critical for pure auction-only tournaments |
| **Runtime depends?** | Yes when master-sports/scoring features used; boot DELETE/UPDATE/INSERT are residual healers |
| **If removed** | Global player search, cricket roster sync, badminton master import, cross-tournament stats break |
| **Belongs in** | Schema → **versioned migration**. PTA dedupe / profile INSERT → **legacy archive**. Not boot. |

---

### Batch 20 — Cricket scoring Phase 1 (~L729)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `6fc0693` (2026-06-09) — *feat(cricket): Phase 1 tournament foundation…* |
| **Feature** | Venues, officials, draws, groups, squads, match player stats, leaderboards, awards, DLS |
| **Still used today?** | **Yes** when cricket + scoring enabled — `scoring-foundation-service.ts`, stats/orchestrator, scoring UI pages |
| **Status** | **Active** (gated) |
| **Runtime depends?** | Yes for cricket scoring product |
| **If removed** | Schedule, live scoring, standings, DLS, awards break |
| **Belongs in** | **Versioned migration** / scoring installer. Not boot. |

---

### Batch 21 — `contact_inquiries` (~L878)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `29cb548` (2026-06-17) — branding/legal/contact era |
| **Feature** | Public website contact form lead store |
| **Still used today?** | **Yes** — `routes/contact.ts`, `pages/contact.tsx` (admin inbox UI limited; storage + notification triggers active) |
| **Status** | **Active** |
| **Runtime depends?** | Yes for `/contact` POST |
| **If removed** | Public contact form fails |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 22 — Organizer Google Sheets OAuth columns (~L901)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `2f22890` (2026-06-27) — *Add Google Sheets OAuth export…* |
| **Feature** | Store refresh/access tokens on organizers |
| **Still used today?** | **Yes** — `google-sheets-token-store.ts`, OAuth callback, export hooks |
| **Status** | **Active** |
| **Runtime depends?** | Yes for Sheets connect/export |
| **If removed** | Google Sheets OAuth/export breaks |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 23 — `google_sheet_syncs` (~L912)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `a5b0875` (2026-06-27) — *persistent Google Sheets sync…* |
| **Feature** | Per-tournament spreadsheet link + sync status |
| **Still used today?** | **Yes** — `google-sheets-sync-service.ts`, export UI status |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Persistent sheet sync/reconnect status breaks |
| **Belongs in** | **Versioned migration**. Not boot. |

---

### Batch 24 — Admin notifications (~L933)

| Field | Evidence |
|-------|----------|
| **Introduced by** | `10b0eb2` (2026-07-03) — *Add admin notification system with real-time SSE…* |
| **Feature** | Admin bell, settings, SSE live notifications |
| **Still used today?** | **Yes** — admin-notifications routes/services/UI, contact/tournament/audit triggers |
| **Status** | **Active** |
| **Runtime depends?** | Yes |
| **If removed** | Admin notification bell/settings/SSE delivery break |
| **Belongs in** | **Versioned migration**. Not boot. |

---

## 4. Portfolio summary

### By feature status

| Status | Batches |
|--------|---------|
| **Active** | 1, 3–8, 10–13, 15–16, 19–24 (schema objects); 9, 14, 18 (features active; boot DML legacy) |
| **Partially used** | 2 (reverse logo); 16/`badminton_analytics`; 19 (sport-path dependent) |
| **Legacy** | 17 (referee→umpire); boot DML in 9, 14, 18, 19 |
| **Dead** | **None** of the 24 batches are wholly dead features |

### By recommended placement (future governance — not implemented)

| Placement | Batches / parts |
|-----------|-----------------|
| **Runtime boot** | **None** of the 24 should remain as applying DDL/DML every start long-term. Optional future: revision **assert** only. |
| **Versioned migration** | All CREATE/ALTER/INDEX schema from batches 1–13, 15–16, 19–24 |
| **One-time installer** | Same schema set for empty Neon branches / `db:setup` |
| **Legacy archive** | Batch 17 DO block; access_code / serial_no / scorer_pin / PTA / profile backfill DML |

### Cross-cutting risk if System C deleted tomorrow without migrate

| Risk tier | What breaks |
|-----------|-------------|
| **High (core auction)** | serial_no, access_code gate, purse boosters/session columns, player/team contact fields, registration payment columns, audit events — on **new** or lagging DBs |
| **Medium (modules)** | Branding assets, specs/profiles, creative jobs, Google Sheets, admin notifications, master-sports, badminton, cricket scoring |
| **Low** | Reverse logo fallback; referee_name migration; analytics table underuse |

On **current staging** (schema already healed), deleting System C **code** would mainly stop re-checking catalogs (~4.7s) — **until** the next environment that never ran the ensures. That is why governance must move content to versioned migrations **before** removing the runtime applicator.

---

## 5. Answer to “why does System C exist?”

1. **Product reason:** Features needed schema on already-live Neon DBs the same day code shipped.  
2. **Ops reason:** Manual `pnpm migrate` was not guaranteed on every Render deploy.  
3. **Engineering habit:** `IF NOT EXISTS` + `void pool.query` was treated as a safe, non-blocking deploy addon (documented in regression audits).  
4. **Result:** 24 batches = a chronological feature log of Jun–Jul 2026, still executing because nothing retired them after the schema landed.  
5. **Governance stance:** Schema objects are mostly **active and required**; **re-executing them at runtime boot is not**. Placement target is **versioned migration + installer**, with one-shot DML in **legacy archive**.

---

## 6. Evidence index

| Claim type | Where to verify |
|------------|-----------------|
| Batch SQL / counts | `lib/db/src/index.ts`, `SYSTEM_C_EXECUTION_ANALYSIS.md` |
| Introducing commits | `git log -S <needle> -- lib/db/src/index.ts` (hashes listed above) |
| Runtime usage | api-server routes/services + auction-platform pages cited per batch |
| Feature flags | `PLAYER_SPECS_V2_ENABLED`, `PLAYER_SPORT_PROFILES_ENABLED`, `SCORING` / `ENABLE_BADMINTON`, `tournaments.scoring_enabled` |
| Pattern intent | Inline comments in `index.ts`; `docs/REGRESSION_AUDIT.md` §2.5 |
| Parallel systems | `DATABASE_FREEZE_REPORT.md` Systems B/C/D |

**No code was modified for this report.**
