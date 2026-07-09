# syntax=docker/dockerfile:1
# BidWar — multi-stage production Dockerfile
#
# Build:  docker build -t bidwar .
# Run:    docker run -p 3000:3000 --env-file .env bidwar
#
# The final image runs a single Node process that serves both the API and the
# pre-built Vite frontends (auction-platform at / and owner-app at /owner-app/).

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy everything (see .dockerignore for exclusions)
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build TypeScript libs → API esbuild bundle → Vite frontends → Playwright Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN pnpm run build

# Create a clean production deploy directory for the api-server:
# pnpm deploy produces a flat node_modules/ (no devDeps, no pnpm symlinks)
# that works correctly when copied into a fresh image.
RUN pnpm --filter @workspace/api-server deploy --prod /deploy

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true
ENV CREATIVE_RENDER_WORKER_ENABLED=true
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

WORKDIR /app

# Playwright Chromium system dependencies (Debian bookworm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Production node_modules — flat layout from pnpm deploy, no devDeps
COPY --from=builder /deploy/node_modules ./node_modules

# Playwright Chromium binaries (installed during build)
COPY --from=builder /app/.playwright-browsers ./.playwright-browsers

# API server bundle (esbuild output + pino worker threads)
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Pre-built Vite frontends (Brotli + Gzip compressed assets)
COPY --from=builder /app/artifacts/auction-platform/dist/public ./artifacts/auction-platform/dist/public
COPY --from=builder /app/artifacts/owner-app/dist/public        ./artifacts/owner-app/dist/public

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
