# BidWar Release Process

This document defines how code moves from development through staging validation to production. It is the authoritative reference for **releases**, **hotfixes**, **rollbacks**, and **emergency deployments**.

**Related docs:**

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branch strategy, PR rules, `main` protection |
| [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) | Pre-promotion validation on staging |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Production deploy verification |
| [DEPLOY.md](./DEPLOY.md) | Render build/start commands, platform notes |
| [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md) | Environment variables per service |
| [docs/STAGING_ENVIRONMENT_AUDIT.md](./docs/STAGING_ENVIRONMENT_AUDIT.md) | Staging/production isolation audit |
| [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) | Database rollback scenarios |
| [RUNBOOK.md](./RUNBOOK.md) | Daily rules, auction day, restarts, incidents |

---

## Deployment pipeline

BidWar is a **live auction platform**. Production changes reach customers only after staging **validation** and an explicit **release** PR to `main`.

```
  Developer
      │
      ▼
  ┌─────────┐
  │ develop │  ← feature/fix PRs merge here
  └────┬────┘
       │ auto-deploy
       ▼
  ┌─────────────────┐
  │ Render Staging  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Neon Staging   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   validation    │  ← STAGING_CHECKLIST.md + Live Auction Smoke Test
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Release PR    │  ← develop → main (approved, auction-free window)
  └────────┬────────┘
           │ merge
           ▼
  ┌─────────┐
  │  main   │
  └────┬────┘
       │ auto-deploy
       ▼
  ┌───────────────────┐
  │ Render Production │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │  Neon Production  │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │  Live Customers   │  ← operator · LED · owner · viewer (SSE)
  └───────────────────┘
```

| Stage | Git branch | Render | Database |
|-------|------------|--------|----------|
| **staging** | `develop` | Staging web service | Neon staging |
| **production** | `main` | Production web service | Neon production |

**Terminology:** **develop** (branch) deploys to **staging** (environment). After **validation**, a **release** PR merges to **main**, which deploys to **production**.

**Rules:**

- All feature work merges into **`develop`** first.
- **`main`** receives changes only via **release PR** after staging validation passes.
- Render **auto-deploys** each service from its tracked branch.
- Staging and production use **separate Neon databases** and **separate Render env var sets**. Never share `DATABASE_URL`, `SESSION_SECRET`, or integration keys.

---

## Auction Release Safety

BidWar is not generic SaaS. Deploy and migration decisions must account for **live auctions** in progress or imminently scheduled.

### Hard rules

| Rule | Detail |
|------|--------|
| **Never deploy production during a live auction** | No merge to `main`, no Render production deploy, no production migration |
| **Never run migrations within 60 minutes before a scheduled auction** | DDL risk before go-live |
| **Never restart Render production during an active auction** | Unless P0 incident response requires it — SSE clients will disconnect |
| **Live auction in progress** | Feature releases **forbidden** · schema migrations **forbidden** · infra changes **forbidden** |
| **Auction within one hour** | Only **hotfixes** allowed · **engineering owner approval** required · **rollback target commit** must be identified before deploy |

### Decision tree

```
                    ┌──────────────────────────────┐
                    │ Planned production change?   │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ Live auction IN PROGRESS     │
                    │ on production?               │
                    └──────┬───────────────┬───────┘
                       YES │               │ NO
                           ▼               ▼
              ┌────────────────────┐   ┌────────────────────────────┐
              │ FORBIDDEN:         │   │ Auction starts within      │
              │ · feature release  │   │ 60 minutes?                │
              │ · migration        │   └──────┬──────────────┬──────┘
              │ · infra change     │          YES              NO
              │ · routine deploy   │           ▼               ▼
              │                    │   ┌──────────────┐   ┌─────────────────┐
              │ ALLOWED only:      │   │ HOTFIX only  │   │ Standard release│
              │ P0 hotfix + owner  │   │ Owner approval│   │ if staging      │
              │ approval + rollback│   │ Rollback plan │   │ validation PASS │
              │ plan documented    │   │ documented    │   │ + metadata done │
              └────────────────────┘   └──────────────┘   └─────────────────┘
```

### Emergency deployment during live auction

Use only for **P0** (live auction broken, owner bidding broken, data corruption risk).

1. **Engineering owner** approves verbally and in PR/incident thread.
2. **Rollback target commit** recorded in [Release Metadata](#release-metadata) before merge.
3. Branch `hotfix/<incident>` from `main` — **minimal** fix, **no schema migration** unless DB lead approves.
4. Expedited PR to `main`; merge triggers production deploy.
5. **Live Auction Smoke Test** on affected tournament immediately ([PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)).
6. Monitor 15 / 30 / 60 minutes.
7. Backport to `develop` same day.

See also [RUNBOOK.md — Auction day rules](./RUNBOOK.md#auction-day-rules).

---

## Release Metadata

Record this for **every production release** (standard, hotfix, or emergency). Copy into the release PR body and incident thread.

| Field | Example / source |
|-------|------------------|
| **Release Name** | `2026-07-11 — owner SSE reconnect` |
| **Release Date** | `2026-07-11` (IST) |
| **Commit SHA** | `abc123...` (merged `main` HEAD) |
| **Render Deploy ID** | Render → Production → Events → deploy ID |
| **Neon Migration Version** | Ledger / migration label applied (or `none`) |
| **Validator** | Name — staging checklist sign-off |
| **Approver** | Name — release PR approver |
| **Rollback Target Commit** | Previous known-good SHA + Render Deploy ID |

**Template (paste into release PR):**

```markdown
## Release Metadata
- Release Name:
- Release Date:
- Commit SHA:
- Render Deploy ID:
- Neon Migration Version:
- Validator:
- Approver:
- Rollback Target Commit:
```

---

## Incident Levels

| Level | Definition | Examples | Response |
|-------|------------|----------|----------|
| **P0** | Live auction or core bidding broken; data integrity at risk | Live auction frozen; owner cannot bid; duplicate bids; purse corruption; production down during auction | **Immediate hotfix** or rollback. Engineering owner + incident commander. Auction emergency path. |
| **P1** | Major feature broken; no active auction data corruption | Registration broken; email/SMS delivery failure; image upload down; scoring bug on live match page | Hotfix or fast release after staging smoke. Target response: **< 4 hours**. |
| **P2** | Minor or non-customer-critical | UI glitch; SEO/meta wrong; docs; cosmetic bug | Fix on `develop`, normal release cycle. No production deploy until next validated release. |

**Response expectations:**

| Level | Staging required? | Production deploy | Post-incident review |
|-------|-------------------|-------------------|----------------------|
| P0 | Abbreviated if auction active | Immediate (approved) | Within 48 hours |
| P1 | Yes when time permits | Same day or next window | Within 1 week |
| P2 | Yes (normal path) | Next scheduled release | Optional |

Operational steps: [RUNBOOK.md — Incident checklist](./RUNBOOK.md#incident-checklist).

---

## Standard release (develop → staging → main → production)

Use this for planned features, fixes, and routine releases.

### 1. Develop on `develop`

1. Branch from `develop`: `feature/<short-description>` or `fix/<short-description>`.
2. Implement changes locally (`pnpm dev`).
3. Run local checks:
   ```bash
   pnpm run typecheck
   pnpm run verify:local
   ```
4. Open a **pull request into `develop`** (not `main`).
5. After review, merge to `develop`.

### 2. Staging auto-deploy

When commits land on `develop`, Render **staging** rebuilds and deploys automatically.

- Confirm deploy status in **Render Dashboard → Staging service → Events**.
- Wait until the deploy shows **Live** before validating.

### 3. Staging validation

Complete **[STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)** including the **Live Auction Smoke Test**.

Record [Release Metadata](#release-metadata) fields (validator; commit SHA; migration version).

**Do not open a release PR to `main` until the [Promotion Gate](./STAGING_CHECKLIST.md#promotion-gate) passes.**

### 4. Promote to production (release PR: `develop` → `main`)

**Before opening the PR:** confirm [Auction Release Safety](#auction-release-safety) — no live auction, not within 60 minutes of scheduled start.

1. Open **release PR: `develop` → `main`**.
   - Title: `Release: <version or date> — <summary>`
   - Body: [Release Metadata](#release-metadata), staging validation sign-off, migration notes.
2. Require **at least one approving review** (see [CONTRIBUTING.md](./CONTRIBUTING.md)).
3. Ensure CI/review checks pass (when configured).
4. **Merge** the PR (squash or merge commit per team convention — prefer **merge commit** to preserve release boundary).
5. Render **production** auto-deploys from `main`.

### 5. Production verification

Complete **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** including **Live Auction Smoke Test** and **post-deploy monitoring** (15 / 30 / 60 min).

Fill production **Render Deploy ID** in Release Metadata.

### 6. Tag the release (recommended)

After production verification:

```bash
git checkout main
git pull origin main
git tag -a vYYYY.MM.DD.N -m "Release YYYY-MM-DD: <summary>"
git push origin vYYYY.MM.DD.N
```

Use semantic or date-based tags consistently. Tags are optional but strongly recommended for rollback reference.

---

## Hotfix process

Use when production is **P0 or P1** broken and cannot wait for the normal `develop` → staging → validation → release cycle. During a **live auction**, only **P0** hotfixes per [Auction Release Safety](#auction-release-safety).

### When to use a hotfix

- Production outage or data-corruption risk
- Security vulnerability in production
- Critical auction-day failure affecting live customers

### Hotfix workflow

```
main ──► hotfix/<issue> ──► PR to main ──► production deploy
  │
  └──► cherry-pick or PR back to develop (required)
```

1. **Branch from `main`:** `hotfix/<issue-id>-<short-description>`
2. Implement the **minimal fix** — no unrelated changes.
3. **Validate locally** (`pnpm run typecheck`, targeted manual test).
4. **Optional expedited staging:** If time permits, cherry-pick the hotfix commit onto `develop` and run abbreviated staging checks. If production is down, skip staging with **incident lead approval** (document in PR).
5. Open **PR: `hotfix/*` → `main`**.
   - Mark as **hotfix** in title.
   - Require expedited review (one senior approver).
6. Merge to `main` → Render production auto-deploys.
7. Run **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** (abbreviated section allowed for true emergencies — document what was skipped).
8. **Backport to `develop`** (mandatory):
   - Open PR: `main` → `develop`, or cherry-pick hotfix commit onto `develop`.
   - Resolve conflicts; merge so `develop` does not regress.

### Hotfix rules

- Never commit directly to `main` (branch protection enforces this).
- Never leave `develop` without the hotfix — drift causes the next release to reintroduce the bug.
- Schema changes during hotfix require extra scrutiny; prefer **forward-fix** migrations. See [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md).

---

## Rollback process

Rollback means returning production to a **known-good state**. Prefer the **least destructive** option first.

### Decision tree

```
Production issue detected
        │
        ├─ App bug, DB schema OK? ──► Roll back Render deploy (previous commit)
        │
        ├─ Bad deploy commit on main? ──► Revert commit on main, redeploy
        │
        ├─ Bad schema migration? ──► Stop deploys; see ROLLBACK_STRATEGY.md / Neon PITR
        │
        └─ Data corruption? ──► Incident response; Neon point-in-time recovery
```

### A. Application rollback (most common)

**Render production — deploy previous image:**

1. Render Dashboard → **Production service** → **Events** (or **Manual Deploy**).
2. Select the **last known-good deploy** before the bad release.
3. Click **Rollback** / **Deploy this version**.
4. Verify with [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) (critical paths only).

**Git revert (when rollback deploy is insufficient):**

```bash
git checkout main
git pull origin main
git revert <bad-commit-sha>   # or revert merge commit
git push origin main
```

Render will auto-deploy the reverted `main`. Open a follow-up PR to fix forward on `develop`.

### B. Database rollback

Application rollback **does not** undo database migrations. If a migration caused the incident:

1. **Stop** further deploys to production.
2. Follow **[ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md)**.
3. Use **Neon point-in-time restore** only with explicit RPO/RTO approval.
4. Coordinate with engineering lead before restoring production data.

### C. Staging rollback

Staging failures are lower risk:

- Revert the bad commit on `develop`, or
- Roll back the Render staging deploy to a previous build.

Never use staging rollback as a substitute for fixing forward on `develop`.

### After any rollback

1. Document incident: timeline, root cause, rollback method.
2. Create fix on `develop`, validate on staging, re-release through standard process.
3. Update runbooks if a checklist item would have caught the issue earlier.

---

## Emergency deployment process

Use when **speed outweighs full staging validation** (P0 production down, live auction broken, active security exploit).

During a **live auction**, follow [Emergency deployment during live auction](#emergency-deployment-during-live-auction) only.

Operational checklist: [RUNBOOK.md](./RUNBOOK.md).

### Authority

Emergency deploy requires **explicit approval** from one of:

- Engineering lead
- On-call incident commander
- Business owner (auction-day operations)

Approver name and reason must be recorded in the PR or incident channel.

### Emergency steps

1. **Assess:** Confirm production impact; start incident thread (time, symptoms, affected tournaments).
2. **Branch:** `hotfix/<incident-id>` from `main` (or revert on `main` if bad commit is known).
3. **Fix or revert:** Minimal change only.
4. **Skip full staging validation** if approved — optional smoke test on staging if deploy latency allows.
5. **PR to `main`:** Expedited review; merge when one senior approver signs off.
6. **Monitor:** Watch Render deploy logs, `/api/healthz`, and live auction SSE during rollout.
7. **Production checklist:** Run **critical-path items only** from [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md); complete full checklist within 24 hours.
8. **Backport** to `develop` within the same incident window.
9. **Post-incident review** within 48 hours.

### Emergency do-nots

- Do not share staging/production `DATABASE_URL` or run migrations against the wrong database.
- Do not disable auth, rate limits, or webhooks without documenting why.
- Do not force-push to `main`.
- Do not leave `develop` out of sync with the emergency fix.

### Render emergency controls

| Action | Where |
|--------|-------|
| Pause auto-deploy | Render → Production service → Settings → Auto-Deploy off (temporary) |
| Manual deploy specific commit | Render → Manual Deploy → select branch/commit |
| Rollback | Render → Events → previous successful deploy |
| Scale / restart | Render → Restart service (last resort; brief SSE disconnect) |

---

## Database migrations in the release path

| Environment | When migrations run | Command (reference) |
|-------------|---------------------|-------------------|
| Local dev | Developer machine | `pnpm run migrate` |
| Staging | After staging deploy or via release operator | `pnpm run migrate:prod` with **staging** `DATABASE_URL` |
| Production | Before or coordinated with app deploy | `pnpm run migrate:prod` with **production** `DATABASE_URL` |

**Governance:**

- Apply migrations to **staging** first; validate on staging including Live Auction Smoke Test.
- Apply production migrations **outside** the 60-minute pre-auction window and **never during** a live auction.
- See [DATABASE_GOVERNANCE_ADR.md](./DATABASE_GOVERNANCE_ADR.md) — no `drizzle-kit push` on shared Neon environments.

---

## Release cadence (recommended)

| Type | Cadence | Path |
|------|---------|------|
| Standard release | Weekly or bi-weekly | `develop` → validation → `main` |
| Fix release | As needed after staging pass | Same |
| Hotfix | Immediate | `hotfix/*` → `main` → backport `develop` |
| Emergency | Immediate | Approved skip of staging validation |

---

## Quick reference

| I need to… | Do this |
|------------|---------|
| Ship a feature | PR → `develop` → staging checklist → PR → `main` |
| Fix production now | `hotfix/*` from `main` → PR → `main` → backport `develop` |
| Undo bad production deploy | Render rollback or `git revert` on `main` |
| Undo bad staging deploy | Roll back Render staging or revert on `develop` |
| Check env vars | [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md) |
| Validate staging | [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) |
| Validate production | [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) |
| Auction / ops rules | [RUNBOOK.md](./RUNBOOK.md) |
| Contribute day-to-day | [CONTRIBUTING.md](./CONTRIBUTING.md) |
