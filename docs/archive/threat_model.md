# Threat Model

## Project Overview

BidWar is a sports-auction platform with two production-relevant deployment modes: a cloud-hosted React + Express + PostgreSQL application and a shipped Electron-based local/offline application backed by a local Express server and SQLite/libSQL-compatible database. Its users include public viewers, team owners, tournament organizers, organizer-account holders, and super admins.

Production scans should focus on the internet-facing cloud API in `artifacts/api-server`, the React client in `artifacts/auction-platform`, and the distributed BidWar Local artifact in `artifacts/bidwar-local`. `artifacts/mockup-sandbox` is a development-only environment and should be ignored unless a production-reachable path to it is demonstrated.

Assumptions for future scans:
- In production, `NODE_ENV` is `production`.
- Replit deployment terminates TLS for public web traffic.
- The mockup sandbox is not deployed to production.

## Assets

- **Tournament operations data** — tournaments, teams, player rosters, bidding state, bid history, purse balances, reports, and analytics. Integrity is critical because unauthorized changes can alter auction outcomes and financial decisions.
- **User and participant contact data** — organizer email/mobile numbers, team owner mobile numbers, player mobile numbers, and related PII stored in tournament/player/team records.
- **Credentials and session state** — admin passwords, organizer-account passwords, tournament organizer passwords, OTP/reset flows, Google-linked identities, and server-side session records.
- **Business-control flags** — license status, admin lock state, reset counts, local/cloud sync state, and access codes used to gate team-owner bidding flows.
- **Application secrets** — database credentials, Twilio credentials, session secret, Google OAuth credentials.

## Trust Boundaries

- **Browser to cloud API** — all frontend requests cross from an untrusted client into the Express API; client-side route guards are not security controls.
- **Electron renderer / LAN clients to BidWar Local server** — the packaged app exposes a local HTTP server that may be reachable from the host and local network; any route exposed there must assume untrusted callers.
- **API to database** — cloud API writes to PostgreSQL and local app writes to local DB state; authorization failures at the route layer become direct data tampering.
- **Public to organizer/admin boundary** — viewer and owner-facing routes coexist with organizer/admin management endpoints, so each sensitive operation must enforce role checks server-side.
- **Team-owner gate boundary** — owner-panel access codes are weaker than organizer/admin privileges and must only authorize the specific team actions they are intended to allow.
- **Server to third-party services** — Google OAuth and Twilio Verify calls use secret credentials and cross a trust boundary to external services.
- **Local-to-cloud sync boundary** — BidWar Local can export/import and push results into the cloud system; sync endpoints must not allow unauthorized overwrite or leakage of cloud-linked tournament data.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`
- Desktop/local entry points: `artifacts/bidwar-local/electron/main.ts`, `artifacts/bidwar-local/src/server/**/*.ts`
- Public/authenticated/admin boundaries live mostly in `artifacts/api-server/src/routes/auth.ts`, `teams.ts`, `players.ts`, and `auction.ts`
- Highest-risk areas: route-level authorization, tournament export/sync paths, organizer/admin auth, local server network exposure, and any endpoint returning mobile numbers/access codes
- Usually ignore: `artifacts/mockup-sandbox/**` unless production reachability is shown

## Threat Categories

### Spoofing

The system supports multiple roles: public viewers, team owners, tournament organizers, organizer-account users, and admins. The server must authenticate each privileged caller according to the intended role and must not treat frontend state, route selection, or hidden UI as proof of identity. Team-owner bid actions must be bound to the verified team, and admin/organizer actions must require a valid authenticated session.

### Tampering

Auction state, purse balances, sold-player assignments, tournament settings, and local/cloud sync results are business-critical. All state-changing routes must enforce server-side authorization and validate that the caller is allowed to mutate the target tournament or team. The local server must not trust any caller merely because it is on the same machine or LAN.

### Information Disclosure

The application stores player, organizer, and team-owner mobile numbers plus access codes and internal operational data. Public responses must exclude sensitive fields unless the caller is explicitly authorized. Export, search, analytics, and sync endpoints must not leak full datasets, hidden access codes, or cross-tournament PII to unauthenticated or under-privileged callers.

### Denial of Service

Public and weakly gated endpoints can trigger database-heavy search/export/report operations and repeated auth or OTP flows. Sensitive endpoints must avoid being anonymously abusable at high volume, and external-service calls such as Twilio/Google integrations should not be exposed in ways that let attackers exhaust quota or operator attention.

### Elevation of Privilege

This codebase is especially sensitive to broken function-level access control because organizers and admins can create tournaments, change rosters, control auctions, reset state, and export full data snapshots. The system must enforce these privileges server-side on every relevant route. Passwords and recovery flows must not allow attackers to convert weaker access into organizer/admin control or recover credentials from stored plaintext.