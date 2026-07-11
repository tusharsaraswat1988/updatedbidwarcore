# BidWar Runtime DDL Removal Plan

> Phase 2 design for retiring Systems C and D (and related healers).  
> Maps each current mutation system to future responsibility.  
> No code or SQL.

---

## System A — Drizzle Push

| Aspect | Detail |
|--------|--------|
| **Current responsibility** | Sync Drizzle TS schema to Postgres via `drizzle-kit push`. De facto “full schema apply” when operators remember. No ledger. Can drop/alter interactively. |
| **Future responsibility** | **Dev-only** convenience for empty/disposable databases. **Not** used for staging/production once migrator is authoritative. |
| **Can it be removed?** | Removed from **production** workflows — yes. Removed from repo entirely — optional later; keep for local scratch DBs if desired. |
| **When** | After roadmap Phase 3 proven; hard-ban at Phase 9. |
| **Before removal from prod** | Versioned migrator + baseline stamp + migrate-before-rollout working; docs/scripts updated. |
| **Risk of removal from prod** | **Low** if migrator covers schema; **High** if team still depends on push as the only full sync. |

---

## System B — `scripts/src/migrate.ts`

| Aspect | Detail |
|--------|--------|
| **Current responsibility** | CLI idempotent DDL subset (sessions, scoring foundation, intelligence, academy, purse_boosters, creative_jobs, various ALTERs). Re-runs all statements every invocation. Does not read orphan SQL files. |
| **Future responsibility** | **None for new work.** Historical labels folded into baseline/versioned migrations. `sessions` owned by journaled migrations (in or out of Drizzle consciously). |
| **Can it be removed?** | Yes, after contents are represented in the ledgered migrator. |
| **When** | Roadmap Phase 8. |
| **Before removal** | Every B object/index verified present via versioned migrations; `sessions` decision recorded; `pnpm migrate` deprecated; CD no longer calls it. |
| **Risk of removal** | **Medium** — if a label never made it into baseline, prod could miss an object. Mitigate with inventory diff. |

---

## System C — Runtime `lib/db/src/index.ts`

| Aspect | Detail |
|--------|--------|
| **Current responsibility** | Hidden production migrator + data repair on every `@workspace/db` import: CREATE/ALTER/INDEX, DROP, UPDATE, DELETE, INSERT. Unawaited. |
| **Future responsibility** | **None.** Module only constructs pool/drizzle/keepalive. Data repairs become explicit ops jobs. |
| **Can it be removed?** | Yes — **must** be removed for enterprise posture. |
| **When** | DML/DROP first (Phase 4); DDL after baseline + freeze + validate-only soak (Phase 7). |
| **Before removal** | (1) All C-created objects in migrations/schema. (2) Partial indexes/FKs captured. (3) Backfills proven complete. (4) Seeds no longer rely on import DDL. (5) Migrator gates deploys. |
| **Risk of removal** | **High** if premature; **Low** after preconditions. Premature removal → missing columns/indexes under live traffic. |

---

## System D — `ensureCoreSchema`

| Aspect | Detail |
|--------|--------|
| **Current responsibility** | Awaited boot DDL so Drizzle-mapped columns exist before listen. Overlaps B/C heavily. |
| **Future responsibility** | Transform into **read-only schema validation** (or delete once validation lives elsewhere). **No DDL.** |
| **Can it be removed?** | DDL: yes. Validation: replace, don’t abandon. |
| **When** | Validate-only Mode Phase 6; DDL removal Phase 8. |
| **Before removal** | Migrate-before-rollout reliable; required_schema_version embedded; staging soak with heal flag off; critical checklist covers former D objects. |
| **Risk of removal** | **Medium–High** if validation incomplete; boot may pass while niche routes fail — mitigate with broad checklist + drift job. |

---

## Related mechanisms (removal stance)

| Mechanism | Future |
|-----------|--------|
| Orphan `lib/db/migrations/*.sql` | Archive; never use as apply path; capture any unique intent into journaled migrations |
| `verify-master-sports-db.ts` DDL | Verify-only; DDL deleted after baseline includes master sports |
| `db-local` setup | Remains separate; versioned compatibility matrix vs cloud — not removed by this plan |
| Branding legacy DML | Keep as product migration (not schema DDL) |
| Communication seed DML | Keep; must not CREATE tables |

---

## Ordered removal sequence (safety)

```
1. Stop adding new DDL to C/D/B          (freeze)
2. Introduce ledgered migrator           (parallel)
3. Baseline stamp prod                   (inventory)
4. Migrate-before-rollout                (process)
5. Remove C DML/DROP                     (biggest race hazard)
6. Validate-only flag for D              (fail closed optional heal)
7. Remove C DDL                          (import clean)
8. Remove D DDL / keep validation        (boot clean)
9. Retire B + ban prod push              (steady state)
```

Never remove C and D in the same release as the first baseline stamp.

---

## Proofs required before each removal

| Removal | Proof |
|---------|-------|
| C DML | Queries show backfill predicates empty (e.g. null serial_no, blank access_code, duplicate active PTA) |
| C DDL | Diff: information_schema ⊇ Drizzle + exception list; migrator created those objects on staging from empty clone test |
| D DDL | N prod boots with heal count = 0; deploy gate blocked a deliberate missing-column test in staging |
| B | No unique objects only in B; `sessions` migrated |
| Prod push ban | CD and docs have no push step; attempt in staging fails policy check |

---

## Monitoring during removal

- Boot time spent in ensure/validation.  
- Count of DDL statements executed at startup (target → 0).  
- Error rate: `column does not exist`, relation missing.  
- Lock wait / migration job duration.  
- Auction bid/session error rate during soak windows.
