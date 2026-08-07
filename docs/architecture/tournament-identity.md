# Tournament Identity

**Status:** Phase 1 — Product Boundary Restoration  
**Owner:** BidWar Platform (event layer)  
**Not owned by:** Auction · Sports · Broadcast

## Purpose

Tournament Identity is the shared brand and media layer for one event. Every product inherits it so Auction, Sports, Broadcast, and Public feel like the same tournament — without sharing navigation, Mission Control, or workflows.

## Owns

- Tournament name, logo, banner
- Sponsors, powered-by, partner logos
- Brand theme, color palette, typography hooks
- Opening / closing media, LED & presentation asset refs
- Social / certificate / jersey branding hooks (as present on tournament records)

## Does not own

- Auction bid flow, purse, sold/unsold
- Sports competition, fixtures, scoring, standings
- Broadcast OBS scene logic
- Product navigation or Mission Control

## Code

- Contract: `@workspace/platform-core` → `tournament-identity.ts`
- Normalize via `normalizeTournamentIdentity()` from existing tournament payloads
- No new endpoints in Phase 1

## Constitutional rule

Products may share Identity + design system.  
Products must never share navigation, operator experience, Mission Control, or business lifecycle.
