# Render API Setup — BidWar Engineering Access

> Purpose: Enable Cursor agents and engineers to perform **staging operations** (deploy confirmation, restarts, log capture) without putting secrets in git.  
> Constraint: Documentation only — no application code changes.

**Related:** [DEPLOY.md](./DEPLOY.md) · [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md) · [RUNBOOK.md](./RUNBOOK.md)

---

## 1. Required Render permissions

Render does **not** currently offer granular, scoped API keys (staging-only, logs-only, etc.). A Personal API Key inherits **the same privileges as the Render user account that created it**.

### Minimum account requirements

| Requirement | Why |
|-------------|-----|
| Render account that is a **member** (or owner) of the workspace containing **BidWar Staging** | Key can only see resources that user can see |
| Ability to open **bidwar-staging** (or equivalent) in the Dashboard | Needed to list service ID, trigger deploy/restart, read logs |
| Preference: access to **staging only** if possible | Keys are broadly scoped — avoid creating keys on an account that also owns production unless you accept prod blast radius |

### Recommended role for Cursor engineering ops

- Use a Render user that can manage the **staging** web service (`develop` branch → e.g. `bidwar-staging` / `https://bidwar-staging.onrender.com`).
- For baseline boot metrics and staging restarts, **staging access is enough**.
- If the same human account also has **production** workspace access, the Personal API Key can reach production too — treat the key as **high privilege**.

### Official references

- [The Render API](https://render.com/docs/api)
- [API reference](https://api-docs.render.com/reference/introduction)
- OpenAPI: `https://api-docs.render.com/openapi/render-public-api-1.json`

---

## 2. Is a Personal API Key sufficient?

**Yes — for BidWar staging engineering operations, a Render Personal API Key is sufficient**, provided:

1. It is created by a user who already has Dashboard access to the staging service.
2. It is stored only in a secret environment (never in the repo).
3. Operators understand the key is **not** staging-scoped: it matches the creator’s full account access.

There is **no separate “service token” or “logs-only key”** today. Feature request for granular keys exists on Render’s feedback board but is not generally available as a scoped product.

---

## 3. Operations available with that key

With `Authorization: Bearer <RENDER_API_KEY>` against `https://api.render.com/v1`, an agent/engineer can typically perform the following (same surface area as the Dashboard for that account):

### Service discovery

- List services and workspaces the account can access  
- Resolve staging service ID (e.g. `srv-…`) by name/URL  
- Read service details (branch, auto-deploy, instance type, status)

### Deploys (staging)

- List recent deploys and statuses  
- Confirm whether commit `e139bc8` (or later `develop` SHAs) is live  
- Trigger a new deploy (clear cache optional)  
- Poll until deploy `live` / `failed`

### Runtime control

- **Restart** the staging service (required for repeated boot-metric sampling)  
- Observe service suspended / live state where exposed by the API

### Logs and metrics (core for database boot baseline)

- Query **service logs** with text filters (e.g. `DATABASE STARTUP SUMMARY`, `database_startup_summary`)  
- Pull time-bounded log windows after each restart  
- Fetch CPU / memory / other time-series metrics where available

### Configuration (powerful — use carefully)

- Read and update environment variables / env groups (can expose `DATABASE_URL`, secrets)  
- Manage custom domains, scaling settings, and other service settings the account may change  
- Blueprint / project / environment operations the account owns

### Audit / account

- Access audit log endpoints available to the account  
- Manage API keys themselves only via Dashboard (create/revoke) — treat revoke as mandatory on leak

### BidWar-specific workflows this unlocks

| Task | How |
|------|-----|
| Confirm staging tracks `develop` | List service → inspect `branch` / repo binding |
| Confirm observability commit is deployed | List deploys → match `commit` SHA |
| Collect 5× boot baselines | Restart ×5 → filter logs for `DATABASE STARTUP SUMMARY` |
| Staging incident triage | Tail logs, check deploy health, restart if runbook allows |

---

## 4. Operations you CANNOT perform (even with the key)

| Limitation | Detail |
|------------|--------|
| **Scope the key to staging-only** | No granular scopes; if the account can access production, so can the key |
| **Access workspaces the user is not in** | Membership still gates visibility |
| **Bypass Neon / Postgres** | Render API ≠ Neon MCP; DB schema/data still needs Neon credentials or existing app paths |
| **Push git / merge PRs** | Still requires GitHub auth; Render only deploys what is already on the connected branch |
| **Change auction/business logic** | API manages infrastructure, not application source |
| **Guaranteed real-time interactive SSH as in Dashboard** | Prefer documented REST/CLI flows; do not assume shell access into the box for baseline work |
| **Read the API key again after creation** | Render shows the full key **once**; store it immediately or create a new one |
| **Prevent env var leakage into agent context** | Calling env endpoints can pull secrets into chat/logs — avoid unless necessary |
| **Authenticate as another teammate** | Key is bound to the creating account |
| **Replace Dashboard judgment for production auction safety** | [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) still applies — never restart/deploy production during a live auction without runbook approval |
| **Make Render auto-deploy without a git push** | Trigger deploy deploys an existing commit/image; source changes still come from git |

---

## 5. Secure configuration for Cursor (no repo exposure)

### Rules (non-negotiable)

1. **Never** commit `RENDER_API_KEY` to git (not in `.env` files that are shared, not in docs, not in `RENDER_ENV_VARS.md` templates as a real value).  
2. **Never** paste a live key into a PR description, commit message, or markdown checked into the repo.  
3. Prefer a **staging-capable account**; if the account also has production, treat the key as production-capable.  
4. **Revoke immediately** in Dashboard → Account Settings → API Keys if the key appears in chat history, a screenshot, or a shared log.

### Recommended setup (Windows / Cursor)

**Option A — User environment variable (recommended for local agents)**

1. Create the key: [Render Dashboard → Account Settings → API Keys](https://dashboard.render.com/) → **Create API Key**.  
2. Copy the value once (starts with something like `rnd_…`).  
3. Set a **user-level** environment variable (not in the repo):

```powershell
# Run once in an elevated or user PowerShell — does not write into the git tree
[System.Environment]::SetEnvironmentVariable("RENDER_API_KEY", "<paste-key-here>", "User")
```

4. **Fully restart Cursor** so new user env vars are visible to the agent shell.  
5. Verify without printing the secret:

```powershell
if ($env:RENDER_API_KEY) { "RENDER_API_KEY=set (length $($env:RENDER_API_KEY.Length))" } else { "RENDER_API_KEY=unset" }
```

**Option B — Session-only for one chat**

```powershell
$env:RENDER_API_KEY = "<paste-key-here>"   # current terminal only; dies with the session
```

Use only when you will not leave the key in a long-lived shell transcript.

**Option C — Cursor / OS secret store**

- If your Cursor build supports encrypted secrets / MCP env injection for tools, store `RENDER_API_KEY` there instead of plaintext project files.  
- Do **not** add a project `.env` entry for Render API access unless that file is gitignored **and** you accept that agents may still echo it — user env is safer for shared repos.

### What belongs in the repo vs not

| In repo (OK) | Not in repo |
|--------------|-------------|
| This doc (`RENDER_API_SETUP.md`) | Real `RENDER_API_KEY` value |
| Staging URL `https://bidwar-staging.onrender.com` | Neon `DATABASE_URL` |
| Service **name** `bidwar-staging` | Production API keys |
| Instructions to set env vars | Pasted log dumps that contain secrets |

### Safe smoke test (after key is set)

```powershell
curl --request GET `
  --url "https://api.render.com/v1/services?limit=20" `
  --header "Accept: application/json" `
  --header "Authorization: Bearer $env:RENDER_API_KEY"
```

Expect HTTP `200` and a JSON list including the staging web service. Do not commit the response if it contains sensitive env metadata.

### Revocation checklist

1. Dashboard → Account Settings → API Keys → **Delete/Revoke** compromised key.  
2. Create a replacement key.  
3. Update the user env var / Cursor secret.  
4. Restart Cursor.  
5. Re-run the smoke test.

---

## 6. How agents will use the key (expected BidWar workflow)

Once `RENDER_API_KEY` is available to the agent shell:

1. `GET /v1/services` → find staging service ID.  
2. Confirm latest deploy matches `origin/develop`.  
3. `POST .../restart` (or deploy) → wait until live.  
4. `GET` logs filtered for `DATABASE STARTUP SUMMARY` / `database_startup_summary`.  
5. Repeat restarts for baseline sampling.  
6. Write observation docs (e.g. `DATABASE_BOOT_BASELINE.md`) — **no code changes**.

Agents must still follow auction/production safety rules and must not mutate production without explicit human approval.

---

## 7. Owner action required

To unblock staging boot-metric collection:

1. Create a Render **Personal API Key** (account with staging access).  
2. Set `RENDER_API_KEY` as a **User** environment variable (or Cursor secret).  
3. Restart Cursor.  
4. Reply in chat that the key is configured (do **not** paste the key into the chat).

After that, engineering ops can resume: restart staging ×5, capture real `DATABASE STARTUP SUMMARY` lines, and produce `DATABASE_BOOT_BASELINE.md`.
