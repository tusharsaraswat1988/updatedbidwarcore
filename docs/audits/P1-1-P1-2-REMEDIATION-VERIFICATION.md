# BIDWAR — P1-1 & P1-2 Security Remediation & Verification Report
## Organizer Session Revocation + Production/Staging Isolation

**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Current Branch:** `main`  
**Baseline Commit:** `aa211f06270dffc841ed9a550d1235124bdf8167`  
**Audit & Remediation Date:** 2026-11-03  
**Status:** **FULLY REMEDIATED — ALL TEST SUITES PASSING — READY FOR STAGING VERIFICATION**

---

## 1. Executive Summary

This remediation resolves the two remaining P1 security findings identified in the BidWar platform security review:

1. **P1-1 (Organizer Session Revocation):**
   - **Previous State:** `bidwar_auth` organizer JWTs were stateless with 7-day lifespans. Logging out only deleted the browser cookie; copied or intercepted JWTs could be replayed against API endpoints for 7 days with zero server-side revocation capability.
   - **Remediated State:** Every organizer session is now bound to an immutable session identifier (`sessionId`) stored in the database table `organizer_sessions`. Requests are validated in real-time against active session status, expiry, revocation (`revoked_at`), and a SHA-256 token hash (`token_hash`). Logout, global logout, password change, and tournament rotation immediately revoke or invalidate prior tokens server-side.
2. **P1-2 (Production / Staging Origin Isolation):**
   - **Previous State:** `PRODUCTION_SITE_ORIGINS` in `runtime-env.ts` explicitly included `"https://stagingbidwar.up.railway.app"`, permitting staging to make credentialed CORS requests against production APIs. Additionally, dynamic origin resolution and OAuth redirect logic trusted staging headers in production.
   - **Remediated State:** Staging origin was permanently removed from `PRODUCTION_SITE_ORIGINS`. Environment boundary checks were added to `resolveTrustedRequestOrigin`, `buildCorsOrigins`, `resolveGoogleOAuthRedirectUri`, and `assertRuntimeEnv` such that production strictly rejects staging origins and staging strictly rejects unapproved production origins.

---

## 2. Source Audit & Finding Status

| Item | Code Site | Previous Behavior | Finding Verdict | Remediated Status |
|---|---|---|---|---|
| **P1-1.1** | `artifacts/api-server/src/lib/jwt.ts` | 7-day stateless JWT without `sessionId` or token hash. | **CONFIRMED** | `AuthClaims` carries `sessionId`. Added `computeTokenHash` (SHA-256). |
| **P1-1.2** | `artifacts/api-server/src/middleware/jwt-auth.ts` | Stateless decoding directly to `req.jwtUser`. | **CONFIRMED** | Async middleware validates DB session, expiry, revocation, and token hash. Fail-closed on DB errors. |
| **P1-1.3** | `artifacts/api-server/src/routes/auth.ts:410-441` | Tournament logout re-issued cookie without invalidating old JWT. | **CONFIRMED** | Calls `rotateOrganizerSessionClaims` (rotates DB hash) or `revokeOrganizerSession`. Replaying old token is rejected. |
| **P1-1.4** | `artifacts/api-server/src/routes/auth.ts:1738` | Organizer account logout only cleared cookie. | **CONFIRMED** | Calls `revokeOrganizerSession(req.sessionId)` to mark session revoked in DB. |
| **P1-1.5** | `artifacts/api-server/src/routes/auth.ts` | No global logout endpoint. | **CONFIRMED** | Added `POST /auth/organizer-account/logout-all` to revoke all sessions for account. |
| **P1-1.6** | `artifacts/api-server/src/routes/auth.ts:2764` | Password change did not invalidate active sessions on other devices. | **CONFIRMED** | Calls `revokeAllOrganizerSessions(accountId, req.sessionId)` (keeps current, revokes others). |
| **P1-1.7** | `artifacts/api-server/src/routes/auth.ts:2107` | Password reset via OTP did not revoke existing sessions. | **CONFIRMED** | Calls `revokeAllOrganizerSessions(organizer.id)` before issuing new session. |
| **P1-1.8** | `lib/db/src/schema/member-sessions.ts` | Can canonical `member_sessions` be reused directly? | **PARTIAL** | `member_sessions.member_id` is non-nullable FK. Tournament password logins have no `member_id`. Created `organizer_sessions` bridge table. |
| **P1-2.1** | `artifacts/api-server/src/lib/runtime-env.ts:109` | `PRODUCTION_SITE_ORIGINS` contained `https://stagingbidwar.up.railway.app`. | **CONFIRMED** | Staging origin removed. Strictly limited to production domains. |
| **P1-2.2** | `artifacts/api-server/src/lib/public-origin-guard.ts` | Origin resolution permitted cross-environment bleed. | **CONFIRMED** | Enforced strict environment boundary in `resolveTrustedRequestOrigin`. |
| **P1-2.3** | `artifacts/api-server/src/routes/auth.ts:2230` | OAuth redirect rewrote to staging even when `BIDWAR_ENV=production`. | **CONFIRMED** | Production OAuth always resolves to `https://${appDomain}/api/auth/google/callback`. |
| **P1-2.4** | `artifacts/api-server/src/lib/runtime-env.ts` | `assertRuntimeEnv` did not disallow staging host in production `APP_DOMAIN`. | **CONFIRMED** | `assertRuntimeEnv` stops startup if `isStagingLikeHost` is used in production. |

---

## 3. Changed Files Inventory

### Database & Schema Files
- `lib/db/migrations/0039_organizer_sessions.sql`: DDL for `organizer_sessions` table with 5 indexes.
- `lib/db/src/schema/organizer-sessions.ts`: Drizzle ORM table definition and ID generator helper (`orgsess_<uuid32>`).
- `lib/db/src/schema/index.ts`: Exported `organizer-sessions`.
- `lib/db/src/ensure-schema.ts`: Idempotent schema creation logic for startup auto-healing.

### API Server Auth & Security Files
- `artifacts/api-server/src/lib/jwt.ts`:
  - Added `sessionId?: string` to `AuthClaims`.
  - Added `computeTokenHash(token: string): string` (SHA-256).
  - Updated `setAuthCookie` to return `{ token: string; tokenHash: string }`.
- `artifacts/api-server/src/lib/organizer-session.ts` *(New Module)*:
  - `createOrganizerSession(res, options)`
  - `loadActiveOrganizerSession(sessionId)`
  - `validateOrganizerSession(sessionId, rawToken)`
  - `revokeOrganizerSession(sessionId)`
  - `revokeAllOrganizerSessions(organizerAccountId, exceptSessionId)`
  - `rotateOrganizerSessionClaims(res, sessionId, newClaims)`
  - `touchOrganizerSessionThrottled(session)`
  - `isOrganizerSessionRevocationEnforced()`
  - `upgradeLegacyTokenToSession(req, res, claims, rawToken)`
- `artifacts/api-server/src/middleware/jwt-auth.ts`:
  - Converted to async middleware with session DB validation.
  - Fail-closed error handling on DB failures.
  - Admin bypass for `claims.isAdmin === true`.
  - Two-stage legacy JWT migration enforcement.
- `artifacts/api-server/src/routes/auth.ts`:
  - Wired session creation into password login, Google OAuth callback, Android native handoff, phone onboarding, and tournament login.
  - Wired session revocation into tournament logout, account logout, global logout, password change, and OTP reset.
  - Added route `POST /auth/organizer-account/logout-all`.

### Environment & Origin Isolation Files
- `artifacts/api-server/src/lib/public-origin-guard.ts`:
  - Hardened `resolveTrustedRequestOrigin` with environment boundaries.
- `artifacts/api-server/src/lib/runtime-env.ts`:
  - Removed staging URL from `PRODUCTION_SITE_ORIGINS`.
  - Hardened CORS origin filtering and `isDisallowedProductionHost`.
  - Hardened `resolveGoogleOAuthRedirectUri`.

### Automated Regression Test Suites
- `artifacts/api-server/src/__tests__/organizer-session-revocation.test.ts` *(16 tests, 100% pass)*.
- `artifacts/api-server/src/__tests__/production-staging-origin-isolation.test.ts` *(14 tests, 100% pass)*.
- `artifacts/api-server/src/__tests__/railway-cors-origins.test.ts` *(Updated to assert production isolation)*.

---

## 4. Technical Architecture: Database Schema & Lifecycle

### 4.1 `organizer_sessions` Schema Definition

```sql
CREATE TABLE IF NOT EXISTS "organizer_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "organizer_account_id" integer REFERENCES "organizers"("id") ON DELETE CASCADE,
  "member_id" text REFERENCES "members"("id") ON DELETE SET NULL,
  "tournament_id" integer REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "session_scope" text NOT NULL DEFAULT 'account',
  "token_hash" text NOT NULL,
  "device_name" text,
  "ip_address" text,
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_organizer_sessions_account_id" ON "organizer_sessions"("organizer_account_id");
CREATE INDEX IF NOT EXISTS "idx_organizer_sessions_member_id" ON "organizer_sessions"("member_id");
CREATE INDEX IF NOT EXISTS "idx_organizer_sessions_tournament_id" ON "organizer_sessions"("tournament_id");
CREATE INDEX IF NOT EXISTS "idx_organizer_sessions_active" ON "organizer_sessions"("id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_organizer_sessions_expires_at" ON "organizer_sessions"("expires_at");
```

### 4.2 Security Properties

1. **SHA-256 Token Hashing:**
   - Raw bearer tokens are never written to database logs, WALs, or storage.
   - `token_hash = sha256(jwt)`.
   - On every request, `computeTokenHash(rawToken) === session.tokenHash` prevents stolen/old tokens from being used if claims or permissions change.
2. **Fail-Closed on Database Downtime:**
   - If PostgreSQL or Neon times out on protected organizer routes, the request is rejected with 401/503. The system will **never** fall back to blindly trusting the JWT signature.
3. **Admin Privilege Isolation:**
   - Platform master admin (`isAdmin: true, adminLevel: "master"`) and data-entry admin (`adminLevel: "data_entry"`) tokens do not touch `organizer_sessions` and continue functioning independently.
4. **Public Route Neutrality:**
   - Public scoreboards, public auction tickers, registration landing pages, and spectator views remain completely public and unimpacted.

---

## 5. Two-Stage Legacy JWT Migration Guide

Existing organizers have active 7-day stateless JWTs issued prior to this deployment. To avoid mass involuntary logouts while eliminating stateless vulnerability:

### Stage 1 — Transparent Upgrade (Grace Period)
- **Configuration:** `ENFORCE_ORGANIZER_SESSION_REVOCATION="false"`
- **Behavior:**
  - Newly authenticated users receive a JWT with `sessionId` and a database session row.
  - Existing users with legacy JWTs (no `sessionId`) are accepted and transparently upgraded to a database session upon their next request via `upgradeLegacyTokenToSession()`.
  - Stolen legacy tokens within this grace period expire naturally within 7 days.

### Stage 2 — Strict Enforcement (Default)
- **Configuration:** `ENFORCE_ORGANIZER_SESSION_REVOCATION="true"` (or unset)
- **Behavior:**
  - Any JWT without a valid, unrevoked database `sessionId` is rejected (401 Unauthorized) and its cookie cleared.
  - Stateless JWT replay is permanently blocked.

---

## 6. Automated Regression Test Results

All tests executed via `vitest`:

```bash
pnpm --filter @workspace/api-server test \
  src/__tests__/organizer-session-revocation.test.ts \
  src/__tests__/production-staging-origin-isolation.test.ts \
  src/__tests__/staging-oauth-flow.test.ts \
  src/__tests__/railway-cors-origins.test.ts \
  src/__tests__/organizer-auth-scope.test.ts \
  src/__tests__/member-auth.test.ts
```

### Output Summary

```
✓ src/__tests__/organizer-auth-scope.test.ts (5 tests) 11ms
✓ src/__tests__/railway-cors-origins.test.ts (10 tests) 66ms
✓ src/__tests__/organizer-session-revocation.test.ts (16 tests) 94ms
✓ src/__tests__/production-staging-origin-isolation.test.ts (14 tests) 51ms
✓ src/__tests__/staging-oauth-flow.test.ts (14 tests) 68ms
✓ src/__tests__/member-auth.test.ts (21 tests) 274ms

Test Files  6 passed (6)
     Tests  80 passed (80)
  Duration  4.12s
```

### TypeScript & Package Build Results

- `pnpm run typecheck:libs`: **Exit code 0** (No errors).
- `pnpm --filter @workspace/api-server build`: **Exit code 0** (Built `dist/index.mjs` in 477ms).
- `pnpm --filter @workspace/auction-platform build`: **Exit code 0** (Client built in 17.89s, SSR built in 12.90s).

---

## 7. Railway Staging Deployment & Verification Checklist

Follow this checklist when deploying to Railway staging:

### Pre-Deployment Verification
- [x] Baseline commit confirmed: `aa211f06270dffc841ed9a550d1235124bdf8167`.
- [x] All 80 security regression tests pass locally.
- [x] Both `api-server` and `auction-platform` compile cleanly.
- [x] Production environment has zero uncommitted mutations or deployments.

### Railway Staging Environment Variables
- [ ] Confirm `BIDWAR_ENV=staging` on Railway staging service.
- [ ] Confirm `APP_DOMAIN=stagingbidwar.up.railway.app`.
- [ ] Confirm `APP_URL=https://stagingbidwar.up.railway.app`.
- [ ] Confirm `DATABASE_URL` points to Neon staging branch (NOT production database).
- [ ] Confirm `SESSION_SECRET` is set to an isolated staging secret (min 32 chars).
- [ ] Confirm `ENFORCE_ORGANIZER_SESSION_REVOCATION=false` initially for Stage 1 migration, switching to `true` after 7 days.

### Staging Database DDL Execution
- [ ] Run migration `0039_organizer_sessions.sql` against staging database, OR rely on `ensureSchema()` auto-heal on startup:
  ```bash
  psql $STAGING_DATABASE_URL -f lib/db/migrations/0039_organizer_sessions.sql
  ```
- [ ] Verify table existence and indexes:
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_name = 'organizer_sessions';
  ```

### Live Staging Journey Tests
1. **Organizer Login & Session Creation:**
   - Log into staging (`https://stagingbidwar.up.railway.app/organizer/login`).
   - Query DB: `SELECT id, organizer_account_id, token_hash, revoked_at FROM organizer_sessions;`
   - Confirm active session row exists with non-null `token_hash` and `revoked_at IS NULL`.
2. **Session Revocation on Logout:**
   - Tap Logout.
   - Query DB: confirm `revoked_at IS NOT NULL`.
   - Replay the previous `bidwar_auth` cookie via curl: confirm `401 Unauthorized`.
3. **Password Change Revocation:**
   - Log in on two browser windows.
   - Change password in window A.
   - Window A continues working; refreshing window B returns `401 Unauthorized`.
4. **Cross-Origin Rejection:**
   - Send CORS preflight from `https://bidwar.in` to staging: confirm origin is rejected.
   - Send CORS preflight from staging to production: confirm origin is rejected.
5. **Google OAuth Round-Trip:**
   - Initiate Google login on staging: confirm OAuth redirect URI is `https://stagingbidwar.up.railway.app/api/auth/google/callback`.

---

## 8. Rollback Procedure

In the event of an unexpected issue on staging:

1. **Application Code Rollback:**
   - Redeploy previous commit `aa211f06270dffc841ed9a550d1235124bdf8167` via Railway deployment dashboard or Git:
     ```bash
     git checkout aa211f06270dffc841ed9a550d1235124bdf8167
     ```
2. **Database Backward Compatibility:**
   - **Zero DDL Rollback Required.** The `organizer_sessions` table is an additive table. Reverting the application server code causes older code to simply ignore `organizer_sessions` without schema errors or table conflicts.
3. **User Impact:**
   - Users who logged in during the test will retain valid JWTs and continue to be authenticated under the previous stateless mechanism.

---

## 9. Explicit Production Untouched Statement

- **Production Deployments:** **0**
- **Production Database Mutations:** **0**
- **Production Environment Variable Changes:** **0**
- **Production Domain Status:** Fully untouched. Production traffic on `https://bidwar.in` continues to run on previous stable release without interruption.
