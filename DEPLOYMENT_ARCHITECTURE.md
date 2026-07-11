# BidWar Deployment Architecture (Database)

> Phase 2 design. Separates **schema release** from **application release**.  
> Replaces today’s “deploy app and hope runtime DDL heals prod.”

---

## Current state (problem)

```
Build API → Deploy API instances
               ↓
         Import @workspace/db  → System C DDL/DML (unawaited)
               ↓
         ensureCoreSchema      → System D DDL (awaited)
               ↓
         Listen
```

Optional, often skipped: `db:push:prod` / `migrate:prod`.

**Failure mode:** Schema change ships inside the web process; multi-instance races; no ledger; rollback unclear.

---

## Target deployment architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Release artifact                                           │
│  - api-server build                                         │
│  - migration files + journal (same git SHA)                 │
│  - required_schema_version metadata                         │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Job: db-migrator (one-shot, not the web dyno)              │
│  - acquire migration lock                                   │
│  - apply pending versions                                   │
│  - verify ledger + critical objects                         │
│  - release lock                                             │
│  - exit non-zero on failure (blocks next stage)             │
└─────────────────────────────────────────────────────────────┘
            │ success
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Rollout: api-server (N instances)                          │
│  - no DDL                                                   │
│  - read-only schema validation vs required_schema_version   │
│  - fail closed → instance not healthy                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Pipeline stages

### Stage A — Build

- Compile API.  
- Package migrations from the same commit.  
- Embed or publish `required_schema_version` (max migration id in that commit).

### Stage B — Pre-deploy schema

- Run migrator against target DATABASE_URL (staging then prod).  
- **Database updates happen here — before application rollout.**  
- On failure: stop; do not deploy API.

### Stage C — Verify schema

- Confirm ledger version ≥ required.  
- Confirm critical tables/columns (checklist).  
- Optional: compare to expected snapshot.

### Stage D — Application rollout

- Rolling replace of API instances.  
- Startup: validation only.  
- **Application rollout never performs schema mutation.**

### Stage E — Post-deploy

- Health checks (liveness + readiness).  
- Auction/read path smoke.  
- Watch error rates / lock metrics.

---

## Environment matrix

| Environment | Migrator | Push | Runtime DDL (target) |
|-------------|----------|------|----------------------|
| Local dev | Optional migrate; push allowed for empty local DB only | Allowed for disposable DBs | Forbidden eventually |
| Staging | Required in CD | Forbidden once migrator works | Forbidden after cutover |
| Production | Required in CD | **Forbidden** | **Forbidden** |

---

## Application startup (target contract)

**Read-only with respect to schema.**

1. Connect.  
2. Validate ledger + objects.  
3. Become ready.  

No `CREATE`/`ALTER`/`DROP`. No ensure-schema healing.

Product startup DML (branding cache, communication seed defaults) remains a **separate** concern and must not create tables/columns.

---

## Rollback-friendly deploy ordering

| Order | Why |
|-------|-----|
| Migrate (expand) first | Old app still runs |
| Deploy new app | Uses new objects |
| Later: contract migrate | Only when old app gone |
| App-only rollback | Safe against expanded schema |

Never: deploy app that requires column X before migration adding X.  
Never: contract-drop column while old app still selected.

---

## Roles and ownership

| Role | Responsibility |
|------|----------------|
| Migrator job | Sole producer of DDL in prod |
| API process | Consumer of schema; validator |
| Humans | Approve migration PRs; emergency stop |
| CI | Block schema-without-migration; block DDL in index/ensure files after freeze |

---

## Transition deployment (while healers remain)

Until roadmap Phase 7–8:

```
Migrator job (preferred path for new changes)
        ↓
API rollout
        ↓
Healers still present but frozen for new DDL
        ↓
Metrics: healer should be no-op
```

Emergency exception: documented dual-write to healer — time-boxed, with follow-up migration.

---

## What changes in operator runbooks

| Today | Target |
|-------|--------|
| “Restart API to pick up columns” | “Run migrator, then roll API” |
| `db:setup:prod` ad hoc | CD-integrated migrate |
| Hope IF NOT EXISTS | Ledger proves version |
| Push interactively on prod | Disallowed |

---

## Compatibility with Neon

- Migrator uses the same `DATABASE_URL` / `NEON_DATABASE_URL` resolution rules.  
- Prefer a maintenance window only when migrations cannot be concurrent/expand-safe.  
- Keep PITR enabled; migrator failure does not replace backup strategy.
