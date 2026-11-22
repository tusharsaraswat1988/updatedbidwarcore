# BidWar Schema Governance

> Phase 2 design. Rules for who may change schema, how, and how drift is detected.  
> Enforced by process first, then CI/CD — not by runtime healers.

---

## Governance goals

- One apply path for production DDL.  
- Reviewable history of every production schema change.  
- Clear ownership for ORM shape vs applied DDL vs environment ledger.  
- Prevent reintroduction of Systems C/D patterns.

---

## Roles

| Role | Authority |
|------|-----------|
| Schema author (engineer) | Propose Drizzle schema + migration in same PR |
| Reviewer | Approve expand/contract safety, hot-path impact |
| Release operator / CD | Run migrator; never hand-edit prod catalogs |
| Database architect (designated) | Exception approvals; baseline stamps; emergency protocol |
| On-call | Execute rollback/PITR per runbooks — not invent DDL |

---

## Change policy

### Allowed in normal PRs

- Drizzle schema changes accompanied by generated versioned migration.  
- Expand-first designs.  
- Data backfill **jobs** as separate, explicit steps (not import side effects).

### Forbidden in production

- `drizzle-kit push` / `push-force`  
- Editing `ensure-schema.ts` or `index.ts` to add DDL (after freeze phase)  
- Adding entries to `scripts/src/migrate.ts` for new features (after B retirement)  
- Manual `psql` DDL except emergency protocol with post-facto migration capture  
- Applying orphan unwired SQL files as if they were the migrator  

### Emergency protocol

1. Incident commander declares schema emergency.  
2. Prefer fix-forward migration via migrator.  
3. If manual DDL unavoidable: record exact statements, timestamp, actor; immediately commit a matching migration and stamp ledger.  
4. Postmortem within 48 hours.

---

## PR checklist (schema-touching)

- [ ] Drizzle schema updated  
- [ ] Versioned migration added (or justified baseline exception)  
- [ ] Classification: expand / backfill / contract / index  
- [ ] Hot-path tables identified; lock risk noted  
- [ ] Rollback notes (app-only vs PITR)  
- [ ] No new DDL in `lib/db/src/index.ts` or `ensure-schema.ts`  
- [ ] Local SQLite impact considered if synced entities changed  
- [ ] `sessions` / runtime-only exceptions updated if relevant  

---

## Environment promotion rules

```
dev (disposable) → staging (migrator) → production (migrator)
```

- Same migration files promote upward.  
- No “snowflake” prod-only DDL.  
- Staging must apply successfully before prod.

---

## Drift detection

### What to detect

| Drift type | Meaning |
|------------|---------|
| Ledger behind code | Migrations pending |
| Ledger ahead of code | Hotfix / emergency DDL / wrong stamp |
| Objects missing vs schema | Healers removed too early / failed migrate |
| Extra objects | Manual DDL / old healers / abandoned experiments |
| Index mismatch | Runtime-only indexes not in migrations |

### When to run

- Pre-deploy gate (blocking)  
- Post-deploy verification  
- Scheduled daily job on prod (non-blocking alert)  
- After any emergency

### Response

- Blocking drift on deploy: fail release.  
- Scheduled drift: ticket + severity; do not auto-push.

---

## Startup validation policy (target)

- Read-only.  
- Fail closed if required version missing.  
- No auto-repair.  
- Metrics: validation failures page on-call.

---

## Documentation ownership

| Doc | Kept current by |
|-----|-----------------|
| Phase 1 verification | Update when architecture facts change |
| This governance doc | Architect + eng lead |
| Compatibility matrix | Release owners |
| Exception list (runtime-only objects during transition) | Until Phase 9 complete |

---

## Anti-patterns (explicit ban list)

1. “Add it to ensure-schema so prod picks it up on restart.”  
2. “Void pool.query ALTER on import — it’s idempotent.”  
3. “Just push —force on Neon.”  
4. “DELETE FROM … in a migration SQL file checked in as docs.”  
5. “We’ll clean orphans later” without an owner and date.

---

## Success metrics

- 100% of prod DDL via migrator ledger after cutover.  
- Zero startup DDL statements.  
- Zero prod push invocations.  
- Drift alerts actionable within SLO.  
- Auction incidents with root cause “missing column / healer race” → zero.
