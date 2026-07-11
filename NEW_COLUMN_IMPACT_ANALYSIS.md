# BidWar New Column Impact Analysis

> Phase 1 read-only simulation: **add one new column** to a cloud Postgres table that is mapped in Drizzle.  
> Example used for concreteness: `players.new_column text` (nullable).  
> Patterns generalize to other tables; footnotes call out table-specific extras.

---

## Goal of the simulation

Trace every location that must change (or that will silently diverge) when introducing a single new column, including commands, deploy steps, and runtime behavior. Identify duplication.

---

## Minimum correct path (intended)

| # | Location | Action |
|---|----------|--------|
| 1 | `lib/db/src/schema/players.ts` (or target table file) | Add Drizzle column definition |
| 2 | Re-export | Already covered if file exported from `schema/index.ts` |
| 3 | Application code | Serializers, Zod/OpenAPI, routes, UI as needed |
| 4 | Apply to database | `pnpm db:push:prod` (System A) |

If every environment always ran push before serving new code that SELECTs the new column, this would be sufficient for **Drizzle-mapped** tables.

**Reality:** Production historically relies on runtime healers. Teams often also patch Systems C and/or D (and sometimes B) so old DBs gain the column without an operator remembering push.

---

## Full duplication map (what engineers actually touch)

### Always (ORM + product)

| File / area | Why |
|-------------|-----|
| `lib/db/src/schema/<table>.ts` | Canonical TypeScript column |
| API serializers / OpenAPI / `lib/api-zod` generated types | Expose or persist the field |
| Frontend forms / types | If user-facing |
| Any raw SQL strings referencing `SELECT *` shapes | Rare; Drizzle usually lists columns |

### Frequently duplicated for “prod safety”

| File | Command / trigger | Why duplicated |
|------|-------------------|----------------|
| `lib/db/src/ensure-schema.ts` | API boot `ensureCoreSchema` | Comment: prevent Drizzle SELECT failure when column missing |
| `lib/db/src/index.ts` | Import-time `void pool.query(ALTER … IF NOT EXISTS)` | Same pattern used for email, gender, jersey, payment columns, etc. |
| `scripts/src/migrate.ts` | `pnpm migrate` / `migrate:prod` | Historical home for additive ALTERs (e.g. `players_email`) |
| `lib/db/migrations/*.sql` | Manual only | Sometimes a SQL file is added for documentation — **not executed automatically** |

### Table-specific extras

| If column is on… | Extra locations |
|------------------|-----------------|
| Master sports / `global_players` / PTA | Also `scripts/verify-master-sports-db.ts` |
| Local offline subset (`players`, `teams`, `tournaments`, `auction_sessions`, …) | `lib/db-local/src/schema` + `lib/db-local/src/setup.ts` ALTER list |
| Scoring foundation | Possibly orphan `0001_scoring_foundation.sql` (docs only) |
| Push / owner sessions | Possibly orphan `0002_…sql` (docs only; destructive DELETE) |

---

## Commands involved

```bash
# Schema apply (System A) — preferred explicit apply
pnpm db:push:prod
# equivalent:
pnpm --filter @workspace/db run push

# Optional historical CLI healer (System B)
pnpm migrate:prod

# Combined documented setup
pnpm db:setup:prod   # push + migrate

# Runtime (no command) — happens on deploy/restart
node artifacts/api-server/dist/index.mjs
# → import @workspace/db  ⇒ System C ALTER IF NOT EXISTS (if added there)
# → await ensureCoreSchema ⇒ System D ALTER IF NOT EXISTS (if added there)
```

---

## Deployment steps (current real-world)

1. Merge code that adds Drizzle column (+ likely C and/or D ALTER).  
2. Build/deploy API.  
3. **On start:** System C may add column (if patched); System D may add column (if patched).  
4. **If neither C nor D patched and push was not run:** first query touching the new mapped column **fails** (missing column).  
5. Optional operator step (often forgotten): `pnpm db:setup:prod` against prod DATABASE_URL.

`DEPLOY.md` / `Dockerfile` / GitHub Actions do **not** encode step 5.

---

## Runtime behavior after adding the column only in Drizzle

| Scenario | Behavior |
|----------|----------|
| Push run; C/D not updated | Column exists; app works; C/D unchanged |
| C/D updated; push not run | Column appears at boot/import; app works; Drizzle and DB match by luck |
| Neither push nor C/D | **Boot may succeed**; queries selecting the new field **error** |
| Push + C + D all updated | Triple-redundant ADD COLUMN IF NOT EXISTS on every boot forever |

---

## Duplication score for one column

| Layer | Required for correctness? | Commonly duplicated? |
|-------|---------------------------|----------------------|
| Drizzle schema | **Yes** | — |
| System A push (or equivalent DDL) | **Yes** (somewhere) | — |
| System D ensure-schema | No if push guaranteed | **Yes** (project pattern) |
| System C index.ts | No if push/D guaranteed | **Yes** (project pattern) |
| System B migrate.ts | No | Sometimes |
| Orphan SQL file | No | Sometimes (docs) |
| db-local | Only if offline feature needs it | When column is on synced entities |
| verify-master-sports-db | Only master-sports tables | When applicable |

**Observed project pattern:** a single logical column often appears in **2–4** DDL sources (A definition + C and/or D and/or B).

Evidence examples already in tree:

- `players.email` — Drizzle + `migrate.ts` (`players_email`) + `index.ts` ALTER  
- `teams.owner_photo_url` — Drizzle + migrate + index.ts  
- Tournament scoring columns — Drizzle + migrate + ensure-schema  
- `auction_sessions.random_draw_queue` — Drizzle + migrate + ensure-schema + index.ts  

---

## Worked example: `players.nickname text` (nullable)

### Files to modify (complete)

1. `lib/db/src/schema/players.ts` — add `nickname: text("nickname")`  
2. Likely `artifacts/api-server/src/lib/serializers/player.ts`  
3. OpenAPI / codegen consumers as needed  
4. **Optional but patterned:**  
   - `lib/db/src/ensure-schema.ts` → `ALTER TABLE players ADD COLUMN IF NOT EXISTS nickname text;`  
   - `lib/db/src/index.ts` → same ALTER in a `void pool.query`  
   - `scripts/src/migrate.ts` → new labeled migration entry  
5. If local mode needs it: `lib/db-local/src/setup.ts` + local schema  

### Commands

- Dev: `pnpm --filter @workspace/db run push`  
- Prod: `pnpm db:push:prod` and/or rely on C/D after deploy  

### Runtime

- After deploy with C/D patches: every instance issues ADD COLUMN IF NOT EXISTS (no-op after first).  
- Without C/D and without push: nickname queries fail.

### Duplication

Up to **four** DDL declarations for one nullable text column.

---

## Contrast: column on `bids` (Drizzle-only table)

`bids` has **no** System C/D/B healers today.

| Step | Required |
|------|----------|
| Drizzle schema change | Yes |
| `db:push` before serving new code | **Mandatory** — nothing else will add the column |
| ensure-schema / index.ts | Not present unless engineer adds a new pattern |

This is the sharp edge of split ownership: **runtime healers are incomplete**, so “add to ensure-schema” is folklore, not a guarantee.

---

## Bottom line

Adding one column is not a one-file change in BidWar’s current architecture. The ORM definition is necessary but not sufficient under the existing deploy model; additive DDL is commonly copy-pasted into boot/import healers, creating permanent duplication and multi-path drift.
