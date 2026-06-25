# Live Auction LED — 3 Directions Demo

Build sab 3 design directions as full-screen landscape routes, with a small floating switcher to compare. After you pick the winner, baaki 2 delete kar denge aur winning direction ko production-grade `DisplayShell` pattern me refactor karenge.

## Routes

```text
/auction              → index, redirects to /auction/v1 + mounts switcher
/auction/v1           → Stadium Gold Zoned (3-column grid)
/auction/v2           → Split-half Broadcast (left portrait | right bidding)
/auction/v3           → Broadcast Banded (3 horizontal bands, mega bid)
```

Har route ek full-bleed landscape 16:9 LED stage render karega — `w-screen h-screen` ya `aspect-video` true 1920×1080 mental model pe. Desktop preview me edge-to-edge dikhega.

## Shared scaffolding

- `src/lib/auction-demo/mock-auction-state.ts` — mock `useAuctionState()` hook with **same prop shape** as your prod SSE socket emits (player, currentBid, bidder, bidders, countdown, ladder, increment, nextMin, state). Default: ACTIVE BIDDING. Plain in-memory object — no realtime yet, but contract matches so prod swap is one-line.
- `src/lib/auction-demo/mock-data.ts` — Rohan Verma + ladder + teams.
- `src/lib/display-broadcast-layout.ts` — your exact tokens verbatim (`BROADCAST_SAFE_X/Y`, `BROADCAST_MAIN_WIDTH`, `BROADCAST_LABEL_CLASS`, `BROADCAST_META_CLASS`).
- `src/lib/display-theme.ts` — your `DISPLAY_THEMES` system verbatim, with one **Stadium Gold** preset added as default for the demo.
- `src/components/auction-demo/DirectionSwitcher.tsx` — fixed bottom-center pill, 3 buttons (V1 / V2 / V3) + current route highlighted, hides on hover-away after 3s. Floats above stage, doesn't break LED illusion.
- `src/components/auction-demo/AuctionStage.tsx` — shared landscape wrapper (`fixed inset-0 bg-stage flex items-center justify-center overflow-hidden` → `aspect-video w-full max-h-screen`).

## Per-direction components

Each direction = ONE file under `src/components/auction-demo/directions/`:
- `DirectionA_Zoned.tsx` — CSS grid `grid-cols-[1fr_1.6fr_1fr] grid-rows-[auto_1fr_auto]`. Each of 8 zones owns its cell. No absolutely-positioned children inside the stage.
- `DirectionB_Split.tsx` — `grid-cols-2`, left = portrait (60%) + identity (40%), right = timer/brand row + huge bid + ladder/increment row.
- `DirectionC_Banded.tsx` — `grid-rows-[22%_56%_22%]`, top = identity strip, middle = mega bid + team chip + bidder dots, bottom = chyron with brand + ladder + increment.

All three pull from the same mock hook, so data is identical and only composition differs. Stadium Premiere taste locked: deep near-black stage, broadcast-gold accent, Bebas Neue + Barlow Condensed + JetBrains Mono.

## Fonts

Add to `src/routes/__root.tsx` head: Google Fonts link for Bebas Neue, Barlow Condensed (500/600/700), JetBrains Mono (500/700). Register `--font-display`, `--font-condensed`, `--font-mono` in `src/styles.css` under `@theme`.

## State (ACTIVE BIDDING only for now)

Mock data shown in all 3:
- Player: Rohan Verma, All-Rounder, India, base ₹50L; SR 142.5 / Avg 38.2 / Matches 122
- Current bid: ₹2.75Cr by MUM (Mumbai Mavericks), 4 bidders
- Countdown: 00:08 (static for now, ticking comes later)
- Ladder: KOL ₹2.50Cr → MUM ₹2.25Cr → HYD ₹2.00Cr
- Increment +₹25L, next min ₹3.00Cr
- Brand: ELITE LEAGUE — Player Auction 2024, LIVE pill green

Other states (Idle / Sold / Unsold / Paused / Break) ko **abhi skip** kar rahe hain — pehle composition pick ho jaaye, phir winning direction me sab states + state-toggle dev toolbar add karenge.

## Out of scope (next round)

- State toggle toolbar (Idle / Bidding / Sold / Unsold / Paused / Break)
- Animated effects layer (SOLD stamp, team-color sweep)
- ServerCountdown ticking
- Theme/palette picker (preset + custom)
- Production refactor to `DisplayShell`-style memo-isolated children

## Acceptance

- `/auction` desktop preview pe khulta hai, default v1
- 3 routes navigable from floating switcher
- Har route full landscape 16:9, ~5% broadcast-safe inset visible, sab 8 zones non-overlapping
- Bid figure har direction me dominant visual anchor
- Same mock data har route me identical
- Mobile/tablet pe gracefully degrade kare (letterbox black bars) — no portrait reflow

Plan approve karte hi build start.
