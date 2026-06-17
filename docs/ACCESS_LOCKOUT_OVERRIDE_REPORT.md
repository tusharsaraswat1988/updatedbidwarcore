# Owner Access Lockout — Organiser Override

**Date:** 2026-06-17  
**Status:** Implemented and tested

## Summary

Keeps the existing verify-access security model (5 failed attempts → 15-minute lockout per IP) and adds an authorised organiser/admin override so genuine team owners can be restored during live auctions without weakening rate limiting.

---

## API Changes

### New endpoint

`POST /api/tournaments/:tournamentId/teams/:teamId/reset-access-lockout`

| Requirement | Implementation |
|-------------|----------------|
| Auth | `requireTournamentOrganizer()` — tournament organiser or admin only |
| Clears | All failed-attempt counters and lockouts for the team across **all IPs** |
| Response | `{ success: true, message: "Owner access lockout cleared" }` |
| Audit | `OWNER_ACCESS_LOCKOUT_RESET` with `organizerId`, `teamId`, `tournamentId`, `ip`, timestamp |

### Enriched organiser team responses

`GET /api/tournaments/:tournamentId/teams` and `GET .../teams/:teamId` now include (organiser-only):

- `ownerAccessLocked: boolean`
- `ownerAccessLockoutRemainingSec: number`

Aggregated across all locked IPs for that team.

### verify-access (unchanged thresholds)

`POST .../verify-access` still returns **429** with `lockoutRemainingSec` when locked. Lockout rules unchanged: 5 failures → 15 minutes.

---

## Guard Layer

**File:** `artifacts/api-server/src/lib/verify-access-guard.ts`

| Function | Purpose |
|----------|---------|
| `getTeamAccessLockoutStatus(tournamentId, teamId)` | Team-wide lockout badge data for organiser panel |
| `clearAllTeamAccessLockouts(tournamentId, teamId)` | Organiser reset — deletes every `ip\|tournamentId\|teamId` entry |

---

## Frontend Changes

### Owner app (`AccessCode.tsx`)

On 429 / lockout:

- Message: *"Too many incorrect attempts. Please try again later or contact the tournament organiser."*
- Live countdown from `lockoutRemainingSec` (MM:SS)
- Input and submit disabled while locked

**File:** `lib/api-base/src/owner-auth.ts`

- `verifyOwnerAccessCode()` now returns `VerifyOwnerAccessResult` with lockout details
- New `resetOwnerAccessLockout()` for organiser panel

### Organiser panel (`teams.tsx`)

When `ownerAccessLocked`:

- Badge: **Owner Access Locked**
- Button: **Unlock Owner Access** → confirmation modal → `POST reset-access-lockout`

---

## Audit Logging

Event: `OWNER_ACCESS_LOCKOUT_RESET`

Logged via `auditLog()` and structured `logger.info()` with:

- timestamp (implicit)
- `organizerId`
- `teamId`
- `tournamentId`
- `ip`
- `clearedEntries` (number of IP keys removed)

---

## Changed Files

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/verify-access-guard.ts` | Team-wide lockout status + clear-all helpers |
| `artifacts/api-server/src/routes/teams.ts` | Reset endpoint; lockout fields on organiser team GET |
| `lib/api-base/src/owner-auth.ts` | Lockout-aware verify result; `resetOwnerAccessLockout()` |
| `artifacts/owner-app/src/components/AccessCode.tsx` | 429 UX + countdown |
| `artifacts/auction-platform/src/pages/teams.tsx` | Lock badge, unlock button, confirmation modal |
| `artifacts/api-server/src/__tests__/access-lockout-override.test.ts` | **New** — 13 tests |
| `docs/ACCESS_LOCKOUT_OVERRIDE_REPORT.md` | This report |

---

## Test Results

```text
npx vitest run src/__tests__/access-lockout-override.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)

npx vitest run src/__tests__/security-hardening.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### Required scenarios

| # | Scenario | Result |
|---|----------|--------|
| 1 | Public user cannot reset lockout | ✅ 403 `Authentication required` |
| 2 | Team owner cannot reset lockout | ✅ Wrong `organizerAccountId` → 403 |
| 3 | Wrong organiser cannot reset lockout | ✅ 403 |
| 4 | Tournament organiser can reset lockout | ✅ 200 + lockout cleared |
| 5 | Admin can reset lockout | ✅ 200 + lockout cleared |
| 6 | Owner can retry immediately after reset | ✅ `checkVerifyAccessAllowed` passes after `clearAllTeamAccessLockouts` |
| 7 | Audit log entry created | ✅ `OWNER_ACCESS_LOCKOUT_RESET` with metadata |

Additional coverage: multi-IP aggregation, clear-all counts, `isTournamentOrganizer` matrix.

---

## Security Notes

- Lockout protection **not removed** — still 5 failures / 15 minutes per IP
- Reset is **strictly tournament-scoped** via `requireTournamentOrganizer()`
- Reset clears **all IPs** for the team so any locked owner device is restored
- Public and cross-tournament organisers remain blocked (403)
