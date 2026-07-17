# Schema Deployment Checklist

Use this for every release that touches `lib/db` or depends on new columns/tables.

## Before merge

- [ ] Drizzle schema updated under `lib/db/src/schema/`
- [ ] Versioned migration added under `lib/db/migrations/` (`IF NOT EXISTS` only)
- [ ] CI `Schema governance` workflow green
- [ ] No DROP / RENAME / destructive SQL in the migration
- [ ] Expand/contract noted in PR if breaking

## Staging

- [ ] Apply migration SQL to staging database (preferred) — or rely on staging auto-heal for additive `IF NOT EXISTS` gaps
- [ ] Confirm staging identity: **`BIDWAR_ENV=staging` is set** on the Render staging service (required; no hostname/`NODE_ENV` fallback)
- [ ] Confirm staging `DATABASE_URL` is the **staging** Neon database (Render env) — never paste production’s URL
- [ ] Optional: set `NEON_STAGING_HOST_ALLOWLIST` / `NEON_PRODUCTION_HOST_ALLOWLIST` so a wrong URL fails closed
- [ ] Deploy API to staging
- [ ] Startup logs show `autoHealEnabled: true` (and `databaseRole` if allow-lists set), then schema OK / heal summary **before** HTTP listen
- [ ] `GET /api/admin/schema-health` → `driftStatus: "ok"`, `critical: false`
- [ ] Smoke: organizer login, Google login (if configured), tournament list

## Production

- [ ] Apply **same** migration SQL to production **before** app rollout
- [ ] Confirm column/table exists (`information_schema` / Neon SQL)
- [ ] Deploy API (`NODE_ENV=production`, `BIDWAR_ENV=production`, do **not** set `SCHEMA_AUTO_HEAL=true`)
- [ ] Confirm production `DATABASE_URL` is the **production** Neon database (Render env) — never paste staging’s URL
- [ ] Optional: set `NEON_PRODUCTION_HOST_ALLOWLIST` / `NEON_STAGING_HOST_ALLOWLIST`
- [ ] Process stays up (startup validation passed; logs show `autoHealEnabled: false`)
- [ ] `GET /api/admin/schema-health` (admin session) → ok
- [ ] Verify:
  - [ ] `GET /api/auth/me` (session cookie)
  - [ ] `GET /api/auth/organizer-account/me` → 200 JSON (not HTML 500)
  - [ ] Google Sign-In → `/organizer?google_ok=1` (not `google_failed`)
  - [ ] Email/password organizer login
  - [ ] Tournament list / open tournament

## Rollback

- [ ] Do **not** drop columns to roll back app (expand/contract)
- [ ] Roll back app binary if needed; leave additive columns in place
- [ ] Contract-phase drops only in a later dedicated migration after app no longer reads them

## Incident: startup refused for drift

Symptoms on Render production:
- Deploy **Exited with status 1**
- Logs show `[schema] boot policy` with `environment: "production"`, `autoHealEnabled: false`
- Then `======== SCHEMA DRIFT REPORT ========` with `missingTables` / `missingColumns`
- Staging still works because `BIDWAR_ENV=staging` auto-heals additive gaps

**Do not** set `SCHEMA_AUTO_HEAL=true` on production.

Fix steps:
1. Open Render logs and copy the `SCHEMA DRIFT REPORT` (`missingTables` / `requiredSql`)
2. Apply the matching file(s) under `lib/db/migrations/` to **Neon production** (SQL Editor or `psql "$DATABASE_URL" -f …`)
   - Scorer boot failure (post 2026-07-14): apply `0005_scorer_module.sql` (also re-asserts `tournaments.city` + court scorer columns)
3. Confirm objects exist:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name LIKE 'scorer_%'
   ORDER BY 1;
   ```
4. Render → Manual Deploy (no need to change `SCHEMA_AUTO_HEAL`)
5. Confirm logs: `autoHealEnabled: false` then `[schema-governance] schema OK`
6. Re-check `GET /api/admin/schema-health` → `critical: false`
