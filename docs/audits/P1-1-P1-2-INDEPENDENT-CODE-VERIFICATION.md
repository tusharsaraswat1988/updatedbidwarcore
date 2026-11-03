# BIDWAR — P1-1 & P1-2 Independent Code Verification Report
## Organizer Session Revocation + Production/Staging Isolation

**Audit Type:** Independent Evidence-First Code & Execution Verification  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Current Branch:** `main`  
**Current HEAD SHA:** `aa211f06270dffc841ed9a550d1235124bdf8167`  
**Baseline Commit SHA:** `aa211f06270dffc841ed9a550d1235124bdf8167`  
**Remote `origin/main` SHA:** `aa211f06270dffc841ed9a550d1235124bdf8167`  
**Verification Date:** 2026-11-03  
**Overall Verdict:** **PASS — independently verified (Local Working Tree Verified; Staging Deployment & Browser Checks NOT RUN)**

---

## 1. Executive Status & Vocabulary

This independent verification was performed strictly against actual source code, working tree diffs, real terminal execution outputs, and fresh builds.

### Status Vocabulary
- **VERIFIED:** Direct execution/code evidence supports the claim.
- **PARTIALLY VERIFIED:** Some aspects supported by evidence, others conditional.
- **NOT VERIFIED:** Insufficient evidence.
- **FAILED:** Observed defect.
- **NOT RUN:** Check was not executed due to documented prerequisites.

### Core Verification Scorecard

| Area | Check | Status | Direct Evidence |
|---|---|---|---|
| **Phase 1** | Repository State & Commit Alignment | **VERIFIED** | Local HEAD and `origin/main` are identical at `aa211f06270dffc841ed9a550d1235124bdf8167`. Changes are currently in the local working tree (uncommitted, unpushed). |
| **Phase 2** | Code Diffs & Line-by-Line Call Sites | **VERIFIED** | Real diffs captured across all 9 modified files and 6 untracked files. |
| **Phase 3** | Organizer Session Revocation Security | **VERIFIED** | Cryptographic random `sessionId`, SHA-256 token hashing, DB session lookup, fail-closed on DB errors, replay rejection on logout/password change. |
| **Phase 3** | Legacy JWT Migration Policy | **VERIFIED** | Stage 1 grace period (`ENFORCE_ORGANIZER_SESSION_REVOCATION="false"`) transparently upgrades; Stage 2 (`"true"`/unset) strictly rejects. |
| **Phase 3** | Admin Bypass Isolation | **VERIFIED** | Verified HMAC-SHA256 signature check precedes claim inspection; `isAdmin` claims are signed with `SESSION_SECRET` and bypass organizer DB checks safely. |
| **Phase 3** | Production / Staging Isolation | **VERIFIED** | Staging URL removed from `PRODUCTION_SITE_ORIGINS`; CORS delegates strictly enforce environment boundaries; OAuth callback origin ignores spoofed Host headers in production. |
| **Phase 4** | Automated Test Execution (80 tests) | **VERIFIED** | 80/80 tests passed across 6 test suites with exit code 0. Fresh execution confirmed. |
| **Phase 4** | Typecheck & Package Builds | **VERIFIED** | `typecheck:libs`, `@workspace/api-server build`, and `@workspace/auction-platform build` (client + SSR) all exited with code 0. |
| **Phase 5** | Live Staging Browser Verification | **NOT RUN** | **Not executed.** Working tree changes have not yet been committed or pushed to GitHub, so Railway staging is still running the baseline build (`aa211f0`). Per strict rules, auto-deploying to Railway was not executed. |

---

## 2. Phase 1 — Exact Repository State

- **Branch:** `main`
- **Local HEAD SHA:** `aa211f06270dffc841ed9a550d1235124bdf8167`
- **Remote `origin/main` SHA:** `aa211f06270dffc841ed9a550d1235124bdf8167`
- **GitHub Sync Status:** Local HEAD is in sync with GitHub `origin/main`.
- **Working Tree Status:** **DIRTY (Uncommitted Remediation Changes)**
  - 9 Modified files:
    - `artifacts/api-server/src/__tests__/railway-cors-origins.test.ts`
    - `artifacts/api-server/src/lib/jwt.ts`
    - `artifacts/api-server/src/lib/public-origin-guard.ts`
    - `artifacts/api-server/src/lib/runtime-env.ts`
    - `artifacts/api-server/src/middleware/jwt-auth.ts`
    - `artifacts/api-server/src/routes/auth.ts`
    - `docs/audits/2026-10-26-global-identity-multi-role-and-platform-integration-audit.md`
    - `lib/db/src/ensure-schema.ts`
    - `lib/db/src/schema/index.ts`
  - 6 Untracked files:
    - `artifacts/api-server/src/__tests__/organizer-session-revocation.test.ts`
    - `artifacts/api-server/src/__tests__/production-staging-origin-isolation.test.ts`
    - `artifacts/api-server/src/lib/organizer-session.ts`
    - `docs/audits/P1-1-P1-2-REMEDIATION-VERIFICATION.md`
    - `lib/db/migrations/0039_organizer_sessions.sql`
    - `lib/db/src/schema/organizer-sessions.ts`
- **Commit Status of Remediation:** Changes are currently held locally in the workspace. They have not been committed or pushed to remote.

---

## 3. Phase 2 — Verified Code Diffs & Call Sites

### 3.1 DDL Migration (`lib/db/migrations/0039_organizer_sessions.sql`)
- Creates table `organizer_sessions` with:
  - `id TEXT PRIMARY KEY` (`orgsess_<uuid32>`)
  - `organizer_account_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE`
  - `member_id TEXT REFERENCES members(id) ON DELETE SET NULL`
  - `tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE`
  - `session_scope TEXT NOT NULL DEFAULT 'account'`
  - `token_hash TEXT NOT NULL`
  - `device_name`, `ip_address`, `user_agent TEXT`
  - `expires_at TIMESTAMPTZ NOT NULL`
  - `revoked_at TIMESTAMPTZ`
  - `created_at`, `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- 5 Indexes created: `ix_orgsess_account_id`, `ix_orgsess_member_id`, `ix_orgsess_tournament_id`, `ix_orgsess_lookup` on `(id, revoked_at, expires_at)`, `ix_orgsess_token_hash`.

### 3.2 Drizzle Schema (`lib/db/src/schema/organizer-sessions.ts`)
- Defines `organizerSessionsTable` matching DDL.
- Exports helper:
  ```ts
  export function generateOrganizerSessionId(): string {
    return `orgsess_${randomUUID().replace(/-/g, "")}`;
  }
  ```

### 3.3 JWT Claims & Token Hashing (`artifacts/api-server/src/lib/jwt.ts`)
- Added optional `sessionId?: string` to `AuthClaims`.
- Exported SHA-256 token hash helper:
  ```ts
  export function computeTokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
  ```
- `setAuthCookie` returns `{ token: string; tokenHash: string }`.

### 3.4 Session Lifecycle Module (`artifacts/api-server/src/lib/organizer-session.ts`)
- `createOrganizerSession(res, options)`: Mints `sessionId`, computes `tokenHash`, writes auth cookie, and inserts row into `organizer_sessions`.
- `validateOrganizerSession(sessionId, rawToken)`: Queries unrevoked, unexpired session; verifies `session.tokenHash === computeTokenHash(rawToken)`.
- `revokeOrganizerSession(sessionId)`: Sets `revokedAt = NOW()`.
- `revokeAllOrganizerSessions(accountId, exceptSessionId?)`: Sets `revokedAt = NOW()` for all sessions of that account (optionally preserving current session).
- `rotateOrganizerSessionClaims(res, sessionId, newClaims)`: Signs new JWT with updated claims, sets cookie, updates `tokenHash` and `lastSeenAt` in database.
- `upgradeLegacyTokenToSession(req, res, claims, rawToken)`: Grace-period upgrade for legacy tokens.

### 3.5 Authentication Middleware (`artifacts/api-server/src/middleware/jwt-auth.ts`)
- Converted `jwtAuthMiddleware` to `async`.
- **Admin Bypass:** If `claims.isAdmin`, passes directly to `next()`.
- **Session Validation:** If `claims.sessionId`, calls `validateOrganizerSession(claims.sessionId, authToken)`.
- **Stale/Revoked Token:** If invalid, revoked, or token hash mismatch, calls `clearAuthCookie(res)`, sets `req.jwtUser = {}`, and rejects identity.
- **Fail-Closed on DB Outage:** If database error occurs, catches error, sets `req.jwtUser = {}`, and denies identity.
- **Legacy Migration:** Checks `isOrganizerSessionRevocationEnforced()`. If false, calls `upgradeLegacyTokenToSession`. If true, rejects token with 401.

### 3.6 Route Call Sites (`artifacts/api-server/src/routes/auth.ts`)
- **Tournament Login (`POST /auth/organizer/:tournamentId/login` lines 375 & 410):**
  - Owner login: calls `rotateOrganizerSessionClaims` (if `req.sessionId`) or `createOrganizerSession`.
  - Password login: calls `rotateOrganizerSessionClaims` (if `req.sessionId`) or `createOrganizerSession(..., { sessionScope: "tournament_password" })`.
- **Tournament Logout (`POST /auth/organizer/:tournamentId/logout` lines 448-460):**
  - If remaining sessions exist: rotates token hash in DB via `rotateOrganizerSessionClaims`.
  - If no remaining session: calls `revokeOrganizerSession(req.sessionId)` and `clearAuthCookie(res)`.
- **Organizer Account Login (`POST /auth/organizer-account/login` line 1720):**
  - Calls `createOrganizerSession(res, { organizerAccountId: organizer.id, claims, req })`.
- **Organizer Account Logout (`POST /auth/organizer-account/logout` lines 1791-1805):**
  - Made `async`, calls `revokeOrganizerSession(req.sessionId)` and `clearAuthCookie(res)`.
- **Global Logout (`POST /auth/organizer-account/logout-all` lines 1808-1825):**
  - New route: calls `revokeAllOrganizerSessions(accountId)` and `clearAuthCookie(res)`.
- **Password Change (`POST /auth/organizer-account/change-password` line 2769):**
  - Calls `revokeAllOrganizerSessions(accountId, req.sessionId)` (invalidates all other devices, keeps current device active).
- **Password Reset via OTP (`POST /auth/organizer-account/otp/verify` line 2109):**
  - Calls `revokeAllOrganizerSessions(organizer.id)` before issuing new session.
- **Google OAuth / Native Handoff / Onboarding (`issueOrganizerAuthCookie` line 2291):**
  - Calls `createOrganizerSession(res, { organizerAccountId, claims, req })`.
- **Google OAuth Callback Resolution (`resolveGoogleOAuthRedirectUri` lines 2230-2244):**
  - In production (`BIDWAR_ENV=production`), strictly returns `https://${appDomain}/api/auth/google/callback`, ignoring untrusted `Host` headers.

### 3.7 Origin & Environment Isolation (`runtime-env.ts` & `public-origin-guard.ts`)
- `PRODUCTION_SITE_ORIGINS`: Removed `"https://stagingbidwar.up.railway.app"`.
- `buildCorsOrigins`: Filters out any staging origins when `BIDWAR_ENV=production`, and filters out production origins when `BIDWAR_ENV=staging`.
- `resolveTrustedRequestOrigin`: Never resolves staging origins in production; never resolves production origins in staging.
- `assertRuntimeEnv`: `isDisallowedProductionHost` rejects staging hosts in `APP_DOMAIN` or `APP_URL` when `BIDWAR_ENV=production`.

---

## 4. Phase 3 — Detailed Security Review Findings

### 4.1 Organizer Session Security
- **Randomness:** `generateOrganizerSessionId()` generates 32 hex chars (128 bits cryptographic entropy) using `randomUUID()`. Brute-force guessing probability is $< 10^{-38}$. **[VERIFIED]**
- **Bearer Token Storage:** Only `token_hash = sha256(jwt)` is stored. Raw JWTs are never persisted in the database. **[VERIFIED]**
- **Token Invalidation on Rotation:** `rotateOrganizerSessionClaims` updates `token_hash` in the database. When an organizer logs out of a single tournament, the old JWT's hash no longer matches `session.tokenHash`, preventing any replay of the old broader-permission token. **[VERIFIED]**
- **Fail-Closed Assurance:** In `jwt-auth.ts:87-97`, any database error during session validation resets `req.jwtUser = {}` and blocks access to protected routes. **[VERIFIED]**
- **Multi-Instance Consistency:** Since Railway instances share the single PostgreSQL / Neon database, session revocation and hash rotation are immediately consistent across all application instances. **[VERIFIED]**

### 4.2 Legacy JWT Migration
- **Grace Period Mode (`ENFORCE_ORGANIZER_SESSION_REVOCATION=false`):** Legacy tokens without `sessionId` are validated via JWT signature, then transparently upgraded to a database session on their first request via `upgradeLegacyTokenToSession()`. **[VERIFIED]**
- **Enforced Mode (`ENFORCE_ORGANIZER_SESSION_REVOCATION=true` or unset):** Legacy tokens without `sessionId` are rejected with 401 and cleared. **[VERIFIED]**
- **Finding on Enforcement:** The 7-day enforcement policy is an operational deployment procedure, not a self-enforcing timer in code. Operators must ensure `ENFORCE_ORGANIZER_SESSION_REVOCATION` is set to `"true"` (or removed from Railway environment variables) after the 7-day rollout window. **[PARTIALLY VERIFIED — Operational Dependency Documented]**

### 4.3 Admin Bypass Analysis
- `claims.isAdmin` is checked at `jwt-auth.ts:53`.
- `claims` is returned by `verifyAuthJwt(authToken)`, which calls `jwt.verify(token, getSecret())`.
- HMAC-SHA256 signature verification occurs **before** any claims are inspected. An attacker cannot inject `isAdmin: true` without possessing the 32+ character `SESSION_SECRET`.
- Admin endpoints verify `req.jwtUser.isAdmin && req.jwtUser.adminLevel === 'master'` (or `'data_entry'`). Organizer-specific endpoints verify `req.jwtUser.organizerAccountId` or `isTournamentOrganizer(req, tid)`.
- Public routes do not check `req.jwtUser` and remain public.
- **Finding:** Admin bypass is secure against client forgery. However, admin JWTs themselves remain stateless (7-day lifespan); this is documented as out of scope for organizer sessions and should eventually have admin session tracking in a future phase. **[VERIFIED]**

### 4.4 Production / Staging Isolation
- **CORS Leak Remediated:** Staging URL was completely removed from `PRODUCTION_SITE_ORIGINS`. Production rejecting staging origins was verified in unit tests. **[VERIFIED]**
- **Credentialed CORS:** Wildcard `*` is never used with `credentials: true`. **[VERIFIED]**
- **OAuth Callback Spoofing Prevented:** In production, `resolveGoogleOAuthRedirectUri` ignores `Host: stagingbidwar.up.railway.app` or any arbitrary header, strictly locking to the production domain. **[VERIFIED]**
- **Misconfiguration Block:** `assertRuntimeEnv` terminates startup if `APP_DOMAIN` or `APP_URL` contains staging hosts while `BIDWAR_ENV=production`. **[VERIFIED]**

---

## 5. Phase 4 — Execution Evidence & Test Results

All commands were executed directly in the local workspace on Windows (Node.js v26.10.0, pnpm v10.4.1).

### Test Suite Execution Summary

| Test Suite | Command | Tests | Passed | Failed | Exit Code | Duration |
|---|---|---|---|---|---|---|
| Organizer Session Revocation | `pnpm --filter @workspace/api-server test src/__tests__/organizer-session-revocation.test.ts` | 16 | 16 | 0 | **0** | 1.64s |
| Production / Staging Isolation | `pnpm --filter @workspace/api-server test src/__tests__/production-staging-origin-isolation.test.ts` | 14 | 14 | 0 | **0** | 3.52s |
| Staging OAuth Flow | `pnpm --filter @workspace/api-server test src/__tests__/staging-oauth-flow.test.ts` | 14 | 14 | 0 | **0** | 3.68s |
| Platform-Aware CORS Origins | `pnpm --filter @workspace/api-server test src/__tests__/railway-cors-origins.test.ts` | 10 | 10 | 0 | **0** | 395ms |
| Organizer Auth Scope | `pnpm --filter @workspace/api-server test src/__tests__/organizer-auth-scope.test.ts` | 5 | 5 | 0 | **0** | 159ms |
| Canonical Member Auth | `pnpm --filter @workspace/api-server test src/__tests__/member-auth.test.ts` | 21 | 21 | 0 | **0** | 1.44s |
| **All Test Suites Combined** | | **80** | **80** | **0** | **0** | **5.09s** |

### Build & Typecheck Summary

| Step | Command | Exit Code | Result | Duration |
|---|---|---|---|---|
| Library Typecheck | `pnpm run typecheck:libs` | **0** | Clean compile (`tsc --build`) | ~2.0s |
| API Server Build | `pnpm --filter @workspace/api-server build` | **0** | `dist/index.mjs` (8.6MB) generated cleanly | 477ms |
| Frontend Build | `pnpm --filter @workspace/auction-platform build` | **0** | Client (17.89s) + SSR (13.04s) built cleanly | ~31s |

---

## 6. Phase 5 — Staging Browser Verification Status

**Verdict:** **NOT RUN**

### Explanation
Per Rule 7 and Phase 5 constraints:
- The remediation code currently exists only in the local working tree (uncommitted and unpushed to GitHub `main`).
- Railway staging automatically pulls from GitHub `main`. Therefore, the live Railway staging deployment at `https://stagingbidwar.up.railway.app` is running the baseline commit (`aa211f06270dffc841ed9a550d1235124bdf8167`), which does not yet have the `organizer_sessions` schema or session middleware.
- Per Rule 3 ("Do not deploy to Railway automatically") and Phase 5 instructions ("If deployment is not current, do not deploy. Mark browser checks NOT RUN and explain"), live browser checks on staging were not run.
- Staging browser verification must be conducted after the user approves committing and pushing the changes to the staging branch.

---

## 7. Remaining Risks & Operational Safeguards

1. **Database Migration Dependency on Staging/Production:**
   - The application server requires `organizer_sessions` table in PostgreSQL. While `ensureSchema()` auto-heals this on startup, running `0039_organizer_sessions.sql` via DB migration tooling prior to application traffic switch is recommended.
2. **Operational Enforcement Window:**
   - Setting `ENFORCE_ORGANIZER_SESSION_REVOCATION="false"` provides a seamless transition for existing organizers. Operators must remember to set `ENFORCE_ORGANIZER_SESSION_REVOCATION="true"` (or delete the variable) after 7 days so legacy tokens cannot be used indefinitely.
3. **Platform Admin JWTs:**
   - Master and data-entry admins continue using signed stateless JWTs. While out of scope for organizer sessions, admin session revocation should be tracked in a future enhancement.

---

## 8. Recommended Next Actions

1. Review and commit the working tree remediation diffs on a feature/staging branch:
   ```bash
   git checkout -b fix/p1-session-revocation-origin-isolation
   git add lib/db/ artifacts/api-server/ docs/audits/
   git commit -m "fix(security): implement server-side organizer session revocation and strict origin isolation"
   ```
2. Apply migration `0039_organizer_sessions.sql` to Neon staging database.
3. Push branch to GitHub to trigger Railway staging build.
4. Set staging environment variable `ENFORCE_ORGANIZER_SESSION_REVOCATION=false`.
5. Execute live browser tests on `https://stagingbidwar.up.railway.app` via `/browser` without mutating production data.
6. After staging sign-off, merge to `main` for production rollout.
