# ADR — Permanent Schema Drift Prevention (BidWar)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-07-13 |
| Supersedes (in part) | Temporary reliance on System C/D boot DDL as schema SSOT |
| Aligns with | `DATABASE_GOVERNANCE_ADR.md` (Generate + Migrate; prod validate-only) |

## Why drift occurred

1. Drizzle schema gained `tournaments.city` (commit `691c181`) without a versioned migration or boot ensure.
2. Production Postgres lacked the column.
3. `db.select().from(tournamentsTable)` emitted `city` → Postgres error → Express HTML 500.
4. Google OAuth `issueOrganizerAuthCookie` queried tournaments → catch → `/organizer?error=google_failed`.
5. `/api/auth/me` still returned 200 (JWT only, no DB) — masking the failure.
6. Organizer UI bootstraps via `/api/auth/organizer-account/me`, not `/api/auth/me`.

## Prevention strategy

| Rule | Enforcement |
|------|-------------|
| Drizzle is the **only** design SSOT | Contract/validator/heal SQL generated from `lib/db/src/schema/**` |
| Every schema change ships a migration | CI rejects PRs that change schema without `lib/db/migrations/*.sql` |
| Production never auto-mutates | `SCHEMA_AUTO_HEAL` defaults off for true production (`NODE_ENV=production` and not staging) |
| Production fails closed | Startup validates; critical drift → log + print SQL → exit |
| Dev/staging may heal | Idempotent `CREATE/ALTER/INDEX IF NOT EXISTS` only; never DROP/RENAME. Staging is detected via `BIDWAR_ENV=staging` or staging hostnames in `APP_URL`/`APP_DOMAIN` (Render staging still uses `NODE_ENV=production`) |
| Ops visibility | `GET /api/admin/schema-health` |

## Migration workflow

1. Edit Drizzle schema under `lib/db/src/schema/`.
2. Add versioned SQL under `lib/db/migrations/` (idempotent additive statements).
3. Open PR — CI `schema-governance` workflow must pass.
4. Apply migration to staging → verify `/api/admin/schema-health`.
5. Apply migration to production **before** rolling the app that depends on it.
6. Deploy app; startup validation must pass.

## Deployment workflow

```
CI build
  → schema PR guard (migration present if schema changed)
  → (optional) SCHEMA_CHECK_LIVE against staging
Apply migrations to target DB (ledgered / reviewed SQL)
Deploy API
  → ensureCoreSchema: validate-only in production
  → refuse start if critical drift
Mark deploy healthy only if process stays up + schema-health ok
```

## Recovery workflow

If production refuses to start with a drift report:

1. Read printed `requiredSql[]` from logs / schema-health.
2. Review SQL (must be additive IF NOT EXISTS only).
3. Apply via approved migration path (Neon SQL editor / migrator) — **not** by setting `SCHEMA_AUTO_HEAL=true` on production.
4. Confirm `GET /api/admin/schema-health` → `driftStatus: ok`.
5. Restart API.

## Environment flags

| Variable | Effect |
|----------|--------|
| `SCHEMA_AUTO_HEAL=true` | Force heal (dev/staging/empty DB only — never leave on true production) |
| `SCHEMA_AUTO_HEAL=false` | Force validate-only |
| `BIDWAR_ENV=staging` | Treat as staging → auto-heal on (even if `NODE_ENV=production`) |
| (unset) | Heal when env is staging/local/dev/test, or when `NODE_ENV !== "production"` |

## Immediate P0 (completed)

```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
```

Applied to production Neon `jolly-tree-42208228`. Migration file: `lib/db/migrations/0003_tournaments_city.sql`.
