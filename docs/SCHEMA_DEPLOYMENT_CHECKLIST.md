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
- [ ] Confirm staging identity: `BIDWAR_ENV=staging` and/or staging hostname in `APP_URL` / `APP_DOMAIN` (do **not** rely on `NODE_ENV` alone; Render staging is `NODE_ENV=production`)
- [ ] Deploy API to staging
- [ ] Process binds `PORT` quickly (listen-before-bootstrap); bootstrap logs show schema OK / heal summary
- [ ] `GET /api/admin/schema-health` → `driftStatus: "ok"`, `critical: false`
- [ ] Smoke: organizer login, Google login (if configured), tournament list

## Production

- [ ] Apply **same** migration SQL to production **before** app rollout
- [ ] Confirm column/table exists (`information_schema` / Neon SQL)
- [ ] Deploy API (`NODE_ENV=production`, do **not** set `SCHEMA_AUTO_HEAL=true`)
- [ ] Process stays up (startup validation passed)
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

1. Copy `requiredSql` from logs
2. Apply via migration (never enable prod auto-heal)
3. Restart API
4. Re-check schema-health
