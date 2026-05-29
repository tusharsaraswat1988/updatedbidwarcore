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

| Variable | Description |
|---|---|
| `DATABASE_URL` or `NEON_DATABASE_URL` | PostgreSQL connection string |
| `APP_DOMAIN` | Comma-separated production domain(s), e.g. `bidwar.in,www.bidwar.in` |
| `SESSION_SECRET` | Random 32-byte hex string — `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Super-admin password |
| `NODE_ENV` | Set to `production` |
| `SERVE_STATIC` | Set to `true` (single-process mode) |

See `.env.example` for the full list including Cloudinary, Google OAuth, Twilio, VAPID, and SMS keys.

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
   - **Build command**: `pnpm install --frozen-lockfile && pnpm run build`
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
   - **Build command**: `pnpm install --frozen-lockfile && pnpm run build`
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

## Real-time auction (SSE) — important notes

- BidWar uses **Server-Sent Events (SSE)** for live auction updates. SSE is plain HTTP — no WebSocket upgrade is required. It works on all platforms listed above.
- **Single-process only**: the SSE client registry is in-memory. If you run multiple Node instances behind a load balancer, clients on one instance will not receive events broadcast from another. Use a single process (no round-robin). Scale vertically if needed.
- The Node app sends a **heartbeat every 20 seconds** to keep connections alive through proxies.
- The `nginx.conf.example` includes the required `proxy_buffering off` and `proxy_read_timeout 3600` for the SSE endpoint — use it as-is.

---

## After first deploy

1. Open `https://yourdomain.com` — the BidWar dashboard loads.
2. Log in with your `ADMIN_PASSWORD` to create the first tournament.
3. Test SMS by sending a viewer link from the Tournament Hub.
4. Test the LED display by starting a test auction on a second screen.
