# Buzz Studio — Headless PNG Renderer

Phase 16 foundation: converts `creative_jobs` rows into PNG files.

## Flow

1. Template Studio queues job → `creative_jobs.status = queued`
2. `creative-render-worker` polls every 5s (configurable)
3. Claim job with `FOR UPDATE SKIP LOCKED` → `processing`
4. `@workspace/buzz-studio-render` SSRs the registered React template + contract
5. Playwright screenshots HTML at fixed aspect-ratio dimensions
6. PNG stored via Cloudinary (`bidwar/buzz/{tournamentId}/`) or local private disk
7. Job updated → `completed` + `result_url` (or `failed` + `error_message`)

## Supported templates

Same components as Template Studio — no duplicate render templates:

- `player_spotlight`
- `sold_player`
- `top_buys`
- `team_reveal`

## Aspect ratios

| Ratio | Pixels   |
|-------|----------|
| 1:1   | 1080×1080 |
| 4:5   | 1080×1350 |
| 16:9  | 1920×1080 |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CREATIVE_RENDER_WORKER_ENABLED` | `true` in dev, enable explicitly in prod | Kill switch |
| `CREATIVE_RENDER_POLL_MS` | `5000` | Poll interval |
| `CREATIVE_RENDER_STORAGE` | cloudinary when configured | Set `local` to force disk |
| `CREATIVE_RENDER_LOCAL_DIR` | `./data/creative-renders` | Private local PNG path |
| Cloudinary vars | — | Same as `/api/upload` |

## Isolation

- No public render routes
- No share URLs or WhatsApp
- `result_url` returned only via organizer-scoped creative job API

## Code locations

| Module | Path |
|--------|------|
| SSR + dimensions | `lib/buzz-studio-render/` |
| Worker poll loop | `artifacts/api-server/src/lib/creative-render-worker.ts` |
| Job processor | `artifacts/api-server/src/lib/creative-render-process.ts` |
| Playwright | `artifacts/api-server/src/lib/creative-render-screenshot.ts` |
| Storage | `artifacts/api-server/src/lib/creative-render-storage.ts` |

First-time setup: `pnpm exec playwright install chromium` in api-server context.
