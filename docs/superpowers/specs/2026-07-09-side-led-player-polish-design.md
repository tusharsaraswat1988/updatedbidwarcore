# Side LED player panel polish — design

**Date:** 2026-07-09  
**Status:** Approved (Approach 1 — Portrait-dominant stack)

## Problem

The vertical side LED (`DisplayViewport` / `SidePlayerProfilePanel`, 1080×1920) shows the current auction player (photo, name, stats, current bid). It already uses a stadium-gold broadcast language, but the composition feels flat: weak depth, tight hierarchy between photo/stats/bid, and bid updates lack punch for a hall audience watching from a distance.

## Goals

- Keep **Stadium Gold Broadcast** (dark stage, gold accents, existing theme tokens).
- **Photo + name** are the first catch from across the room.
- **Layout rethink + polish** (not a full theme rewrite).
- On bid increase: **strong pop** (scale + gold flash), then settle.
- Stay on the fixed 1080×1920 broadcast canvas; no responsive reflow.

## Non-goals

- Neon / purple “esports” theme
- Cinematic full-bleed overlay redesign
- Sponsor side panel redesign
- Main center LED / horizontal display changes
- New data fields or API changes

## Approved approach

**Portrait-dominant stack** — enlarge the portrait zone, keep name inside the photo gradient, compress the stats band, keep bid as a clear footer with stronger motion on change.

Rejected alternatives:

- **Split hero** (diagonal photo + broadcast plate): more drama, higher layout/edge-case risk.
- **Full-bleed photo + floating chrome**: cinema feel, weaker readability with casual portraits and LED glare.

## Layout (top → bottom)

1. **Header** — Compact bidWAR mark + tournament name (existing `SideBroadcastHeader` role; tighten vertical footprint if needed so portrait gains height).
2. **Portrait frame (~55–60% of content height)** — Gold border, soft vignette/spotlight depth, STAR / serial badges retained. Name + role/category sit in the bottom photo gradient with larger display type.
3. **Stats band** — Thin translucent strip: AGE · CITY · BASE (plus existing extra specs). Secondary to face/name; gold accent on base price only.
4. **Bid footer** — “Current Bid” kicker + large amount. Leading-team tint/glow when a team is leading. Sold/unsold continue to use existing celebration overlays.

## Motion

| Moment | Behavior |
|--------|----------|
| Player enter | Short fade/scale enter (reuse broadcast enter patterns where possible) |
| Bid increase | Strong pop: brief scale-up + gold flash/glow, then settle to rest |
| Idle | Subtle existing depth (spotlight/vignette); no busy loops that distract from the face |
| Sold / unsold | Existing `SideEffectsLayer` / celebration paths unchanged in intent |

## Visual polish (within Stadium Gold)

- Stronger photo frame depth (border + soft outer glow, not neon purple).
- Clearer separation: photo composition → stats → bid (spacing and gold rules, not heavy cards).
- Bid amount remains the largest numeric element in the footer; photo+name remain the largest overall visual mass.
- Typography stays on broadcast fonts already loaded for the canvas (`Bebas Neue` / `Space Grotesk` / `Barlow Condensed` via existing display font loading).

## Implementation touchpoints (expected)

- `SidePlayerProfilePanel` — structure, proportions, name-in-photo hierarchy
- `broadcast-canvas.css` (side-player / bid footer rules) — depth, spacing, bid pop keyframes
- Existing bid/team glow hooks already on the panel — extend for strong pop on amount change
- Do not change `DisplayViewport` scaling contract (1080×1920 fixed canvas)

## Success criteria

- From a distance, face + name read first; bid still obvious in the lower third.
- Bid bumps feel energetic (noticeable pop) without obscuring the player.
- Gold broadcast identity preserved; no new theme family.
- Sponsor panel and center LED unaffected.

## Out of scope reminders

- Changing auction state machine or socket payloads
- Photo quality / upload pipeline
- New badges beyond existing STAR / serial / tag system
