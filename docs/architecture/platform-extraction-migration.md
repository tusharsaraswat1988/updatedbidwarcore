# Platform Extraction Migration

**Date:** 2026-07-23  
**Status:** Phase A–B foundation landed (domain packages + shared moves + shims)

## Philosophy (approved amendment)

Packages are **business domains**, not code containers.

| Domain | Role |
|--------|------|
| `platform-core` | **Minimal kernel** — `apiFetch`, feature flags, URL builders, ports, Vite/dev tooling |
| `auth` | Organizer / owner auth helpers (true platform service) |
| `branding` | Tournament / platform branding assets & icons (true platform service) |
| `player-registry` | PTA, franchise resolution, player identity helpers (true platform service) |
| `media` | Cloudinary / platform audio (true platform service) |
| `notifications` | Domain home (service still in api-server until injectable) |
| `analytics` | Domain home (auction metrics still in Auction) |
| `shared-ui` | Future home for BidWar chrome / page-chrome / SportsShell primitives |
| `sports-*` | Sport domains; **temporary facades** over `badminton-core` / `scoring-core` |
| `auction` | Auction bids/purse/trial domain |

Facades over engines are a **migration technique**, not the end state. Engines should eventually live inside their sport packages.

## Dependency rule

```
platform-core
    ↑
auth · branding · media · player-registry · notifications · analytics · shared-ui
    ↑
sports-badminton · sports-cricket · sports-football · auction
    ↑
apps (api-server, scoring-app, auction-platform, …)
```

Forbidden: Sport→Auction, Sport→Sport, Auction→Sport.

## What moved (this pass)

- From `api-base` → domain packages (with `@workspace/api-base/*` shims)
- `cricket-franchise-registry`, `roster-assignments`, `sync-helpers` → `player-registry`
- Pure `badminton-branding` → `sports-badminton`
- Auction bid/purse modules → `auction`

## What did not move

- Feature pages / Express routes (runtime unchanged)
- `scoring-app` `@` → auction-platform alias
- Full notifications service (api-server coupled)
- Badminton/cricket scoring engines (still `*-core`; sport packages re-export temporarily)

## Compatibility

Old import paths under `@workspace/api-base/...` and `api-server/.../master-sports/{cricket-franchise-registry,roster-assignments,badminton-branding}` remain as **deprecated re-exports**. Prefer domain public APIs.

## Next phases

1. Lift shared chrome into `shared-ui`; stop Cricket→Badminton UI imports  
2. Move Auction→Registry sync adapters into `@workspace/auction`  
3. Move notifications service behind injectable ports into `@workspace/notifications`  
4. Own engines inside `sports-*` (retire facades)  
5. Extract sports UI; kill scoring-app `@` alias  
6. Enforce eslint `no-restricted-imports` zones (see `scripts/check-domain-boundaries.mjs`)
