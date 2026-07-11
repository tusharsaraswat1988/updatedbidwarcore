# BidWar Zero-Downtime Plan

> Phase 2 design. Live auctions must continue during schema evolution.  
> No SQL or implementation in this document.

---

## Definition of zero downtime for BidWar

- Public registration, owner bidding, operator console, scoring, and overlays remain available.  
- Brief connection blips from Neon/proxy are acceptable; **multi-minute DDL locks on hot tables are not**.  
- Rolling API deploys must not require all instances to run DDL.  
- Older and newer app binaries may briefly coexist — schema must allow that (expand/contract).

---

## Core pattern: Expand → Dual compatibility → Contract

```
Expand migration (additive, old app still works)
        ↓
Deploy new app (reads/writes new shape; still tolerates old)
        ↓
Optional backfill job (offline-friendly, chunked)
        ↓
Verify
        ↓
Contract migration (drop obsolete) — only when no old app remains
```

### Expand-safe changes (preferred during live events)

- Add nullable columns  
- Add new tables  
- Add new non-unique indexes with concurrent build strategy (planned in implementation phase)  
- Add new enum values only if represented as text (BidWar largely uses text statuses — keep that)

### Not expand-safe without extra steps

- `NOT NULL` without default on large tables  
- Column renames/drops  
- Tightening unique constraints on dirty data  
- Synchronous index builds on `bids`, `auction_*_events`, `players`, `auction_sessions` during live auctions  

---

## Hot-path table policy

| Table | Live-auction sensitivity | DDL policy |
|-------|--------------------------|------------|
| `auction_sessions` | Critical | Additive only in expand; avoid long locks; no DROP during events |
| `bids` | Critical | Prefer no DDL during live; indexes scheduled off-peak |
| `players` / `teams` | High | Additive OK; unique indexes only after data proof |
| `tournaments` | High | Additive OK |
| `auction_*_events` | Medium (append-only) | Index builds off-peak |
| Scoring / badminton / communication | Lower during pure auction | Still avoid multi-instance DDL races |

---

## Zero-downtime deployment sequence (target)

1. **Pre-check** — no active schema drift; ledger healthy.  
2. **Migration job** — single runner applies pending expand migrations.  
3. **Verify** — required objects exist; app version compatibility matrix satisfied.  
4. **Roll API** — instance-by-instance; startup validation read-only.  
5. **Canary** — one tournament / health routes / bid path smoke.  
6. **Full traffic** — complete rollout.  
7. **Contract** — separate release, only after all instances on new code.

---

## Coexistence rules (old app + new schema)

After an expand migration and before all instances upgrade:

| Old app | New schema | Required |
|---------|------------|----------|
| Does not SELECT new column | Column added nullable | OK |
| SELECTs all mapped Drizzle columns | New column added in DB but **not yet** in old binary’s schema | OK |
| Old binary’s Drizzle schema includes column not in DB | Missing column | **Not OK** — never deploy app before migrate |
| Old app writes rows missing new NOT NULL column | NOT NULL added | **Not OK** — forbidden until dual-write/backfill done |

**Hard rule:** Application version N+1 may require DB version ≥ M. Application version N must remain compatible with DB version M (expand).

---

## Index builds without downtime

Design requirements for implementation phase (no SQL here):

- Prefer concurrent index creation for large existing tables.  
- Never start unique index builds during peak bidding without a prior duplicate audit.  
- Monitor lock waits; abort policy documented in runbook.  
- Runtime “CREATE INDEX IF NOT EXISTS on every boot” is **incompatible** with zero-downtime goals — it is replaced by scheduled migrator jobs.

---

## Multi-instance safety

Today Systems C+D race across instances. Target:

- **Exactly one** migration runner per environment per release.  
- Advisory lock or migrator leadership so two CD jobs cannot apply twice concurrently.  
- App instances never take the migration lock.

---

## Live auction windows

| Window | Allowed |
|--------|---------|
| Active high-stakes auction | Expand-only if trivial; prefer no DDL; no contract; no unique builds on hot tables |
| Off-peak / no live auctions | Index builds, backfills, carefully reviewed constraints |
| Emergency hotfix needing column | Expand nullable + migrate-before-rollout; healers only if still in transition phases |

---

## Failure modes and zero-downtime response

| Failure | Response |
|---------|----------|
| Migration job fails mid-way | Stop app rollout; fix forward or restore; do not start half-migrated app that requires unfinished objects |
| Validation fails on new instance | Instance stays out of rotation; old instances keep traffic |
| Performance regression from new index/lock | Roll back app if app-caused; for migration-caused, follow ROLLBACK_STRATEGY / PITR |
| Neon failover | Apps reconnect; no startup DDL storm (target eliminates that storm) |

---

## Transition-period zero downtime

While healers still exist (early roadmap phases):

- Treat healers as **last resort**, not the deploy mechanism.  
- Still run migrate-before-rollout once Phase 3 is active.  
- Disable healer DML first (Phase 4) because multi-instance UPDATE/DELETE is the largest live-auction hazard.
