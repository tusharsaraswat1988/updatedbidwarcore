# Production Deployment Checklist

Complete **after** Render **production** deploys from `main` (or after an approved hotfix/emergency deploy).

**Production URL:** `https://bidwar.in`

| Release Metadata (production) | Value |
|------------------------------|-------|
| Release Name | |
| Release Date | |
| Commit SHA | |
| Render Deploy ID | |
| Neon Migration Version | |
| Validator | |
| Approver | |
| Rollback Target Commit | |

**Operator:** ________________________ **Date:** __________ **Time (IST):** __________

---

## Sign-off

| Result | Requirement |
|--------|-------------|
| ☐ **PASS** | All **Critical** and **Required** items checked |
| ☐ **PASS WITH NOTES** | Critical/Required pass; follow-up within 24h documented |
| ☐ **FAIL** | Initiate [rollback](./RELEASE_PROCESS.md#rollback-process) — do not announce release complete |

**Notes / incidents:**

```
```

---

## Pre-deploy gates (before merge to `main`)

These must be true **before** merging the release PR. Confirm again here if needed.

| # | Gate | Pass |
|---|------|------|
| P.1 | [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) signed off for this release (or emergency exception documented) | ☐ |
| P.2 | Release PR `develop` → `main` approved per [CONTRIBUTING.md](./CONTRIBUTING.md) | ☐ |
| P.3 | Production migrations applied per [RELEASE_PROCESS.md](./RELEASE_PROCESS.md#database-migrations-in-the-release-path); **not** during live auction or within 60 min of scheduled start | ☐ |
| P.4 | [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety) satisfied (no live auction blocking deploy) | ☐ |
| P.5 | [Release Metadata](./RELEASE_PROCESS.md#release-metadata) complete; **Rollback Target Commit** recorded | ☐ |
| P.6 | No active **P0** incident unrelated to this release | ☐ |

---

## 1. Deploy health (Critical)

| # | Check | Pass |
|---|-------|------|
| 1.1 | Render **production** deploy status is **Live** for expected `main` commit | ☐ |
| 1.2 | `GET https://bidwar.in/api/healthz` (or prod `APP_URL`) returns healthy response | ☐ |
| 1.3 | `GET https://bidwar.in/admin/login` returns HTTP 200 | ☐ |
| 1.4 | Render logs: no crash loop, no missing required env errors | ☐ |
| 1.5 | Deploy commit matches merged `main` SHA (`healthz.commitSha` / Render dashboard) | ☐ |
| 1.6 | **Super Admin scope regression:** `GET https://bidwar.in/api/__probe_not_a_real_route` must **NOT** return `{"middleware":"requireMasterAdmin"}` (expect SPA HTML or 404). If it returns Super Admin 403, production is still on the broken Communication Center mount — Manual Deploy / clear build cache from `main`. | ☐ |
| 1.7 | `GET https://bidwar.in/api/tournaments/1/badminton` must **NOT** return Super Admin 403 for unauthenticated callers (expect 401/404/HTML — not `requireMasterAdmin`) | ☐ |

---

## 2. Environment correctness (Critical)

| # | Check | Pass |
|---|-------|------|
| 2.1 | Production `DATABASE_URL` is **Neon production** — verified in Render dashboard | ☐ |
| 2.2 | `APP_URL` = `https://bidwar.in` (or approved production canonical URL) | ☐ |
| 2.3 | `APP_DOMAIN` includes production hostnames (`bidwar.in`, `www.bidwar.in` if used) | ☐ |
| 2.4 | `SESSION_SECRET` is production-only (not staging value) | ☐ |
| 2.5 | `NODE_ENV=production`, `SERVE_STATIC=true` | ☐ |
| 2.6 | `BYPASS_OTP` is **not** set to `true` | ☐ |

Reference: [RENDER_ENV_VARS.md — Production](./RENDER_ENV_VARS.md#production-render-service-main-branch)

---

## 3. Authentication (Required)

| # | Check | Pass |
|---|-------|------|
| 3.1 | Admin login succeeds | ☐ |
| 3.2 | Session persists after refresh | ☐ |
| 3.3 | Google OAuth login (if enabled) completes with production callback URI | ☐ |
| 3.4 | Organizer portal login works for a non-customer test org (if available) | ☐ |

---

## 4. Live Auction Smoke Test (Required)

Use a **low-risk test tournament** or observe a **non-critical lot** during a live event. Open **Operator Panel**, **LED Display**, **Owner Panel**, and **Viewer Screen**.

| # | Action | Operator | LED | Owner | Viewer | Pass |
|---|--------|:--------:|:---:|:-----:|:------:|:----:|
| 4.1 | Surfaces load | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.2 | **Create bid** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.3 | **Rapid bid** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.4 | **Undo bid** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.5 | **Pause auction** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.6 | **Resume auction** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.7 | **Sold player** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.8 | **Unsold player** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.9 | **Next player** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.10 | **SSE propagation** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.11 | **Purse synchronization** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.12 | **Timer synchronization** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.13 | **No duplicate bid** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.14 | **Button unlock** | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.15 | **No stuck pending state** | ☐ | ☐ | ☐ | ☐ | ☐ |

**During an active customer auction:** treat every row as **Critical**. On hotfix/emergency deploy, run at minimum 4.2, 4.10, 4.11, 4.13, 4.15 on the live tournament.

---

## 5. Integrations (Required if enabled in production)

| # | Check | Pass |
|---|-------|------|
| 5.1 | Cloudinary uploads succeed (test image in admin) | ☐ |
| 5.2 | SMS / WhatsApp test uses approved template (sandbox or single test recipient) | ☐ |
| 5.3 | Email test send (Resend) delivers to internal address only | ☐ |
| 5.4 | Web push / VAPID (if enabled): subscribe flow on owner app | ☐ |
| 5.5 | Twilio webhooks point to **production** `APP_URL` | ☐ |

---

## 6. SEO and public site (Required for marketing releases)

Skip for backend-only hotfixes.

| # | Check | Pass |
|---|-------|------|
| 6.1 | Homepage loads over HTTPS | ☐ |
| 6.2 | `robots.txt` and sitemap routes respond | ☐ |
| 6.3 | No staging hostname in canonical tags (visual or view-source spot check) | ☐ |

---

## 7. Automated smoke (Recommended)

```bash
VERIFY_BASE_URL=https://bidwar.in pnpm run verify:production
```

| # | Check | Pass |
|---|-------|------|
| 7.1 | Script completes: healthz, admin login page, CORS preflight, auth probe | ☐ |

---

## Post-deploy monitoring (Required)

Monitor Render **production** at **15 min**, **30 min**, and **1 hour** after deploy. Record observations in release notes or incident thread.

### 15 minutes

| # | Check | Pass |
|---|-------|------|
| M15.1 | Render logs: no crash loop or OOM | ☐ |
| M15.2 | **HTTP 5xx** rate normal (no spike in Render metrics / logs) | ☐ |
| M15.3 | **SSE reconnect rate** stable — no sustained reconnect storm | ☐ |
| M15.4 | `/api/healthz` still healthy | ☐ |

### 30 minutes

| # | Check | Pass |
|---|-------|------|
| M30.1 | **Memory** usage stable (no continuous climb in Render metrics) | ☐ |
| M30.2 | **CPU** not pegged sustained | ☐ |
| M30.3 | **Auction latency** acceptable — operator bid → LED update feels instant (< 2s observed) | ☐ |
| M30.4 | No new error patterns in server logs | ☐ |

### 1 hour

| # | Check | Pass |
|---|-------|------|
| M60.1 | All above remain acceptable | ☐ |
| M60.2 | On-call / release operator still contactable | ☐ |
| M60.3 | Release Metadata finalized in PR / ops log (Deploy ID, Rollback Target) | ☐ |
| M60.4 | Stakeholders notified if customer-visible change | ☐ |

---

## 9. Release housekeeping (Required)

| # | Check | Pass |
|---|-------|------|
| 9.1 | Git tag on `main` (if release policy requires) | ☐ |
| 9.2 | `develop` backported if hotfix was used | ☐ |
| 9.3 | [Release Metadata](./RELEASE_PROCESS.md#release-metadata) archived | ☐ |
| 9.4 | P0/P1 incidents logged with [Incident Level](./RELEASE_PROCESS.md#incident-levels) | ☐ |

---

## Hotfix / emergency abbreviated checklist

When [RELEASE_PROCESS.md — Emergency deployment](./RELEASE_PROCESS.md#emergency-deployment-process) is invoked, minimum bar:

| Critical only | Pass |
|---------------|------|
| Deploy Live + healthz | ☐ |
| Production `DATABASE_URL` correct | ☐ |
| Live Auction Smoke Test (min. 4.2, 4.10, 4.11, 4.13, 4.15) | ☐ |
| Rollback Target Commit identified | ☐ |
| Backport to `develop` scheduled same day | ☐ |

Complete full checklist within **24 hours**.

---

## Rollback trigger

Initiate rollback if any **Critical** item fails and cannot be fixed forward within the incident window:

1. [RELEASE_PROCESS.md — Rollback process](./RELEASE_PROCESS.md#rollback-process)
2. Render → Production → Events → deploy previous known-good build
3. Document incident and schedule fix through `develop` → staging → `main`

---

## Related documents

- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) — auction safety, incident levels, rollback
- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [RUNBOOK.md](./RUNBOOK.md) — restarts, incidents, auction day
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md)
- [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md)
