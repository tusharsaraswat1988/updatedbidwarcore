# BIDWAR Security Hardening Report

**Date:** 17 June 2026  
**Scope:** P0 + HIGH risk fixes + verify-access rate limiting  
**Status:** Implemented — unit tests 13/13 passed

---

## Executive Summary

Security hardening was applied across public APIs, auction bidding, organiser authorization, serializers, and owner verify-access. Public endpoints no longer expose mobile numbers, emails, owner PII, or internal tournament secrets. Cross-tournament team IDOR is blocked with 403. Organiser access is now strictly tournament-scoped.

| Area | Risk Before | Risk After |
|------|-------------|------------|
| Public PII exposure (mobile/email) | **CRITICAL** | **LOW** |
| Cross-tournament team IDOR | **CRITICAL** | **LOW** |
| Unrelated organiser access | **HIGH** | **LOW** |
| Tournament private data leak | **HIGH** | **LOW** |
| Owner data on public displays | **HIGH** | **LOW** |
| verify-access brute force | **MEDIUM** | **LOW** |
| auctionCode as API auth | **N/A** (client-only) | **N/A** (confirmed) |

---

## P0 Issue #1 — Public Player Mobile Number Exposure

### Problem
`GET /api/global-players/search` and `GET /api/global-players/:gpid` exposed `mobileNumber` (and email on related player endpoints) to unauthenticated users.

### Fix
- Created **PublicPlayerSerializer** / **PrivatePlayerSerializer** (global + tournament players)
- Public responses strip: `mobileNumber`, `email`, payment fields
- Organisers/admins receive private serializer when authenticated
- `POST /api/global-players` now requires organiser/admin auth
- Auction state `currentPlayer` uses `publicAuctionPlayerSerializer` (no mobile on public SSE/GET)

### Files
- `artifacts/api-server/src/lib/serializers/global-player.ts`
- `artifacts/api-server/src/lib/serializers/player.ts`
- `artifacts/api-server/src/routes/global-players.ts`
- `artifacts/api-server/src/routes/players.ts`
- `artifacts/api-server/src/routes/auction.ts`

### Public-safe player fields
`id`, `name`, `gender`, `city`, `state` (via city), `sport`, `role`, `photoUrl`, `basePrice`, `soldPrice`, `status`, statistics/achievements intended for display — **no mobile, no email**.

---

## P0 Issue #2 — Cross Tournament Team IDOR

### Problem
`POST /api/tournaments/:tournamentId/auction/bid` loaded team by `teamId` only — a team from tournament B could bid in tournament A.

### Fix
`validateTeamBelongsToTournament()` / `requireTeamInTournament()`:
- Team found in correct tournament → proceed
- Team exists elsewhere → **403** `Team does not belong to this tournament`
- Team not found → **404**

### Locations fixed

| # | File | Endpoint / function |
|---|------|-------------------|
| 1 | `routes/auction.ts` | `POST .../auction/bid` |
| 2 | `routes/auction.ts` | `POST .../auction/manual-sell` |
| 3 | `routes/auction.ts` | `POST .../cheer` (already had validation) |
| 4 | `routes/players.ts` | `POST .../players` (teamId) |
| 5 | `routes/players.ts` | `PATCH .../players/:id` (teamId) |
| 6 | `lib/purse-protection.ts` | `computeTeamPurseProtection()` |
| 7 | `routes/purse-boosters.ts` | `GET .../purse-boosters?teamId=` |
| 8 | `routes/teams.ts` | verify-access, GET/PATCH/DELETE (already scoped) |
| 9 | `routes/push.ts` | push subscribe (already scoped) |
| 10 | `bidwar-local/.../auction.ts` | `POST /bid`, `POST /manual-sell` |
| 11 | `bidwar-local/.../teams.ts` | all team routes (already scoped) |

### New helper
`artifacts/api-server/src/lib/team-tournament-guard.ts`

---

## P0 Issue #3 — Tournament Scoped Organiser Authorization

### Problem
Any JWT with `organizerAccountId` passed `isOrganizerOrAdmin()` for **every** tournament, without checking `tournaments.organizerId`.

### Fix
New helpers in `artifacts/api-server/src/middleware/require-organizer.ts`:

- `isTournamentOrganizer(req, tournamentId, tournamentOrganizerId)` — strict sync check
- `requireTournamentOrganizer(req, res, tournamentId)` — async guard for mutations
- `canAccessPrivateTournamentData(req, tournamentId)` — for GET serializer selection

### Access rules (after fix)

| Caller | Allowed? |
|--------|----------|
| `isAdmin` | Yes — all tournaments |
| `organizer[tournamentId]` in JWT (password login) | Yes — that tournament |
| `organizerAccountId === tournament.organizerId` | Yes — owned tournaments only |
| `organizerAccountId` on unrelated tournament | **No — 403** |

### Protected route groups
- Auction controls (21 mutation endpoints in `auction.ts`)
- Player management (`players.ts`)
- Team management (`teams.ts`)
- Purse / boosters (`purse-boosters.ts`)
- Categories (`categories.ts`)
- Scoring (`scoring.ts`, `scoring-foundation.ts`)
- Tournament settings (`tournaments.ts` PATCH/DELETE)
- Master sports / cricket roster (`master-sports.ts`, `cricket-master-sports.ts`)
- Team reports (`team-reports.ts`)

---

## HIGH Issue #1 — Public Tournament Data Leak

### Problem
`GET /api/tournaments` and `GET /api/tournaments/:id` returned organiser mobile, email, UPI, admin flags, scoring PIN, reset metadata to public users.

### Fix
- **PublicTournamentSerializer** — register, display, live, obs, side-display safe fields
- **PrivateTournamentSerializer** — full config for tournament owner / admin

### Stripped from public tournament responses
`organizerMobile`, `organizerEmail`, `organizerId`, `upiId`, `paymentVerificationMethod`, `paymentCollectionMode`, `adminLocked`, `scoringPin`, `hasScoringPin`, `resetCount`, `lastResetAt`, `lastResetBy`, `localModeEnabled`

### Kept on public (needed for UX)
`auctionCode` (display gate only — **not** API auth), `licenseStatus`, audio/display config, registration flags (fee/deadline via `registration-status` includes `upiId` for payment flow)

### Files
- `artifacts/api-server/src/lib/serializers/tournament.ts`
- `artifacts/api-server/src/routes/tournaments.ts`

---

## HIGH Issue #2 — Team Purse & Owner Data Exposure

### Problem
Public team and purse endpoints exposed `ownerName`, `ownerMobile`, `ownerEmail`, `accessCode`.

### Fix
**publicTeamSerializer** exposes only:
- `id`, `tournamentId`, `name`, `shortCode`, `color`, `logoUrl`
- `purse`, `purseUsed`, `isBiddingEnabled`
- `requiresAccessCode` (boolean — not the code itself)
- `createdAt`

**teamPurseSnapshot** no longer includes `ownerName`.

### Files
- `artifacts/api-server/src/lib/serializers/team.ts`
- `artifacts/api-server/src/routes/teams.ts`
- `artifacts/api-server/src/lib/team-purse-snapshot.ts`
- `artifacts/bidwar-local/src/server/routes/teams.ts`

---

## HIGH Issue #3 — Auction Code Is Not a Security Boundary

### Audit result
`auctionCode` is **never** used for server-side API authorization.

| Layer | Usage |
|-------|--------|
| Database | `tournaments.auction_code` |
| API | Not checked on any route |
| Frontend | Client-only `TournamentCodeGate` + `sessionStorage` for display URLs |

Authorization relies on: JWT cookie, tournament-scoped organiser check, owner `accessCode` on bids.

**No code change required** — confirmed by codebase audit.

---

## BONUS — verify-access Rate Limiting

### Rules
- **5 failed attempts** → **15 minute lockout**
- Response: `429` with `lockoutRemainingSec`
- Logs: IP, `teamId`, `tournamentId`, timestamp (failures + lockout events)
- Successful verify clears failure counter

### Files
- `artifacts/api-server/src/lib/verify-access-guard.ts`
- `artifacts/api-server/src/routes/teams.ts` (`POST .../verify-access`)

---

## All Files Changed

### New files
```
artifacts/api-server/src/lib/serializers/global-player.ts
artifacts/api-server/src/lib/serializers/player.ts
artifacts/api-server/src/lib/serializers/team.ts
artifacts/api-server/src/lib/serializers/tournament.ts
artifacts/api-server/src/lib/team-tournament-guard.ts
artifacts/api-server/src/lib/verify-access-guard.ts
artifacts/api-server/src/__tests__/security-hardening.test.ts
docs/SECURITY_HARDENING_REPORT.md
```

### Modified — API server
```
artifacts/api-server/src/middleware/require-organizer.ts
artifacts/api-server/src/routes/global-players.ts
artifacts/api-server/src/routes/teams.ts
artifacts/api-server/src/routes/tournaments.ts
artifacts/api-server/src/routes/players.ts
artifacts/api-server/src/routes/auction.ts
artifacts/api-server/src/routes/categories.ts
artifacts/api-server/src/routes/purse-boosters.ts
artifacts/api-server/src/routes/scoring.ts
artifacts/api-server/src/routes/scoring-foundation.ts
artifacts/api-server/src/routes/master-sports.ts
artifacts/api-server/src/routes/cricket-master-sports.ts
artifacts/api-server/src/routes/team-reports.ts
artifacts/api-server/src/lib/purse-protection.ts
artifacts/api-server/src/lib/team-purse-snapshot.ts
```

### Modified — Local mode
```
artifacts/bidwar-local/src/server/routes/auction.ts
artifacts/bidwar-local/src/server/routes/teams.ts
```

### Modified — Frontend (backward compat)
```
artifacts/auction-platform/src/pages/player-register.tsx
artifacts/auction-platform/src/pages/players.tsx
```

---

## Security Test Results

```bash
cd artifacts/api-server
npx vitest run src/__tests__/security-hardening.test.ts
# Test Files  1 passed (1)
# Tests       13 passed (13)
```

| Role | Scenario | Expected | Result |
|------|----------|----------|--------|
| Public user | Player serializer | No mobile/email | PASS |
| Public user | Team serializer | No owner PII | PASS |
| Public user | Tournament serializer | No organiser secrets | PASS |
| Public user | Global player search | No mobile | PASS |
| Team owner | 5+ wrong verify-access | 429 lockout | PASS |
| Organiser (owner) | Matching organizerId | Allowed | PASS |
| Organiser (other) | Wrong tournament | Denied | PASS |
| Admin | Any tournament | Allowed | PASS |
| Attacker | Cross-tournament teamId | 403 | PASS |

### Recommended manual staging checks
1. Public user on `/display`, `/live`, `/register` — Network tab: no mobile/email in JSON
2. Owner app bid with valid `accessCode` — still works
3. Organiser A mutating Organiser B's tournament — **403**
4. Bid with foreign `teamId` — **403**
5. 6× wrong verify-access — **429** on 6th

---

## Breaking Changes

| Change | Who affected | Mitigation |
|--------|--------------|------------|
| Unrelated organisers lose cross-tournament write access | Multi-tournament organiser accounts | Must own tournament or use per-tournament password login |
| Public teams API drops `ownerName` | Live viewer public pages | By design — owner line hidden on public |
| Global search no longer returns `mobileNumber` | Registration autocomplete | Frontend updated; server still matches by mobile internally |
| `POST /global-players` requires auth | Anonymous upsert | Use authenticated organiser session |
| verify-access 429 after 5 failures | Brute-force attempts | 15 min cooldown |

**UI/UX layout unchanged.** Only minimal autocomplete logic updates.

---

## Serializer Reference

### PublicPlayerSerializer (tournament)
Omits: `mobileNumber`, `email`, `registrationPaymentStatus`, `utrNumber`, `paymentScreenshotUrl`, `paymentSubmittedAt`

### PrivatePlayerSerializer (tournament)
Full record including PII and payment fields — organisers/admins only.

### publicTeamSerializer
Omits: `ownerName`, `ownerMobile`, `ownerEmail`, `ownerPhotoUrl`, `accessCode`  
Includes: `requiresAccessCode: boolean`

### publicTournamentSerializer
Display/register/live safe fields + `licenseStatus` + `auctionCode`  
Omits organiser contact, payment secrets, admin/scoring internals.

### privateTournamentSerializer
Full tournament config including `organizerMobile`, `upiId`, `scoringPin`, `adminLocked`, etc.

---

## How to Re-run Tests

```powershell
cd C:\CWP\updatedbidwarcore\artifacts\api-server
npx vitest run src/__tests__/security-hardening.test.ts
```

---

*Generated as part of BIDWAR Security Hardening — P0 + HIGH risk fixes.*
