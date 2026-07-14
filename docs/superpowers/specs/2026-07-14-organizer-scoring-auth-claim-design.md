# Organizer Scoring Auth + Tournament Auto-Claim

**Date:** 2026-07-14  
**Status:** Approved  
**Scope:** Scoring-app unauthenticated redirect + claim unlinked tournaments on organizer account auth

## Problem

Opening a scoring link (e.g. `/scoring-app/tournament/:id/badminton`) without an organizer account session sends users to the **per-tournament password gate** (`/tournament/:id/login`) instead of the regular organizer signup/login portal (`/organizer`).

That blocks two intended outcomes:

1. **Scoring-only users** — people who never ran an auction should still sign up and use scoring.
2. **Auction organizers** — when the same person signs up with the mobile/email already stored on their tournament(s), those tournaments should appear in their portal.

## Goals

- Unauthenticated access to scoring (or any guarded tournament) routes → `/organizer?next=<returnTo>`.
- After signup/login, return to `next` (including `/scoring-app/...` via full page load).
- On signup/login/Google cookie issue, auto-claim tournaments whose contact fields match the account and that are not already linked to another organizer.
- Keep the per-tournament password gate for **logged-in accounts that do not own the tournament** (shared operator password).

## Non-goals

- Removing the tournament password gate entirely.
- A separate scoring-only “create tournament” wizard (no auction fields) — future work.
- Changing admin link/unlink or license flows.

## Current behavior (relevant)

| Path | Behavior today |
|------|----------------|
| Guarded tournament page, no account | Redirect to `/organizer?next=...` |
| Guarded **scoring-app** page, no account | Redirect to `/tournament/:id/login` (bug) |
| Account logged in, not tournament owner | Redirect to tournament password login |
| Account owns tournament (`organizerId` match) | `/auth/organizer/:id/me` grants access |
| Portal tournament list | Only rows where `tournaments.organizer_id = account.id` |
| Signup/login | Does **not** claim by `organizer_mobile` / `organizer_email` |

## Design

### 1. Access redirect (`OrganizerGuard`)

File: `artifacts/auction-platform/src/components/organizer-guard.tsx`

When tournament session is missing and host is not BidWar Local:

1. Call `checkOrganizerAccountAuth()`.
2. If **not** `account.loggedIn`:
   - Redirect to `/organizer?next=<returnTo>` where `returnTo` is full path + query of the current page.
   - If currently under scoring-app (`pathname` starts with scoring base), use `window.location.href` (cross-app).
   - Otherwise use in-app `navigate(..., { replace: true })` (or equivalent).
3. If **account logged in** but no tournament session:
   - Keep existing redirect to `/tournament/:id/login?next=...` (password / operator path).
4. Owners continue to pass via existing `/auth/organizer/:id/me` ownership bootstrap — no change required there.

Misleading UI copy while redirecting (“Redirecting to tournament login…”) should be updated to a neutral message (e.g. “Redirecting to sign in…”) since the destination may be `/organizer`.

### 2. Auto-claim unlinked tournaments

**Match rules** (either is enough):

- Normalized organizer `mobile` equals tournament `organizer_mobile`, **or**
- Non-empty organizer `email` equals tournament `organizer_email` (trim, case-insensitive recommended for email).

**Safety:**

- Only update rows where `organizer_id IS NULL`.
- Never overwrite an existing `organizer_id` (no steal from another account).
- Prefer matching via the same mobile normalization already used elsewhere (`parseIndianMobile` / stored normalized form).

**When to run:** after a successful organizer account identity is established, before or as part of issuing the auth cookie / response tournaments list:

- Mobile signup verify (`POST /auth/organizer-account/signup/verify`)
- Email signup (`POST /auth/organizer-account/signup/email`)
- Account login (`POST /auth/organizer-account/login`)
- Shared helper used by Google / other flows that call `issueOrganizerAuthCookie` (so OAuth also claims)

Suggested helper (server): `claimTournamentsForOrganizer(organizerId, { mobile, email })` → sets `organizer_id`, returns claimed ids; then existing org-map / tournament list queries include them.

### 3. Post-auth navigation

No new client navigation API. Existing `navigateAfterOrganizerAuth` already full-page-loads `/scoring-app` paths. Ensure `?next=` from scoring redirects is preserved through signup/login tabs.

### 4. Scoring-only users (this phase)

- New users sign up at `/organizer`, then use portal create tournament and/or open a scoring link after auth.
- Auction field requirements on create remain unchanged in this phase.

## Error handling / edge cases

| Case | Behavior |
|------|----------|
| Tournament already linked to another organizer | Skip (no claim) |
| Mobile matches one tournament, email matches another | Claim both (each unlinked) |
| Two accounts could match same unlinked tournament | First successful auth that matches wins; second sees no claim |
| Local venue host | Unchanged (existing LocalVenueGate / bootstrap) |
| Direct `/tournament/:id/login` bookmark | Out of scope this phase (Approach B deferred) |

## Testing

- Unauthenticated open of `/scoring-app/tournament/:id/badminton` → lands on `/organizer?next=...` (not password gate).
- After login/signup with `next` set → returns to scoring URL.
- Signup with mobile matching an unlinked tournament’s `organizer_mobile` → tournament appears in portal; `/me` grants organizer session.
- Login with email matching unlinked `organizer_email` → same.
- Tournament with `organizer_id` already set to another user → not claimed.
- Account logged in, non-owner → still sees tournament password gate.

## Files likely touched

- `artifacts/auction-platform/src/components/organizer-guard.tsx`
- `artifacts/api-server/src/routes/auth.ts` (claim helper + call sites)
- Possibly a small shared claim helper under `artifacts/api-server/src/lib/` if preferred for tests

## Success criteria

1. Scoring links without session open the regular organizer signup/login UI.
2. Matching auction organizers see related unlinked tournaments after signup/login.
3. Operator password path for non-owners remains intact.
