# Schema Drift Prevention — Design Spec

**Date:** 2026-07-13  
**Status:** Approved  
**Mode:** Hybrid C (dev/staging heal; production validate-only)

## Goal

Prevent BidWar production schema drift permanently. Drizzle is the only schema SSOT. Production never auto-mutates. Startup fails closed on critical drift.

## Phases

1. **P0 production fix** — `tournaments.city` + verify Google/organizer auth  
2. **Governance framework** — contract, validator, heal gate, health endpoint  
3. **Documentation** — ADR, workflows, recovery  
4. **CI** — reject PRs that change Drizzle without a migration  

## Architecture

| Layer | Authority |
|-------|-----------|
| `lib/db/src/schema/**/*.ts` | Only design SSOT |
| Versioned `lib/db/migrations/*.sql` + ledger | Only apply SSOT |
| Generated schema contract + version | Expected shape for validation/health |
| Startup orchestrator | Validate always; heal only when allowed |
| `GET /api/admin/schema-health` | Ops visibility |

## Startup

1. Load contract + expected version  
2. Introspect live DB  
3. Diff → DriftReport  
4. **Production / `SCHEMA_AUTO_HEAL=false`:** log report + required SQL → `process.exit(1)` on critical drift  
5. **Dev/staging / `SCHEMA_AUTO_HEAL=true`:** apply idempotent CREATE/ALTER/INDEX IF NOT EXISTS only → re-validate → exit if still drifting  

Never DROP / RENAME / destructive SQL.

## Health endpoint fields

`expectedSchemaVersion`, `currentSchemaVersion`, `driftStatus`, `missingTables`, `missingColumns`, `missingIndexes`, `missingConstraints`, `pendingMigrations`, `requiredSql[]`, `autoHealEnabled`, `lastMigrationApplied`, `databaseType`, `environment`

## Out of scope

- Automatic renames/drops  
- Production boot DDL  
- `drizzle-kit push` on shared environments  
