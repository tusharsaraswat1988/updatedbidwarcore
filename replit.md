# BidWar — India's Live Sports Auction Platform

A full-stack broadcast-quality live sports auction system for cricket, football, kabaddi, and other franchise-based tournaments. Supports tournament management, live auction operations, team owner bidding, LED big-screen display, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/auction-platform run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `NEON_DATABASE_URL` — Neon PostgreSQL connection string (renamed from DATABASE_URL to avoid Replit's managed-DB conflict warning)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, framer-motion, recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/auction-platform/src/pages/` — all page components
- `artifacts/auction-platform/src/components/layout.tsx` — sidebar + fullscreen layouts
- `artifacts/auction-platform/src/lib/format.ts` — Indian rupee formatting helpers
- `artifacts/api-server/src/routes/` — all API route handlers
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit)
- `lib/db/src/schema/` — Drizzle table schemas (tournaments, teams, categories, players, bids, auction_sessions)

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks. All mutations use flat params `{ tournamentId, data }` (no `params` wrapper).
- **Query options need `queryKey`**: Generated hooks require `queryKey` in the `query` option — always use the corresponding `getXxxQueryKey(...)` function.
- **Dark mode only**: `dark` class applied at root. No theme toggle. Sports broadcast aesthetic.
- **Indian number formatting**: All money values use `formatIndianRupee` / `formatShortIndianRupee` from `@/lib/format`.
- **Auction state polling**: Operator panel polls every 1.5s, display screen polls every 1s, owner panel polls every 1s.

## Product

- **Dashboard**: List and search all tournaments
- **Tournament Hub**: Summary stats (players sold/unsold, total spent) + team purse overview
- **Teams**: CRUD for franchise teams with color picker and purse management
- **Categories**: Player tiers (Platinum, Gold, Silver, Emerging) with min bid and increment settings
- **Players**: Full player registry with role, stats, category assignment; filter by status
- **Operator Panel** (`/tournament/:id/auction`): Start/pause/next/random player, quick bid buttons per team, SOLD/UNSOLD actions, undo, bid history, player queue
- **LED Display** (`/tournament/:id/display`): Fullscreen broadcast view — animated player card, live bid amount, leading team, SOLD stamp animation, team purse strip
- **Owner Panel** (`/tournament/:id/owner/:teamId`): Tablet-optimized big bid button for team owners, shows purse remaining and leading status
- **Reports** (`/tournament/:id/reports`): Bar charts, pie chart, team purse breakdown, top sold players

## User preferences

- No emojis in UI
- Dark mode only, sports broadcast aesthetic
- Indian Rupee formatting throughout (₹1,00,00,000 style)
- Use lucide-react icons

## UX decisions

- **Break Timer sidebar entry** (`/tournament/:id/break-timer`) is a dedicated page, not a dialog. This is intentional: it gives the operator a focused, full-page view of the break countdown controls (start, extend, cancel, label) that is easier to use on a second screen or tablet during a live event. The operator panel also has an inline countdown dialog for quick access. Both flows coexist; the sidebar page is the primary break-timer workflow.

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing the OpenAPI spec
- Mutations in generated hooks use flat params: `mutateAsync({ tournamentId, data })` NOT `mutateAsync({ params: { tournamentId }, data })`
- Query options need explicit queryKey: `{ query: { queryKey: getXxxQueryKey(id), enabled: !!id } }`
- API server uses plain `zod` (not `zod/v4`) due to esbuild bundling constraints

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
