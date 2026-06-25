# Buzz Studio — Templates

**Status: Phase 18 — Asset-driven content injectors**

Each template composes `BidwarCanvas` with a designer-provided background asset
and injects dynamic content only (photos, logos, names, prices, ranks).

## Architecture

```
Background Asset (Creative Assets Manager)
  → Dynamic Images (player photo, team logo, tournament logo)
  → Dynamic Text (names, amounts, ranks)
  → Footer Branding (BidwarCanvas)
```

Templates do **not** generate design: no cards, gradients, glow, podiums,
glass panels, or decorative UI. Replace the entire visual style by uploading
a new background asset — no React changes required.

## Layout schema

Zone definitions live in:

- `rendering/template-layout-schema.ts` — stack layout types
- `rendering/template-frame-schema.ts` — placeholder frame types (`photoFrame`, `logoFrame`, `nameFrame`, `amountFrame`)
- `rendering/template-frame-registry.ts` — resolves frames per template + ratio
- `templates/top-buys/top-buys-frame-metadata.ts` — Top Buys 4:5 frame coordinates (tune here when art changes)

Shared frame renderers: `rendering/poster-content-frame.tsx`

## Built templates

| Template | ID | Content zones |
|----------|-----|---------------|
| Player Spotlight | `player_spotlight` | tournament header, player photo/name, team |
| Sold Player | `sold_player` | sold label, player, price, team |
| Top Buys | `top_buys` | featured #1 + leaderboard rows |
| Team Reveal | `team_reveal` | tournament header, team logo/name, stats |

## Conventions

- Contracts are data-only — no `backgroundImageUrl` in job JSON
- Background resolved at render time via `buzz_studio_bg_{aspectRatio}` settings
- Same React components power Template Studio preview and PNG export
- No template may import auction business logic directly
