# Contributing to BidWar

Thank you for contributing. This guide defines the **engineering workflow**, **branch strategy**, and **repository governance** for `updatedbidwarcore`.

**Read first:**

- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) — releases, auction safety, hotfixes, rollbacks, incident levels
- [RUNBOOK.md](./RUNBOOK.md) — daily rules, auction day, restarts, incidents
- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) — required before promoting to `main`
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) — required after production deploy

---

## Engineering workflow

All cloud changes follow:

```
develop → staging → validation → release → main → production
```

Full pipeline diagram: [RELEASE_PROCESS.md — Deployment pipeline](./RELEASE_PROCESS.md#deployment-pipeline).

| Term | Meaning |
|------|---------|
| **develop** | Git branch; integration target for feature/fix PRs |
| **staging** | Render staging environment (auto-deploy from `develop`) |
| **validation** | Human checklist on staging ([STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)) |
| **release** | Approved PR merging `develop` → `main` |
| **main** | Git branch; production-ready code only |
| **production** | Render production environment (auto-deploy from `main`) |

**Auction rule:** Never merge a release to `main` during a live auction or within 60 minutes of a scheduled auction start. See [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety).

**Local development** uses `pnpm dev` with root `.env` (development database). Never point local `.env` at Neon production.

---

## Branch strategy

### Long-lived branches

| Branch | Purpose | Deploys to | Who merges |
|--------|---------|------------|------------|
| `main` | Production-ready code | Render **production** | Release PR only (`develop` → `main`, or `hotfix/*` → `main`) |
| `develop` | Integration / pre-production | Render **staging** | Feature/fix PRs from short-lived branches |

### Short-lived branches

| Pattern | Base branch | Merge target | Use for |
|---------|-------------|--------------|---------|
| `feature/<name>` | `develop` | `develop` | New features |
| `fix/<name>` | `develop` | `develop` | Non-urgent bug fixes |
| `hotfix/<name>` | `main` | `main` (+ backport to `develop`) | Production emergencies |
| `chore/<name>` | `develop` | `develop` | Docs, tooling, deps (no behavior change) |

### Branch naming examples

```
feature/badminton-scoring-export
fix/owner-sse-reconnect
hotfix/auction-timer-race
chore/update-render-docs
```

### What not to do

- Do **not** open PRs directly into `main` for routine work.
- Do **not** force-push to `main` or `develop`.
- Do **not** long-lived personal branches — rebase or merge from `develop` frequently.
- Do **not** commit secrets (`.env`, API keys, `DATABASE_URL`) — use Render dashboard / Neon console.

---

## Protecting `main`

`main` is **production**. The following rules apply to every contributor and release operator.

### GitHub branch protection (required settings)

Configure in **GitHub → Repository → Settings → Branches → Branch protection rules → Add rule** for `main`:

| Setting | Value | Why |
|---------|-------|-----|
| **Branch name pattern** | `main` | |
| **Require a pull request before merging** | Enabled | No direct pushes |
| **Required approvals** | `1` (recommend `2` for production orgs) | Human gate before production |
| **Dismiss stale pull request approvals when new commits are pushed** | Enabled | Re-review after changes |
| **Require status checks to pass before merging** | Enabled (when CI exists) | Build/test gate |
| **Require branches to be up to date before merging** | Enabled | Avoid skewed merges |
| **Do not allow bypassing the above settings** | Enabled for admins | Consistency |
| **Restrict who can push to matching branches** | Optional: release managers only | Extra guard |
| **Allow force pushes** | **Disabled** | Prevent history rewrite |
| **Allow deletions** | **Disabled** | Prevent accidental branch delete |

### Protecting `develop` (recommended)

Apply a lighter rule on `develop`:

- Require PR before merging (optional for solo maintainer, recommended for teams)
- Allow force push: **disabled**
- Status checks: enable when CI is added

### Setting protection via GitHub CLI

Repository admins can apply rules with [`gh`](https://cli.github.com/):

```bash
# main — strict protection
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Replace `{owner}/{repo}` with your GitHub org and repository name. Add CI context names to `contexts` when workflows exist.

### Merge permissions

| Target branch | Allowed merge methods |
|---------------|----------------------|
| `develop` | Squash merge or merge commit |
| `main` | **Merge commit** preferred (clear release boundary); squash acceptable if team agrees |

---

## Pull request workflow

### Feature or fix (into `develop`)

1. `git checkout develop && git pull origin develop`
2. `git checkout -b feature/my-change`
3. Make changes; commit with clear messages.
4. Push: `git push -u origin feature/my-change`
5. Open PR: **base `develop`**, compare your branch.
6. Fill PR template (summary, test plan, screenshots if UI).
7. Address review feedback.
8. Merge when approved → staging auto-deploys.

### Release (into `main`)

1. Complete [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) including **Live Auction Smoke Test**.
2. Confirm [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety).
3. Open **release PR:** base `main`, compare `develop`.
4. Include [Release Metadata](./RELEASE_PROCESS.md#release-metadata) in PR body.
5. Obtain required approvals.
6. Merge → production auto-deploys.
7. Complete [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).

### Hotfix (into `main`)

See [RELEASE_PROCESS.md — Hotfix process](./RELEASE_PROCESS.md#hotfix-process).

---

## Local development setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (local or Neon **development** branch)

### First-time setup

```bash
git clone https://github.com/<org>/updatedbidwarcore.git
cd updatedbidwarcore
cp .env.example.example .env
# Edit .env — use DEVELOPMENT database only
pnpm install
pnpm dev
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | API + auction UI + owner app (split dev servers) |
| `pnpm run typecheck` | TypeScript check across workspace |
| `pnpm run verify:local` | Smoke test against local dev servers |
| `pnpm run build` | Full production build (typecheck + deploy build) |
| `pnpm run start:prod` | Run production-like single process locally |

See [DEPLOY.md](./DEPLOY.md) for port layout and environment details.

---

## Code and change guidelines

### Scope

- Keep PRs focused — one feature or fix per PR when possible.
- Do not mix unrelated refactors with functional changes.
- Match existing patterns in the surrounding code.

### What requires extra review

| Change type | Notes |
|-------------|-------|
| Database schema / migrations | Staging migration first; see [DATABASE_GOVERNANCE_ADR.md](./DATABASE_GOVERNANCE_ADR.md) |
| Auction bid path, SSE, locks | Live auction risk — require staging auction test |
| Auth, sessions, cookies | Test login on staging with staging `APP_URL` |
| Environment variables | Update [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md) |
| Third-party integrations (Twilio, OAuth) | Confirm staging uses isolated keys |

### Documentation

Update docs in the same PR when you change:

- Deploy steps → `DEPLOY.md`
- Env vars → `RENDER_ENV_VARS.md`, `.env.example.example`
- Release process → `RELEASE_PROCESS.md`

---

## Environment awareness

| Environment | Git branch | Database | Config source |
|-------------|------------|----------|---------------|
| Local dev | any (from `develop`) | Dev Neon / local `.env` | `.env` |
| Staging | `develop` | Neon staging | Render staging dashboard |
| Production | `main` | Neon production | Render production dashboard |

Never use production credentials locally. See [docs/STAGING_ENVIRONMENT_AUDIT.md](./docs/STAGING_ENVIRONMENT_AUDIT.md) for isolation risks.

---

## Getting help

- **Release / deploy:** [RELEASE_PROCESS.md](./RELEASE_PROCESS.md)
- **Auction day / incidents:** [RUNBOOK.md](./RUNBOOK.md)
- **Staging sign-off:** [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- **Production sign-off:** [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- **Render configuration:** [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md)

---

## Summary

1. Branch from `develop`, PR back to `develop`.
2. Let staging auto-deploy; complete the staging checklist.
3. PR `develop` → `main` only after validation.
4. Let production auto-deploy; complete the production checklist.
5. Hotfixes branch from `main` and must be backported to `develop`.
6. `main` is protected — no direct pushes, no force push.
