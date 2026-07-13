# BidWar Operational Runbook

Day-to-day and incident procedures for **staging** and **production**. BidWar is a **live auction platform** — operational rules take precedence over generic SaaS deploy habits.

**Authoritative references:**

| Document | Use when |
|----------|----------|
| [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) | Releases, auction freeze, incident levels, metadata |
| [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) | Pre-promotion validation |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Post-deploy verification and monitoring |
| [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) | Database rollback decisions |
| [DEPLOY.md](./DEPLOY.md) | Render build/start commands |
| [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md) | Environment variables |

---

## Emergency contacts (fill in)

| Role | Name | Contact |
|------|------|---------|
| Engineering owner | _TBD_ | |
| On-call / incident commander | _TBD_ | |
| Auction-day operations | _TBD_ | |
| Neon / database admin | _TBD_ | |
| Render account admin | _TBD_ | |

---

## Daily deployment rules

| Rule | Detail |
|------|--------|
| Default path | `develop` → staging → validation → release PR → `main` → production |
| Staging first | Every change merges to `develop` and validates on staging before `main` |
| No direct `main` pushes | Branch protection + PR only |
| Check auction calendar | Before any production merge, confirm no live auction in next **60 minutes** ([Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety)) |
| Record metadata | Every production deploy uses [Release Metadata](./RELEASE_PROCESS.md#release-metadata) |
| Backport hotfixes | Any `hotfix/*` → `main` must return to `develop` same day |

---

## Auction day rules

BidWar hosts **real-time auctions** with operator, LED, owner, and viewer clients on SSE. Auction days override normal release cadence.

| Rule | Action |
|------|--------|
| **No feature releases** during a live customer auction | Defer `develop` → `main` merge |
| **No schema migrations** within 60 minutes before a scheduled auction start | Apply migrations earlier or after auction window |
| **No production deploy** during a live auction | Unless P0 incident — see [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety) |
| **No Render restart** during active auction | Unless incident response requires it — expect brief SSE disconnect |
| **Staging is allowed** | Continue integrating on `develop`; do not promote to `main` |
| **Communications** | Notify auction-day ops before any approved hotfix |

Full policy and decision tree: [RELEASE_PROCESS.md — Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety).

---

## Incident checklist

Use when production or staging behavior is wrong. Classify per [Incident Levels](./RELEASE_PROCESS.md#incident-levels).

### 1. Triage (first 5 minutes)

| Step | Action |
|------|--------|
| 1 | Record time (IST), reporter, affected tournament(s) |
| 2 | Classify **P0 / P1 / P2** |
| 3 | Is a **live auction in progress**? If yes, follow auction emergency path |
| 4 | Open incident thread; assign incident commander |
| 5 | Identify last known-good Render deploy (commit SHA + Deploy ID) |

### 2. Stabilize

| P0 | P1 | P2 |
|----|----|-----|
| Pause production auto-deploy if needed | Assess user impact | Schedule fix on `develop` |
| Consider Render rollback first | Hotfix if customer-blocking | No production deploy required |
| No schema migration without DB lead approval | Staging reproduce if time allows | |

### 3. Resolve

- P0: [Emergency deployment](./RELEASE_PROCESS.md#emergency-deployment-during-live-auction) or rollback
- Document root cause, timeline, rollback target
- Complete abbreviated [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for P0
- Post-incident review within 48 hours (P0/P1)

### 4. Recover

- Backport fix to `develop`
- Update [Release Metadata](./RELEASE_PROCESS.md#release-metadata) and incident log
- Schedule full staging re-validation before next release

---

## Rollback process (operator summary)

Full detail: [RELEASE_PROCESS.md — Rollback process](./RELEASE_PROCESS.md#rollback-process).

```
Issue detected → Is DB schema OK?
    ├─ Yes → Render rollback to Rollback Target Commit (from Release Metadata)
    └─ No  → Stop deploys → ROLLBACK_STRATEGY.md → Neon PITR (approved only)
```

**Render production rollback:**

1. Dashboard → Production service → **Events**
2. Select last known-good deploy (record Deploy ID)
3. **Rollback** / deploy that version
4. Run critical [Live Auction Smoke Test](./PRODUCTION_CHECKLIST.md#live-auction-smoke-test) if auction active
5. `git revert` on `main` if git history must match

---

## Production restart checklist

Use only when restart is required (memory leak, hung process, Render incident). **Avoid during live auctions.**

| # | Step | Done |
|---|------|------|
| 1 | Confirm engineering owner approval (required if auction within 1 hour) | ☐ |
| 2 | Note current Render Deploy ID and commit SHA | ☐ |
| 3 | Warn auction-day ops if any tournament is live | ☐ |
| 4 | Render → Production service → **Manual Deploy** → **Restart** (or redeploy same commit) | ☐ |
| 5 | Wait for **Live** status | ☐ |
| 6 | `GET /api/healthz` OK | ☐ |
| 7 | Run abbreviated Live Auction Smoke Test on active tournament if applicable | ☐ |
| 8 | Monitor 15 / 30 / 60 min per [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md#post-deploy-monitoring) | ☐ |

**Expected impact:** All SSE clients disconnect and reconnect (~3s client retry). Active bids may need operator verification.

---

## Render restart checklist (staging or production)

| # | Step | Staging | Production |
|---|------|---------|------------|
| 1 | Identify service (staging = `develop`, production = `main`) | ☐ | ☐ |
| 2 | Capture Deploy ID from Events | ☐ | ☐ |
| 3 | Auction freeze check (production only) | N/A | ☐ |
| 4 | Restart or rollback via Events | ☐ | ☐ |
| 5 | Verify healthz + admin login | ☐ | ☐ |
| 6 | Run environment-appropriate checklist | [STAGING](./STAGING_CHECKLIST.md) | [PRODUCTION](./PRODUCTION_CHECKLIST.md) |

---

## Neon verification checklist

Run after migration, suspected connection issues, or post-incident DB questions.

| # | Check | Pass |
|---|-------|------|
| 1 | Confirm branch: **staging** Neon for staging Render; **production** Neon for production Render | ☐ |
| 2 | `DATABASE_URL` in Render matches intended Neon branch (host/db name) | ☐ |
| 3 | Migration ledger version recorded in [Release Metadata](./RELEASE_PROCESS.md#release-metadata) | ☐ |
| 4 | API starts without schema errors in Render logs | ☐ |
| 5 | Staging migration applied **before** production (if release includes DDL) | ☐ |
| 6 | No `drizzle-kit push` on shared Neon ([DATABASE_GOVERNANCE_ADR.md](./DATABASE_GOVERNANCE_ADR.md)) | ☐ |
| 7 | PITR restore point identified before any destructive recovery | ☐ |

---

## Quick command reference

| Task | Command / location |
|------|-------------------|
| Local dev | `pnpm dev` |
| Local smoke | `pnpm run verify:local` |
| Deployed smoke | `VERIFY_BASE_URL=<url> pnpm run verify:production` |
| Staging migrate | `pnpm run migrate:prod` with staging `DATABASE_URL` |
| Production migrate | `pnpm run migrate:prod` with production `DATABASE_URL` |
| Render logs | Dashboard → Service → Logs |
| Neon console | console.neon.tech → project → branch |

---

## Related documents

- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
