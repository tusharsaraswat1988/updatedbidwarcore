# BidWar Database Rollback Strategy

> Phase 2 design. Rollback must protect live auctions and prevent data loss.  
> Assumes target expand/contract discipline from `TARGET_DATABASE_ARCHITECTURE.md`.

---

## Principles

1. **Prefer rolling forward** for schema when expand migrations already applied.  
2. **Application rollback must always be safe** against the current DB (expand-compatible).  
3. **Destructive contract migrations are rare, gated, and separately reversible only via backup/PITR.**  
4. **Never use runtime DDL as a rollback mechanism.**  
5. **No data loss:** do not DROP/DELETE to “undo” without a restore plan.

---

## Rollback scenarios

### Scenario 1 — Migration failed; app not deployed

**State:** Migrator aborted; ledger may show partial apply depending on tooling transactionality.  
**Action:**

1. Stop release.  
2. Inspect ledger and objects.  
3. Fix-forward with a corrective migration on a new version (preferred), or restore Neon to pre-job PITR if DB left inconsistent.  
4. Do not roll out API.

**Data loss risk:** Low if no destructive statements; higher if partial destructive migration (those must be forbidden in early phases).

---

### Scenario 2 — Migration succeeded; app rollout failing validation

**State:** DB at version M; new app unhealthy; old app still serving (rolling).  
**Action:**

1. Halt rollout.  
2. Keep/restore old app instances.  
3. Leave DB at version M (expand should be compatible).  
4. Fix app; redeploy.

**Data loss risk:** None from rollback.

---

### Scenario 3 — App bug after full rollout; schema OK

**Action:** Redeploy previous API artifact.  
**Requirement:** Previous artifact must not require objects removed by a contract migration.  
**Data loss risk:** None.

---

### Scenario 4 — Bad expand migration (wrong default, wrong type) already in prod

**Action:**

1. Fix-forward: new migration correcting type/default if safe.  
2. If data corrupted: restore from PITR to timestamp before migration, then re-apply known-good migrations; redeploy matching app.  
3. Communicate auction impact window.

**Data loss risk:** PITR may lose writes after restore point — choose RPO consciously.

---

### Scenario 5 — Contract migration dropped a column/table still needed

**Action:**

1. Immediate: stop further deploys.  
2. Restore Neon PITR to before contract migration.  
3. Redeploy app version compatible with restored schema.  
4. Postmortem: contract checklist failed.

**Data loss risk:** **High** for writes after drop — this is why contract is last and gated.

---

### Scenario 6 — Transition era: healer removed too early

**Symptom:** Missing column errors after removing C/D.  
**Action:**

1. Re-enable previous release that still had healers **or** urgently apply missing migration via migrator.  
2. Prefer migrator fix-forward over restoring healers long-term.  
3. Do not invent one-off push on prod unless emergency protocol invoked.

---

## Rollback checks (before declaring success)

| Check | Pass criteria |
|-------|---------------|
| App health | Ready instances ≥ required |
| Ledger | Matches intended version for serving app |
| Critical queries | Tournament load, bid path, auth |
| Data | Row counts / checksums for touched tables if migration was dataful |
| Auctions | No elevated bid/session errors |

---

## What is intentionally not supported

| Approach | Why rejected |
|----------|--------------|
| Automatic down-migrations on every file | Dangerous with data; false sense of safety |
| Startup DDL to recreate dropped objects | Reintroduces System C/D hazards |
| `drizzle-kit push` to “sync back” | Non-reviewable; can drop more |
| Deleting ledger rows to re-run baseline | Only via controlled ops procedure |

---

## Backup and PITR requirements

- Neon point-in-time restore enabled and tested periodically.  
- Documented owner for restore drills.  
- Before high-risk migrations (unique constraints, mass backfill, contract): create an explicit restore checkpoint note (time, git SHA, migration id).

---

## Compatibility matrix (rollback planning aid)

Maintain a living matrix (ops wiki):

| App version | Min DB version | Max DB version (if any) |
|-------------|----------------|-------------------------|
| N | M0 | M1 (before contract X) |
| N+1 | M1 | M2 |

Rollbacks that cross a contract boundary require DB restore, not just app rollback.
