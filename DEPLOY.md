# BidWar — Production Deployment Guide

This guide covers deploying BidWar on Railway, Render, DigitalOcean, a plain VPS (Ubuntu), and Hostinger Business Hosting.

The app runs as a **single Node.js process** on port 3000. With `SERVE_STATIC=true` it also serves the pre-built React frontends from the same process — no separate web server or Vite dev server is needed in production.

---

## Prerequisites

- Node.js 20+, pnpm 9+
- PostgreSQL database (Neon, Supabase, Railway Postgres, or any `postgres://` URL)
- The environment variables listed in `.env.example`

---

## Required environment variables

The API server **exits at startup** with a clear error if any required variable is missing or invalid.

| Variable | Description |
|---|---|
| `DATABASE_URL` or `NEON_DATABASE_URL` | PostgreSQL connection string (either name works everywhere, including Drizzle CLI) |
| `APP_DOMAIN` | Comma-separated **hostnames only** (no `https://`), e.g. `bidwar.in,www.bidwar.in`. Must not be `localhost` in production. |
| `APP_PUBLIC_SCHEME` | `https` in production (`http` allowed only for local development) |
| `PORT` | TCP port the Node process listens on (e.g. `3000`; Railway/Render often inject this automatically) |
| `SESSION_SECRET` | Random secret, minimum 32 characters — `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Super-admin password |
| `NODE_ENV` | Set to `production` |
| `SERVE_STATIC` | Set to `true` (single-process mode; requires `pnpm run build` so `dist/public` exists) |

Optional: `CORS_ORIGINS` (full URLs), `EXTRA_CORS_ORIGINS` (development Vite dev servers only).  
**Never set `BYPASS_OTP=true` in production** — startup will fail.

See `.env.example` for the full list including Cloudinary, Google OAuth, Twilio, VAPID, and SMS keys.

---

## Local development (Windows, split servers)

Use the same relative `/api/...` URLs everywhere — no per-environment frontend code changes.

| Process | Port | Command |
|---|---|---|
| API | `8080` (recommended) | `pnpm --filter @workspace/api-server run dev` |
| Auction UI (Vite) | `3000` | `pnpm --filter @workspace/auction-platform run dev` |
| Owner app (Vite) | `5174` | `pnpm --filter @workspace/owner-app run dev` |

**.env for split dev:**

```
PORT=8080
NODE_ENV=development
SERVE_STATIC=false
APP_DOMAIN=localhost
APP_PUBLIC_SCHEME=http
API_DEV_PROXY_TARGET=http://127.0.0.1:8080
```

Vite proxies all `/api` traffic (REST, SSE, uploads, OAuth) to `API_DEV_PROXY_TARGET`. When `NODE_ENV=development`, CORS allows any `http://localhost:*` and `http://127.0.0.1:*` (dynamic Vite ports). Use `EXTRA_CORS_ORIGINS` only for non-loopback dev hosts.

**One command (recommended):** `pnpm dev` from the repo root — builds the API once, then runs API + auction-platform + owner-app together using root `.env`.

**Smoke test (with dev running):** `pnpm run verify:local`

**Production-like local test (single process):** `pnpm run build` then `pnpm run start:prod` — open `http://localhost:3000` (set `PORT=3000`, `SERVE_STATIC=true` in `.env`).

---

## Railway

1. Push the repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select the repo.
3. Railway auto-detects pnpm. Set these variables in **Settings → Variables**:
   ```
   NODE_ENV=production
   SERVE_STATIC=true
   DATABASE_URL=<your postgres url>
   APP_DOMAIN=<your-railway-domain>.up.railway.app
   SESSION_SECRET=<openssl rand -hex 32>
   ADMIN_PASSWORD=<strong password>
   PORT=3000
   ```
4. **Settings → Deploy → Build command**: `pnpm run build`
5. **Start command**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
6. Deploy. Railway exposes the app on the `.up.railway.app` domain automatically.

---

## Render

1. **New Web Service → Connect Git repository**.
2. Set:
   - **Build command**: `pnpm install --frozen-lockfile --prod=false && pnpm run build`
   - **Start command**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
   - **Environment**: `Node`
3. Add environment variables under **Environment**:
   ```
   NODE_ENV=production
   SERVE_STATIC=true
   DATABASE_URL=<your postgres url>
   APP_DOMAIN=<your-app>.onrender.com
   SESSION_SECRET=<openssl rand -hex 32>
   ADMIN_PASSWORD=<strong password>
   ```
4. Deploy. Render assigns a `.onrender.com` domain automatically.

---

## DigitalOcean App Platform

1. **Create App → GitHub** → select the repo.
2. Component type: **Web Service**.
3. Set:
   - **Build command**: `pnpm install --frozen-lockfile --prod=false && pnpm run build`
   - **Run command**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
4. Add environment variables (same as Render above, use your DO app domain).
5. Deploy.

---

## VPS (Ubuntu 22.04)

### Install Node.js 20 + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
```

### Clone and build

```bash
git clone https://github.com/your-org/bidwar.git /opt/bidwar
cd /opt/bidwar
cp .env.example .env
nano .env   # fill in all required values
pnpm install --frozen-lockfile
pnpm run build
```

### Systemd service

Create `/etc/systemd/system/bidwar.service`:

```ini
[Unit]
Description=BidWar Auction Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/bidwar
EnvironmentFile=/opt/bidwar/.env
ExecStart=/usr/bin/node --enable-source-maps artifacts/api-server/dist/index.mjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bidwar

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bidwar
sudo systemctl start bidwar
sudo systemctl status bidwar
```

### nginx (reverse proxy + SSL)

Install nginx and certbot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Copy the example config:

```bash
sudo cp /opt/bidwar/nginx.conf.example /etc/nginx/sites-available/bidwar
sudo sed -i 's/YOUR_DOMAIN/bidwar.in/g' /etc/nginx/sites-available/bidwar
sudo ln -s /etc/nginx/sites-available/bidwar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Issue SSL certificate:

```bash
sudo certbot --nginx -d bidwar.in -d www.bidwar.in
```

certbot auto-renews via a cron job. No further action needed.

### Deploy updates

```bash
cd /opt/bidwar
git pull
pnpm install --frozen-lockfile
pnpm run build
sudo systemctl restart bidwar
```

---

## Hostinger Business Hosting (Node.js app)

Hostinger Business plans support running a custom Node.js app via the **Node.js** section in hPanel.

1. **Connect via SSH** (or use hPanel File Manager to upload files).
2. Upload the repo or clone from GitHub:
   ```bash
   git clone https://github.com/your-org/bidwar.git ~/bidwar
   ```
3. Install Node.js 20 via NVM (if not already available):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc
   nvm install 20
   npm install -g pnpm
   ```
4. Build:
   ```bash
   cd ~/bidwar
   cp .env.example .env
   # Edit .env with your values
   pnpm install --frozen-lockfile
   pnpm run build
   ```
5. In **hPanel → Node.js → Create Node.js App**:
   - **Node.js version**: 20
   - **Application root**: `/home/username/bidwar`
   - **Application startup file**: `artifacts/api-server/dist/index.mjs`
   - **Application URL**: your domain
6. Set environment variables in hPanel (copy from `.env`):
   - `NODE_ENV=production`
   - `SERVE_STATIC=true`
   - `DATABASE_URL=...`
   - `APP_DOMAIN=yourdomain.com`
   - `SESSION_SECRET=...`
   - `ADMIN_PASSWORD=...`
   - (all others from `.env.example`)
7. Click **Start**.

---

## Docker

Build and run:

```bash
docker build -t bidwar .
docker run -p 3000:3000 --env-file .env bidwar
```

Or with docker-compose (`docker-compose.yml` not included — create one pointing the app at an external Postgres):

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    restart: unless-stopped
```

---

## Real-Time Architecture (SSE)

### Technology

BidWar uses **Server-Sent Events (SSE)** for all live auction updates — operator panel, LED display, owner panel, and live viewer. SSE is plain HTTP; **no WebSocket upgrade handshake is required**. This means it works out of the box on every platform in this guide.

### Platform compatibility

| Platform | Status |
|---|---|
| Railway | Confirmed — long-lived HTTP connections are fully supported |
| Render | Confirmed — long-lived HTTP connections are fully supported |
| DigitalOcean App Platform | Confirmed — long-lived HTTP connections are fully supported |
| VPS + nginx | Confirmed — use `nginx.conf.example` as-is (SSE block included) |
| Hostinger Business (Node.js) | Confirmed — SSE is plain HTTP, no special server support needed |
| Docker | Confirmed — same as VPS; add nginx in front if needed |

### Critical: single-process deployment

The SSE client registry (`broadcast.ts`) is stored in Node.js process memory. **Do not enable round-robin load balancing across multiple Node instances.** If a bid POST hits instance A and the browser's SSE connection is on instance B, the client never receives the event.

- Run **one process** on one server. Scale vertically (more CPU/RAM) if needed.
- A future Redis pub/sub upgrade path would remove this constraint — see `artifacts/api-server/src/lib/broadcast.ts`.

### Reconnection and heartbeat

- **Client reconnects every 3 seconds** on error. On browser tab focus-restore, the client also force-reconnects immediately.
- **Server sends a keep-alive heartbeat every 20 seconds** (an HTTP comment line). This prevents nginx and other proxies from closing idle SSE connections — the `nginx.conf.example` `proxy_read_timeout 3600s` provides an extra safety margin.

### nginx configuration

The `nginx.conf.example` already includes a dedicated location block for the SSE endpoint (before the general `/api` block) with `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 3600s`, and `X-Accel-Buffering: no`. Use it as-is — no manual tuning required.

---

## After first deploy

1. Open `https://yourdomain.com` — the BidWar dashboard loads.
2. Log in with your `ADMIN_PASSWORD` to create the first tournament.
3. Test SMS by sending a viewer link from the Tournament Hub.
4. Test the LED display by starting a test auction on a second screen.
