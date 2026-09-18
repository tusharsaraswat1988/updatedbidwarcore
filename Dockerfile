# syntax=docker/dockerfile:1
# BidWar — multi-stage production Dockerfile
#
# Build:  docker build -t bidwar .
# Run:    docker run -p 3000:3000 --env-file .env bidwar
#
# The final image runs a single Node process that serves both the API and the
# pre-built Vite frontends (auction-platform at /, owner-app at /owner-app/,
# scoring-app at /scoring-app/, and mobile-app at /mobile/).

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

# Build TypeScript libs → API esbuild bundle → Vite frontends
RUN pnpm run build:deploy

# Create a clean production deploy directory for the api-server:
# pnpm deploy produces a flat node_modules/ (no devDeps, no pnpm symlinks)
# that works correctly when copied into a fresh image.
RUN pnpm --filter @workspace/api-server deploy --prod /deploy

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true

WORKDIR /app

# Production node_modules — flat layout from pnpm deploy, no devDeps
COPY --from=builder /deploy/node_modules ./node_modules

# Monorepo root marker — loadAppEnv/findRepoRoot walks up from dist/ looking for this
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# API server bundle (esbuild output + pino worker threads)
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Pre-built Vite frontends (Brotli + Gzip compressed assets)
COPY --from=builder /app/artifacts/auction-platform/dist/public ./artifacts/auction-platform/dist/public
COPY --from=builder /app/artifacts/owner-app/dist/public        ./artifacts/owner-app/dist/public
COPY --from=builder /app/artifacts/scoring-app/dist/public      ./artifacts/scoring-app/dist/public
COPY --from=builder /app/artifacts/mobile-app/dist/public       ./artifacts/mobile-app/dist/public

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
