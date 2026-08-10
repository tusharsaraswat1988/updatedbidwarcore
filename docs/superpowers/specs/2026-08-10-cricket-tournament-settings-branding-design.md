# Cricket Tournament Settings (Identity + Branding)

**Date:** 2026-08-10  
**Status:** Approved (Approach A) — implement now

## Goal

Give cricket Sports a badminton-style **Tournament settings** page: identity, sponsors, scoreboard sponsor, venue music, venue banner, plus **Import from Auction** — without courts/rules.

## Decisions

- Sports Setup page inside cricket shell (not Auction deep-link only)
- Identity + media (no courts/rules)
- Separate Sports branding overlay (same storage pattern as badminton: tournament + `scoringSettingsJson.branding` / broadcast presentation), imported from Auction/tournament fields

## Surface

- Route: `/tournament/:id/score/settings`
- Nav: **Tournament settings** (early in primary nav)
- Mission Control `tournament` destination → settings

## API

Under `/api/tournaments/:id/scoring/`:

- `GET/PATCH /branding` — reuse badminton branding load/update helpers
- `PATCH /broadcast-presentation` — music/banner (+ importAuctionMusic / importAuctionBanner)
- `POST /import-tournament-branding` — copy Auction identity + sponsors into Sports overlay

## UI

- Cricket chrome (`CricketOrganizerPageShell`)
- Reuse `SponsorLogosEditor`, venue music/banner panels (cricket transport)
- Copy clarified for cricket LED/OBS / Sports (not Auction panel)

## Out of scope

- Courts / rules sections
- Shared sport-agnostic branding refactor (can follow later)
