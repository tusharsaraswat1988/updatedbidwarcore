# BidWar Security Report

> Generated: July 2026 — Read-only audit.
> **Note:** This is an internal audit document. Do not expose findings publicly before remediation.

---

## Severity Classification

- **CRITICAL** — Exploitable in production with immediate impact
- **HIGH** — Serious vulnerability or security weakness
- **MEDIUM** — Security concern requiring attention
- **LOW** — Minor issues or security hygiene

---

## 1. Unauthenticated Endpoints

### SEC-001 · HIGH · No Authentication on Upload Endpoints

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/upload`, `POST /api/upload/media`, `POST /api/upload/audio` |
| **File** | `artifacts/api-server/src/routes/upload.ts` |
| **Issue** | All three upload endpoints accept file uploads with **no authentication**. Any internet user can upload files to Cloudinary when the Cloudinary credentials are configured. |
| **Impact** | Cloudinary storage cost abuse; content policy violations; potential phishing via uploaded assets |
| **Mitigation needed** | Require at least organizer account authentication; add upload size limits per IP |
| **Current mitigation** | None confirmed in upload route |

---

### SEC-002 · HIGH · Public Analytics with LLM Cost Exposure

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/tournaments/:id/analytics/insights` |
| **File** | `artifacts/api-server/src/routes/analytics.ts`, `lib/tournament-insights/generate-insights.ts` |
| **Issue** | The insights endpoint calls OpenAI (`OPENAI_API_KEY`) for any unauthenticated user. Rate limiting (30 requests per 15 minutes per IP) is the only mitigation. Tournament IDs are enumerable integers. |
| **Impact** | OpenAI API cost abuse; model may process sensitive tournament data; LLM poisoning if insights are used for decision-making |
| **Attack vector** | Enumerate tournament IDs, send 30 insight requests per IP every 15 minutes |
| **Mitigation needed** | Require organizer/admin authentication for insights; optionally cache insights per tournament |

---

### SEC-003 · MEDIUM · Tournament List Exposes All Tournament Metadata

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/tournaments` |
| **Issue** | Returns all tournaments including private/unlicensed ones via public serializer |
| **Impact** | Exposes organizer contact info, tournament dates, registration links for all platforms |
| **Mitigation needed** | Filter based on `admin_locked` and `license_status`; consider requiring auth for full list |

---

### SEC-004 · MEDIUM · Cricket/Badminton Roster Data Public

| Field | Value |
|-------|-------|
| **Endpoints** | `GET /api/tournaments/:id/scoring/players`, `GET /api/tournaments/:id/badminton/players` |
| **Issue** | Full squad/roster data for any tournament accessible without authentication |
| **Impact** | Player personal data (name, mobile possibly) exposed for any tournament ID |
| **Note** | Intentional for scorer UIs; may need field-level review for PII |

---

## 2. Demo/Debug Routes in Production

### SEC-005 · HIGH · Demo Seed Endpoint Active in Production

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/seed/demo` |
| **File** | `artifacts/api-server/src/routes/seed-demo.ts` |
| **Issue** | Creates demo tournaments (IPL-style data) in the live database when `X-Seed-Key` header matches `ADMIN_PASSWORD`. The comparison uses JavaScript `!==` (not timing-safe). **No `NODE_ENV` gate** — this endpoint is active in production. |
| **Impact** | If `ADMIN_PASSWORD` is compromised, attacker can pollute the production database with demo tournaments |
| **Fix** | Disable via `NODE_ENV === 'production'` check; use `crypto.timingSafeEqual()` for key comparison |

---

### SEC-006 · MEDIUM · ADMIN_PASSWORD Used for Both Admin Login and Seed Key

| Field | Value |
|-------|-------|
| **Files** | `routes/auth.ts` (admin login), `routes/seed-demo.ts` (seed key) |
| **Issue** | Same password used for two different auth purposes increases blast radius |
| **Fix** | Use a separate `SEED_KEY` environment variable; remove or require separate `SEED_ADMIN_KEY` |

---

## 3. Authentication Vulnerabilities

### SEC-007 · MEDIUM · Twilio Webhook Validates Nothing When Token Unset

| Field | Value |
|-------|-------|
| **File** | `artifacts/api-server/src/routes/webhooks.ts` |
| **Issue** | `verifyTwilioSignature()` returns `true` when `TWILIO_AUTH_TOKEN` is not configured (stub mode). Inbound Twilio webhooks for WhatsApp OTPs and consent flows are processed without signature validation in this state. |
| **Impact** | Forged webhook requests can trigger OTP confirmation flows, consent state changes |
| **Fix** | Fail closed: return 403 when `TWILIO_AUTH_TOKEN` is not set; log warning at startup |

---

### SEC-008 · MEDIUM · Scoring PIN Comparison Not Timing-Safe

| Field | Value |
|-------|-------|
| **File** | `artifacts/api-server/src/routes/scoring.ts` |
| **Issue** | Scoring PIN (`scoringPin`) compared with plain `===`. Timing attacks are low-risk here but inconsistent with other security hardening done for bid access codes. |
| **Fix** | Use `crypto.timingSafeEqual()` for PIN comparison |

---

### SEC-009 · MEDIUM · BidWar Local — Hardcoded JWT Fallback Secret

| Field | Value |
|-------|-------|
| **File** | `artifacts/bidwar-local/src/server/index.ts` |
| **Issue** | `LOCAL_SESSION_SECRET` has a hardcoded fallback: `'bidwar-local-session-secret-min-32-chars'`. This is predictable and the same across all installations that don't set the env var. |
| **Impact** | JWT tokens signed with the fallback can be forged if an attacker knows the fallback value (it's in the source code) |
| **Fix** | Fail hard at startup if `LOCAL_SESSION_SECRET` is not set (or auto-generate and persist to app data dir) |

---

### SEC-010 · LOW · Data-Entry Admin Has Broad Access

| Field | Value |
|-------|-------|
| **Issue** | `requireAdmin` (non-master) grants access to intelligence briefings, audit logs, academy admin, and notification logs. While by design, this gives data-entry administrators significantly more access than their name implies. |
| **Recommendation** | Review data-entry admin role scope; document intended privileges; consider splitting data-entry and analytics roles |

---

### SEC-011 · LOW · Access Codes in Plain Text in localStorage

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/` (owner-auth helpers) |
| **Issue** | Team owner access codes are stored in `localStorage` for returning sessions. Compromised device = compromised team bid access. |
| **Mitigation present** | `owner_sessions` table has `expires_at` and `last_seen_at`; server-side session invalidation is possible |

---

## 4. Injection and XSS

### SEC-012 · MEDIUM · dangerouslySetInnerHTML in Multiple Components

| Field | Value |
|-------|-------|
| **Files** | `pages/admin-communication-center.tsx`, `components/communication/email-rich-editor.tsx`, academy lesson content components |
| **Issue** | HTML content is set via `dangerouslySetInnerHTML`. If server-side sanitization is not applied before storage, XSS is possible when a compromised admin account injects malicious HTML into email templates or academy content. |
| **Scope** | Admin-facing only (not public-facing) |
| **Mitigation needed** | Confirm server-side HTML sanitization (DOMPurify or equivalent) in communication template storage and academy lesson storage |

---

### SEC-013 · LOW · JSON-LD Schema via dangerouslySetInnerHTML

| Field | Value |
|-------|-------|
| **Files** | `components/seo-head.tsx`, `components/schema-markup.tsx` |
| **Issue** | JSON-LD schemas are injected via `dangerouslySetInnerHTML`. These are generated from API data. |
| **Mitigation** | JSON.stringify() properly escapes content for JSON; as long as data doesn't contain `</script>` sequences in strings, this is safe. Monitor the schema generation for string escaping. |

---

## 5. Environment Variable Security

### SEC-014 · MEDIUM · Unused Environment Variables (Credential Exposure Risk)

Variables defined in examples but potentially set without corresponding code enabled:

| Variable | Risk if set but feature unused |
|----------|-------------------------------|
| `OPENAI_API_KEY` | Set but analytics insights disabled → no immediate risk (LLM not called) |
| `RESEND_API_KEY` + `EMAIL_ENABLED=false` | Email credential present but unused — standard |
| `BULKSMS_KEY` / `BULKSMS_PASSWORD` | SMS credential present — standard |
| `BYPASS_OTP` | **Blocked in production by runtime-env.ts** ✅ |

**Good practices present:**
- `runtime-env.ts` validates at startup and refuses to start with `BYPASS_OTP` in production
- `SESSION_SECRET` minimum 32-char check enforced
- Secrets in managed host environment not overridable by `.env.production`

---

### SEC-015 · LOW · VAPID Public Key Exposed

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/push/vapid-public-key` |
| **Issue** | VAPID public key is deliberately exposed (required for push subscription). However, `VAPID_PRIVATE_KEY` must never be exposed. Confirm no logging or serialization of private key exists. |
| **Status** | By design; acceptable |

---

## 6. Infrastructure Security

### SEC-016 · MEDIUM · Docker PORT=3000 May Conflict with PaaS Injection

| Field | Value |
|-------|-------|
| **File** | `Dockerfile` |
| **Issue** | `ENV PORT=3000` is hardcoded. Render/Railway inject `PORT` at runtime; if the image-level env var wins over the runtime injection, the server listens on 3000 when the host assigns a different port. |
| **Fix** | Remove `ENV PORT=3000` from Dockerfile; rely on runtime injection only |

---

### SEC-017 · MEDIUM · BidWar Local Binds to 0.0.0.0 Without TLS

| Field | Value |
|-------|-------|
| **File** | `artifacts/bidwar-local/src/server/index.ts` |
| **Issue** | Local mode server binds to all interfaces (`0.0.0.0:3741`) without TLS. Operator PINs, access codes, and auction commands are transmitted in plaintext on the LAN. |
| **By design** | Intentional for LAN venue mode |
| **Risk** | Any device on the LAN can inspect auction traffic or attempt replay attacks |
| **Mitigation** | Document the threat model; advise operating on an isolated/private LAN; consider operator PIN as a low-value auth for LAN trust model |

---

### SEC-018 · LOW · BidWar Local Bootstrap Route Grants Organizer Without Password

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/auth/organizer/:tid/bootstrap` (bidwar-local only) |
| **Issue** | Grants organizer JWT for imported tournaments without password verification. Trust model: only reachable on LAN, same host ran the import. |
| **Risk** | Lower risk in LAN context; acceptable by design |

---

## 7. lovableupdates/ — Security Hazard

### SEC-019 · HIGH · Stale Prototype Bypasses API Auth Layer

| Field | Value |
|-------|-------|
| **Path** | `/workspace/lovableupdates/` |
| **Issue** | `src/lib/bidwar-live.functions.ts` contains a TanStack Start server function (`getLiveSnapshot`) that queries `tournaments`, `auction_sessions`, `players`, and `branding_settings` via raw SQL using `DATABASE_URL`. This completely bypasses the BidWar API authorization layer. |
| **Impact** | If accidentally deployed or run with production `DATABASE_URL`, auction state (including sensitive operator state) is accessible without any authentication |
| **Additional risk** | `use-auction-state.ts` polls this function every 350ms — if connected to production DB, this becomes a DoS on the database |
| **Current mitigation** | Not in pnpm workspace; not in deploy pipeline; not a running service |
| **Fix** | **DELETE this directory** |

---

## 8. Rate Limiting Gaps

### SEC-020 · MEDIUM · Rate Limits Not Applied to Bid Endpoint

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/tournaments/:id/auction/bid` |
| **Issue** | The auction bid endpoint is explicitly exempted from the global rate limiter. Access code validation is the only gate. Multiple rapid bids from the same IP/team are technically possible (as long as the access code is known). |
| **Note** | This is likely intentional for low-latency bidding; but there's no per-team bid frequency limit |

---

### SEC-021 · LOW · Contact Form Rate Limit Not in Documentation

| Field | Value |
|-------|-------|
| **Limiter** | `contactFormLimiter` (8/15min) |
| **Issue** | Not documented in `.env.example.example`; operators cannot tune it |

---

## 9. Console Logs (Potential Information Disclosure)

The following files contain `console.log`/`console.error` in production code that may leak internal error details to application logs:

| File | Log Type | Risk |
|------|----------|------|
| `lib/runtime-env.ts` | Startup config errors | Low (server logs only) |
| `lib/bootstrap.ts` | Missing .env warnings | Low |
| `lib/master-sports/sync.ts` | Sync errors | Low |
| `lib/master-sports/cricket-roster.ts` | Errors | Low |
| `lib/badminton-service.ts` | Pipeline errors | Low |
| `lib/bulk-import/photo-queue-service.ts` | Job failures | Low |

**Assessment:** All are server-side logs, not client-visible. Risk is limited to log aggregation systems. Switch to structured Pino logging for consistency.

---

## 10. Security Features Present (Positive Findings)

| Feature | Implementation |
|---------|----------------|
| **JWT stateless sessions** | httpOnly cookies, 7-day expiry, domain scoped |
| **Rate limiting** | 12 named limiters covering all sensitive endpoints |
| **CORS allowlist** | `APP_DOMAIN` env var; explicit origin check in `isCorsOriginAllowed()` |
| **OTP bypass blocked in production** | `runtime-env.ts` startup check |
| **Short SESSION_SECRET rejected** | Minimum 32-char validation at startup |
| **Localhost domain rejected in production** | Startup validation |
| **HTTPS enforcement** | nginx config + `APP_PUBLIC_SCHEME` validation |
| **Electron context isolation** | `contextIsolation: true`, `nodeIntegration: false` in Electron |
| **Export token for mirror sync** | Separate token required for local→cloud sync |
| **Operator lock** | Prevents concurrent operator sessions |
| **Login attempt guard** | `login-attempt-guard.ts` tracks failed attempts |
| **Admin lock on tournaments** | `admin_locked` flag for compliance holds |
| **Owner access lockout** | Progressive lockout after failed access code attempts |
| **Captcha** (optional) | Turnstile support for login after failed attempts |

---

## 11. Security Audit Summary

| ID | Severity | Issue |
|----|----------|-------|
| SEC-001 | HIGH | No auth on upload endpoints |
| SEC-002 | HIGH | Public analytics with LLM cost exposure |
| SEC-003 | MEDIUM | Tournament list exposes all metadata |
| SEC-004 | MEDIUM | Roster data public (PII concern) |
| SEC-005 | HIGH | Demo seed endpoint active in production |
| SEC-006 | MEDIUM | ADMIN_PASSWORD reused for seed key |
| SEC-007 | MEDIUM | Twilio webhook validates nothing when token unset |
| SEC-008 | MEDIUM | Scoring PIN comparison not timing-safe |
| SEC-009 | MEDIUM | Hardcoded JWT fallback secret in bidwar-local |
| SEC-010 | LOW | Data-entry admin broad access |
| SEC-011 | LOW | Access codes in localStorage |
| SEC-012 | MEDIUM | dangerouslySetInnerHTML in admin UI |
| SEC-013 | LOW | JSON-LD via dangerouslySetInnerHTML |
| SEC-014 | MEDIUM | Unused credentials in environment |
| SEC-015 | LOW | VAPID public key exposed (by design) |
| SEC-016 | MEDIUM | Docker PORT=3000 hardcoded |
| SEC-017 | MEDIUM | Local mode no TLS (by design) |
| SEC-018 | LOW | Local bootstrap without password (by design) |
| SEC-019 | HIGH | lovableupdates bypasses API auth layer |
| SEC-020 | MEDIUM | No rate limit on bid endpoint |
| SEC-021 | LOW | Contact form rate limit undocumented |

### Immediate Actions (do these first)

1. Add authentication to `/api/upload*` endpoints (SEC-001)
2. Restrict `/api/analytics/insights` to authenticated users (SEC-002)  
3. Add `NODE_ENV` guard to demo seed endpoint (SEC-005)
4. Fail closed on Twilio webhook when `TWILIO_AUTH_TOKEN` unset (SEC-007)
5. Fix hardcoded JWT secret in bidwar-local (SEC-009)
6. Delete `lovableupdates/` directory (SEC-019)
