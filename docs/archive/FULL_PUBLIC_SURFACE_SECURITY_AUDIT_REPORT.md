# FULL PUBLIC SURFACE SECURITY AUDIT REPORT

Date: 2026-06-17  
Scope: Public surface audit only (no code changes to application logic)

## Routes Audited

- `/tournament/:id/register`
- `/tournament/:id/display`
- `/tournament/:id/side-display`
- `/tournament/:id/obs`
- `/live/:id`
- `/owner-app/join`
- `/tournament/:id/auction`

## PUBLIC SAFE ROUTES

- `/tournament/:id/obs` is display-oriented on the frontend and uses read-only data hooks.
- `/tournament/:id/display` and `/tournament/:id/side-display` are display routes with no direct mutation actions in page code.
- `/owner-app/join` enforces access code verification when required by team.

## PROTECTED ROUTES

- Frontend route `/tournament/:id/auction` is wrapped with organizer guard.
- Backend auction control endpoints are server-protected by organizer/admin checks:
  - start, pause, next-player, sell, manual-sell, unsold, re-auction, re-auction-unsold
  - display-overlay, display-player-filter, fortune-wheel, category-filter
  - stop-timer, start-timer, conclude, break-timer

Note: There is no separate "operator" identity on server; operator actions are effectively organizer/admin actions.

## EXPOSED DATA

### Confirmed Public Exposures

1. Player mobile numbers are publicly exposed by global player search:
   - `GET /api/global-players/search` returns `mobileNumber`.
2. Global player detail endpoint also returns mobile number publicly:
   - `GET /api/global-players/:gpid`.
3. Public tournament endpoint returns sensitive metadata:
   - organizer mobile/email
   - purse and auction config
   - registration payment settings
   - admin lock/status flags
4. Team purse analytics include owner and budget data:
   - owner name
   - purse, reserve, spendable, capacity values
5. Bid history endpoint is public and includes internal IDs:
   - bid id, playerId, teamId, timestamps

### Data That Is Properly Hidden in Public Serializers

- Public player serializer omits player mobile and email.
- Public team serializer omits owner mobile and access code.

## IDOR VULNERABILITY REVIEW

### Tournament ID changes

- Display/view routes are publicly reachable by tournament id (expected behavior), but gating by auction code is not a hard security control because code is obtainable from public tournament response.

### Team ID changes

- **Critical issue found**: `POST /api/tournaments/:tournamentId/auction/bid` fetches team by `teamId` only and does not enforce that team belongs to `tournamentId`.
- This enables cross-tournament team reference misuse if access code is known (or absent).

### Owner ID changes

- Owner app route is team/tournament based. Access code verification is server-side and tied to `(tournamentId, teamId)`.
- However, protection strength is reduced by lack of brute-force throttling on verify-access endpoint.

### Code changes (auction/access code manipulation)

- Access code verification is server-side.
- Tournament display "auction code" is not secret due to public tournament payload exposure.

## Owner App Security

### What is secure

- Owner access code is verified server-side via `POST /api/tournaments/:tournamentId/teams/:teamId/verify-access`.
- Push subscribe endpoint validates `(tournamentId, teamId)` existence before storing subscription.

### What is risky

- Public owner onboarding lookup can be used for mobile-based team discovery (rate-limited but still enumerative).
- Access code verification endpoint has no explicit brute-force limiter.
- Bid endpoint cross-tournament team mismatch vulnerability weakens owner path integrity.

## OBS Security

- OBS page consumes auction/tournament/team purse state and socket updates.
- No direct auction-control endpoint usage in OBS page code.
- No privileged mutation hooks invoked from OBS page.

Verdict: OBS route is display-only at UI level, but still inherits backend public data exposure risk.

## Auction Security

### Positive findings

- Auction operator route is client-guarded.
- Core auction mutation APIs are server-protected with organizer/admin checks.

### Material weakness

- Authorization helper currently permits any organizer account holder (not only tournament-linked organizer) in critical organizer checks.
- This is an over-broad authorization model for tournament-scoped mutation APIs.

## CRITICAL RISKS

1. Cross-tournament team IDOR in bidding endpoint (`/auction/bid`).
2. Public exposure of player mobile numbers (`/global-players/search`, `/global-players/:gpid`).
3. Over-broad organizer authorization (`organizerAccountId` accepted globally for tournament-scoped control).

## HIGH RISKS

1. `auctionCode` is used as gate but is publicly retrievable; not a security boundary.
2. Public tournament endpoint leaks organizer contact + financial/settings/admin-state data.
3. Public team purse data exposes owner name and detailed budget state.

## MEDIUM RISKS

1. Owner onboarding lookup allows mobile-to-team enumeration (rate-limited).
2. No dedicated brute-force protection on verify-access endpoint.
3. Internal IDs are widely exposed in public read endpoints.

## LOW RISKS

1. Public serializers for players and teams correctly redact some sensitive fields.
2. Team verify-access binds team and tournament on server.
3. Push subscription endpoint validates entity linkage before persistence.

## FIX RECOMMENDATIONS

1. **P0**: Enforce `(teamId, tournamentId)` binding in `/auction/bid` team lookup.
2. **P0**: Remove mobile number from public global-player endpoints or require privileged auth.
3. **P0**: Tighten organizer authorization to tournament-scoped membership for mutation endpoints.
4. **P1**: Split tournament response into public and privileged payload variants; remove sensitive fields from public.
5. **P1**: Reduce team purse public payload to display-minimum fields; remove owner identifiers.
6. **P1**: Treat auction code as UX-only unless moved to server-enforced access model.
7. **P2**: Add rate limiting and lockout policy to verify-access endpoint.

## Final Route Verdicts

- `/tournament/:id/register`: Public by design, not safe today due to linked public mobile exposure and sensitive tournament payload.
- `/tournament/:id/display`: Public display route, no direct controls; data exposure concerns remain.
- `/tournament/:id/side-display`: Same as display route.
- `/tournament/:id/obs`: Display-only behavior confirmed; no control endpoints from page.
- `/live/:id`: Intentionally public fan view; includes public cheer interaction.
- `/owner-app/join`: Public onboarding flow with server access-code enforcement, but affected by broader findings.
- `/tournament/:id/auction`: Properly protected at route/API level in many places, but authorization scope hardening is required.

