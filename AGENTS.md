# BidWar — Agent Notes

## Cursor Cloud specific instructions

BidWar is a pnpm monorepo (Express API + React/Vite frontends + PostgreSQL). See `replit.md` and `DEPLOY.md` for full docs.

### Node.js version (required)

The repo targets **Node.js 24** (see `.replit`). The VM default `/exec-daemon/node` is Node 22 and **breaks Vite dev** (`Unknown file extension ".ts"` when loading `@workspace/api-base/vite-proxy`).

Before any `pnpm dev` / Vite command, ensure Node 24 is first on `PATH`:

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
corepack enable
```

(`~/.bashrc` in this environment prepends Node 24 for interactive shells.)

### Services (split dev)

| Service | Port | Command |
|---------|------|---------|
| PostgreSQL | 5432 | `sudo pg_ctlcluster 16 main start` if not running |
| API | 8080 | via `pnpm dev` |
| Auction UI | 3000 | via `pnpm dev` |
| Owner app | 5174 | via `pnpm dev` |

**Start everything:** `pnpm dev` from repo root (builds API once, then runs all three processes).

**Stop:** `pnpm dev:stop`

### First-time local setup

1. Copy `.env.example` → `.env` and set at minimum: `DATABASE_URL`, `SESSION_SECRET` (32+ chars), `ADMIN_PASSWORD`, `APP_DOMAIN=localhost`, `APP_PUBLIC_SCHEME=http`, `NODE_ENV=development`, `PORT=8080`, `SERVE_STATIC=false`, `BYPASS_OTP=true` (dev only).
2. `pnpm install --frozen-lockfile`
3. `pnpm --filter @workspace/db run push` — apply Drizzle schema (dev only; not for production migrations).
4. `pnpm dev`

### Verify / test / build

| Task | Command |
|------|---------|
| Smoke test (dev running) | `pnpm run verify:local` |
| Typecheck | `pnpm run typecheck` |
| API tests | `pnpm --filter @workspace/api-server run test` |
| Production build | `pnpm run build` |
| Prod-like single process | `pnpm run start:prod` (after build; set `SERVE_STATIC=true`, `PORT=3000`) |

Admin login smoke test: http://localhost:3000/admin/login

### PostgreSQL on this VM

Local dev DB (if provisioned): `postgresql://bidwar:bidwar_dev@127.0.0.1:5432/bidwar`. Agents should use their own `.env` `DATABASE_URL`; do not assume this credential exists on every pod.

### Gotchas

- `pnpm dev` loads root `.env` automatically; individual package commands may not.
- Optional integrations (Cloudinary, SMS, email, OAuth) run in stub mode when unset — core auction flow still works.
- `verify:local` may fail on the `/owner-app/tournament/...` proxied route check even when `/owner-app/` and direct `:5174` owner app work; treat API + frontend + admin login as the primary health signal.
