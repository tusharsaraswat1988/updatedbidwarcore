# AGENTS.md

## Cursor Cloud specific instructions

BidWar is a pnpm workspace monorepo. The primary product is a 3-service web app:
API server (Express), `auction-platform` (admin/operator/LED React UI), and
`owner-app` (team-owner PWA). Standard run/build/test commands live in the root
`package.json`, `scripts/package.json`, and `replit.md` — prefer those. Notes
below cover only non-obvious caveats for running this in the cloud VM.

### Required local services / config (not handled by the update script)
- **PostgreSQL is required** — the API exits at startup if `DATABASE_URL`
  (or `NEON_DATABASE_URL`) is missing. A local PostgreSQL 16 server with role/db
  `bidwar`/`bidwar` is provisioned in the VM. After a fresh VM boot, start it
  before running anything DB-related:
  `sudo pg_ctlcluster 16 main start`
  (recreate if missing: `CREATE ROLE bidwar LOGIN PASSWORD 'bidwar';` and
  `CREATE DATABASE bidwar OWNER bidwar;`).
- **`.env` is required and gitignored.** `pnpm dev` reads the root `.env`. The
  committed template is `.env.example.example` (note the double suffix; docs
  call it `.env.example`). A working dev `.env` already exists in the VM with:
  `NODE_ENV=development`, `DATABASE_URL=postgresql://bidwar:bidwar@127.0.0.1:5432/bidwar`,
  `APP_DOMAIN=localhost`, `APP_PUBLIC_SCHEME=http`, a 32+ char `SESSION_SECRET`,
  `ADMIN_PASSWORD`, `SERVE_STATIC=false`, split-dev ports, and `BYPASS_OTP=true`
  (skips SMS/OTP so no SMS provider is needed locally).

### Database setup (run once after the DB exists; not in the update script)
- `pnpm --filter @workspace/db run push` — apply Drizzle schema.
- `pnpm --filter @workspace/scripts run migrate` — idempotent column/table migrations.
- `pnpm --filter @workspace/scripts run seed:demo` — seed two demo tournaments.

### Running
- `pnpm dev` starts all three services together: API on `:8080`, auction
  platform on `:3000` (Vite proxies `/api` → API), owner-app on `:5174`
  (also proxied at `:3000/owner-app/`). Open http://localhost:3000/admin/login.
- Super-admin login is a **password-only** "Super Admin Login" form using
  `ADMIN_PASSWORD` (no email). Organizer email/password login also exists.
- `pnpm run verify:local` is a smoke test to run while `pnpm dev` is up.
- `pnpm dev:stop` / `pnpm dev:restart` to stop/restart the stack.

### Lint / typecheck / test
- There is **no lint script**; the static check is `pnpm run typecheck`.
- Per-package tests use vitest, e.g. `pnpm --filter @workspace/api-server run test`.

### Known pre-existing issues (not environment problems)
- `pnpm run typecheck` fails on the `@workspace/api-server` per-package step with
  `Referenced project '.../lib/buzz-studio-render' must have setting "composite": true`.
  The `tsc --build` libs pass; this is a committed tsconfig issue and does not
  affect `pnpm dev` (API is bundled with esbuild, frontends use Vite).
- 3 tests fail in `artifacts/api-server/src/__tests__/badminton-tenant-isolation.test.ts`
  (pure replay-logic assertions); 202/205 api-server tests pass.
- The `[db] failed to migrate badminton_match_details referee_name: column ...
  does not exist` log on API startup/seed is a non-fatal self-heal attempt and
  is safe to ignore.
