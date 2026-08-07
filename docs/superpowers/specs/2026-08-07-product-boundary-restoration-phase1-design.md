# Product Boundary Restoration — Phase 1 Design

**Date:** 2026-08-07  
**Status:** Implemented (ownership restoration)  
**Supersedes (product ownership only):** PXP “Tournament Mission Control is the sole operator home inside Auction” ([`2026-08-05-product-experience-phase-pxp-design.md`](./2026-08-05-product-experience-phase-pxp-design.md), Phase 5 home cutover)

PXP modules (Competition, Fixtures, Scheduling, Matches, Runtime, Live Operations) remain valuable. They are owned by **Sports**, not Auction.

---

## Constitutional model

```
BidWar Platform
├── Tournament Identity   (shared brand / media — not a product)
├── Auction               (players, teams, bid flow, LED, reports, …)
├── Sports                (Mission Control, fixtures, runtime, public, …)
│     ├── Cricket
│     └── Badminton
└── Broadcast             (OBS / production — future product shell)
```

**Law:** Products may share Identity + design system. They must not share navigation, Mission Control, workflow, or runtime.

**Path vs ownership:** `/scoring-app` is a temporary host for the Sports product UI. Ownership of Mission Control is **Sports**, not the URL prefix.

---

## Phase 1 ownership map

| Surface | Owner | Route (current host) |
|---------|-------|----------------------|
| Auction Overview | Auction | `/tournament/:id` (auction-platform) |
| Tournament Mission Control | Sports | `/scoring-app/tournament/:id/mission-control` |
| Auction Control / LED / Share | Auction | auction-platform |
| Cricket / Badminton ops | Sports | `/scoring-app/tournament/:id/score/*` or `/badminton/*` |
| Tournament Identity | Platform / Event | Consumed via `normalizeTournamentIdentity()` |

---

## Tournament Identity

- Contract: `@workspace/platform-core` → `tournament-identity.ts`
- Doc: [`docs/architecture/tournament-identity.md`](../../architecture/tournament-identity.md)
- Thin normalization over existing tournament payloads — no new CMS / endpoints

---

## Feature flags

| Fact | Effect |
|------|--------|
| Platform `cricket` / `badminton` false | No cricket / badminton Sports entry |
| Tournament `scoringEnabled` false | No Sports CTA in Auction; Sports TMC shows unavailable |
| Sport mismatch | Live Ops / nav only show that sport’s capabilities |

Client structures independent `cricket` / `badminton` / `broadcast` / `auction` flags. API may still mirror `scoring` onto sports until Phase 1.1 env split.

---

## Capabilities

`SportCapabilities` on SportsShell nav configs (`getCricketSportNav` / `getBadmintonSportNav`) declare sport-specific concepts. Shared Live Ops / Mission Control chrome branches on capabilities — not hard-coded cricket assumptions.

---

## Explicit non-goals (Phase 1)

- No page file moves / package extraction
- No deletion of SportsShell, Match Center, Public Tournament, Rule Engine, Presentation Engine, Runtime
- No new product features
- No redesign

---

## Follow-ups (not Phase 1)

1. Independent server env flags for cricket / badminton / broadcast / auction
2. Extract sports UI source from `auction-platform` into Sports-owned package
3. Explicit Auction → Sports export/import UX (sole functional bridge)
