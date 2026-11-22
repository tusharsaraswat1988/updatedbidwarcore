# Staging Validation Checklist

Complete on **Render staging** (`develop` branch) **before** opening a release PR to `main`.

**Staging URL:** ________________________________

| Release Metadata (staging) | Value |
|---------------------------|-------|
| Commit SHA | |
| Render Deploy ID | |
| Neon Migration Version | |
| Validator | |
| Date | |

---

## Sign-off

| Result | Requirement |
|--------|-------------|
| ☐ **PASS** | All **Critical** and **Required** items checked |
| ☐ **PASS WITH NOTES** | Critical/Required pass; optional items documented in notes |
| ☐ **FAIL** | Do **not** promote to `main` — fix on `develop` and re-validate |

**Notes / failures:**

```
(attach links to issues, screenshots, or incident notes)
```

---

## 1. Deploy health (Critical)

| # | Check | Pass |
|---|-------|------|
| 1.1 | Render staging deploy status is **Live** for the target commit | ☐ |
| 1.2 | `GET <APP_URL>/api/healthz` returns `{"ok":true}` (or documented healthy response) | ☐ |
| 1.3 | `GET <APP_URL>/admin/login` returns HTTP 200 | ☐ |
| 1.4 | No startup errors in Render logs (missing env, DB connection, schema) | ☐ |
| 1.5 | Deployed commit matches expected `develop` HEAD (or documented cherry-pick) | ☐ |

---

## 2. Environment isolation (Critical)

Confirm staging does **not** share production resources.

| # | Check | Pass |
|---|-------|------|
| 2.1 | `DATABASE_URL` points to **Neon staging** — not production | ☐ |
| 2.2 | `APP_URL` / `APP_DOMAIN` are **staging hostnames only** (not `bidwar.in`) | ☐ |
| 2.3 | `SESSION_SECRET` is **unique** to staging (not copied from production) | ☐ |
| 2.4 | `ADMIN_PASSWORD` is staging-specific (or documented shared risk) | ☐ |
| 2.5 | Integration keys (Twilio, Resend, Cloudinary, OAuth) are **staging-isolated or disabled** | ☐ |
| 2.6 | `REDIS_URL` (if set) is not shared with production | ☐ |

Reference: [RENDER_ENV_VARS.md — Staging](./RENDER_ENV_VARS.md#staging-render-service-develop-branch)

---

## 3. Authentication and sessions (Required)

| # | Check | Pass |
|---|-------|------|
| 3.1 | Admin login succeeds with staging `ADMIN_PASSWORD` | ☐ |
| 3.2 | Session persists across page refresh (cookie set, not immediate logout) | ☐ |
| 3.3 | Logout clears session | ☐ |
| 3.4 | Google OAuth (if enabled): `curl -sI <APP_URL>/api/auth/google` Location has `redirect_uri` for **staging** host (not `bidwar.in`); login completes on staging | ☐ |
| 3.5 | Organizer login / tournament-scoped auth works for a test tournament | ☐ |

---

## 4. Live Auction Smoke Test (Required)

Run end-to-end on a **dedicated test tournament** in staging. Open four surfaces in parallel: **Operator Panel**, **LED Display**, **Owner Panel**, **Viewer Screen**.

| # | Action | Operator | LED | Owner | Viewer | Pass |
|---|--------|:--------:|:---:|:-----:|:------:|:----:|
| 4.1 | Surfaces load without error | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.2 | **Create bid** — amount appears on all surfaces | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.3 | **Rapid bid** — consecutive bids; no duplicate application | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.4 | **Undo bid** — state reverts consistently | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.5 | **Pause auction** — bidding blocked; UI shows paused | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.6 | **Resume auction** — bidding restored | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.7 | **Sold player** — sold state on all surfaces | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.8 | **Unsold player** — unsold state on all surfaces | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.9 | **Next player** — roster advances; timer resets appropriately | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.10 | **SSE propagation** — updates without full page refresh | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.11 | **Purse synchronization** — team budgets match across surfaces | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.12 | **Timer synchronization** — countdown aligned across surfaces | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.13 | **No duplicate bid** — single winning amount after rapid bids | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.14 | **Button unlock** — bid controls re-enable after server round-trip | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4.15 | **No stuck pending state** — no perpetual loading/spinner on bid buttons | ☐ | ☐ | ☐ | ☐ | ☐ |

> Re-run this section after any change touching auction, SSE, bids, timer, or purse logic.

---

## 5. Database and migrations (Required if schema changed)

Skip section if this release has **no** migration files.

| # | Check | Pass |
|---|-------|------|
| 5.1 | Migrations applied to **staging** DB before or with this deploy | ☐ |
| 5.2 | API starts without schema errors in logs | ☐ |
| 5.3 | Affected features work (list tables/columns touched): _______________ | ☐ |
| 5.4 | Rollback plan documented in PR if migration is non-trivial | ☐ |

---

## 6. Registration and public flows (Required if touched)

Skip if release does not touch registration, payments, or public pages.

| # | Check | Pass |
|---|-------|------|
| 6.1 | Player registration link opens (`/register/<code>`) | ☐ |
| 6.2 | Registration submit succeeds (test player) | ☐ |
| 6.3 | Payment flow (if enabled) reaches expected state | ☐ |

---

## 7. Communications (Required if touched)

Skip if release does not touch SMS, email, or WhatsApp.

| # | Check | Pass |
|---|-------|------|
| 7.1 | Staging uses **stub or sandbox** messaging — no real customer SMS/email | ☐ |
| 7.2 | Test send from comm UI completes (stub log or sandbox delivery) | ☐ |
| 7.3 | Merge variables in templates resolve staging `APP_URL` where applicable | ☐ |

---

## 8. Scoring module (Required if `SCORING=true`)

| # | Check | Pass |
|---|-------|------|
| 8.1 | Cricket or badminton scoring routes load (no 404) | ☐ |
| 8.2 | Live score update propagates via SSE to connected clients | ☐ |

---

## 9. Static assets and PWA (Optional)

| # | Check | Pass |
|---|-------|------|
| 9.1 | Homepage loads; no blank shell | ☐ |
| 9.2 | Owner app loads at `/owner-app/join` | ☐ |
| 9.3 | Image upload works (if Cloudinary configured on staging) | ☐ |
| 9.4 | Favicon / manifest routes respond | ☐ |

---

## 10. Automated smoke (Recommended)

From a machine with network access to staging:

```bash
VERIFY_BASE_URL=https://<staging-host> pnpm run verify:production
```

| # | Check | Pass |
|---|-------|------|
| 10.1 | `verify:production` script completes (health, login page, CORS preflight) | ☐ |

> The script is named for production patterns but is valid against any deployed origin when `VERIFY_BASE_URL` is set to staging.

---

## 11. Release PR readiness (Required)

| # | Check | Pass |
|---|-------|------|
| 11.1 | All PRs in this release are merged to `develop` | ☐ |
| 11.2 | Release PR description lists changes and migration notes | ☐ |
| 11.3 | Known issues documented (won't-fix vs follow-up ticket) | ☐ |
| 11.4 | Staging sign-off pasted into release PR (`develop` → `main`) | ☐ |

---

## Promotion gate

**Promotion to `main` is FORBIDDEN until ALL of the following are true:**

| Gate | Pass |
|------|:----:|
| All **Critical** checklist items PASS | ☐ |
| All **Required** checklist items PASS (including §4 Live Auction Smoke Test) | ☐ |
| **No active P0 issue** on staging or production | ☐ |
| **Validator signs off** (name + date in Release Metadata) | ☐ |
| **Release notes completed** in upcoming release PR body | ☐ |
| **Migration reviewed** (if DDL included): applied on Neon staging, rollback plan documented | ☐ |
| [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety): no production live auction; not within 60 min of scheduled start | ☐ |

**When all gates pass:**

1. Open **release PR:** `develop` → `main` with [Release Metadata](./RELEASE_PROCESS.md#release-metadata)
2. Attach this completed checklist (or link)
3. Obtain approver per [CONTRIBUTING.md](./CONTRIBUTING.md)
4. Merge → production auto-deploys → [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

---

## Related documents

- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) — auction safety, incident levels, release metadata
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [RUNBOOK.md](./RUNBOOK.md)
- [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md)
- [docs/STAGING_ENVIRONMENT_AUDIT.md](./docs/STAGING_ENVIRONMENT_AUDIT.md)
