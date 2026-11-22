# BidWar Diagnostics Design

> Design only — **do not implement in this document’s approval cycle**.  
> Goal: Expose startup / environment diagnostics inside the app so engineering does not depend on Render logs or a Render API key.  
> Constraints: Observability only. No SQL changes. No schema changes. No runtime behaviour changes to auctions, healers, or boot sequencing.

---

## 1. Problem

Boot metrics already exist in-process (`lib/db/src/boot-metrics.ts`) and print once to stdout. Capturing them today requires Render log access. That blocks staging baselines and makes production triage dependent on external dashboards.

**Desired outcome:** An authenticated Admin Diagnostics surface that reads **already-collected** process metrics plus safe environment identity fields.

---

## 2. Goals / non-goals

### Goals

- Admin-only UI + protected internal API  
- Show database boot timings and failure counts from the current process  
- Show build identity (commit SHA, build timestamp) and environment label  
- Show masked database host + database name (no credentials)  
- Work on Local / Staging / Production without Render-specific tooling  

### Non-goals

- Changing System C / D SQL or healer behaviour  
- Replacing versioned migrations or schema governance  
- Historical multi-restart time-series (v1 is **current process only**)  
- Exposing secrets (`DATABASE_URL`, session secrets, API keys)  
- Requiring Render API keys  
- Triggering restarts, deploys, or DDL from the Diagnostics page  

---

## 3. Recommended placement

### UI

| Item | Choice |
|------|--------|
| Route | `/admin/settings/system/diagnostics` |
| Shell | Existing `AdminShell` + `useAdminPageGuard` |
| Parent | Add a **Diagnostics** tab beside existing System Settings tabs (`admin-system-page.tsx`) |
| Page component | `admin-diagnostics-page.tsx` (or a panel inside `AdminSystemPage`) |

Rationale: Diagnostics is platform ops, not tournament ops. It fits **System Settings** next to Audit Logs / Builds.

### Auth

| Layer | Choice |
|-------|--------|
| Page | Existing admin session guard (same as other `/admin/*` pages) |
| API | `requireMasterAdmin` (**Super Admin / master** only) |

Rationale: Data-entry admins should not see infra fingerprints. Master admin matches Communication Center / sensitive platform modules.

---

## 4. Protected internal API

### Endpoint

```
GET /api/auth/admin/diagnostics/startup
```

- Middleware: JWT + `requireMasterAdmin`  
- Method: **GET only** (read-only)  
- No query params required  
- Rate limit: reuse existing admin API limiter if present; otherwise default Express stack is fine for rare ops use  

### Response shape (v1)

```json
{
  "ok": true,
  "capturedAt": "2026-07-11T13:20:00.000Z",
  "environment": "staging",
  "build": {
    "commitSha": "e139bc87b2e3c4d23831fd1958d1a011ecf9262e",
    "commitShaShort": "e139bc8",
    "buildTimestamp": "2026-07-11T12:55:10.000Z",
    "source": "render_env"
  },
  "database": {
    "hostMasked": "ep-****-****.ap-southeast-1.aws.neon.tech",
    "databaseName": "neondb",
    "sslModePresent": true
  },
  "startup": {
    "ready": true,
    "systemC": {
      "executionTimeMs": 1842,
      "queryBatches": 24,
      "failures": 0,
      "createStatements": 35,
      "alterStatements": 71,
      "createIndexStatements": 83,
      "dropStatements": 2,
      "dmlStatements": 10
    },
    "systemD": {
      "executionTimeMs": 956,
      "queryCount": 9,
      "success": true,
      "failure": false
    },
    "totalDatabaseBootTimeMs": 2104,
    "startupDdlBatches": 33,
    "startupFailures": 0
  },
  "process": {
    "uptimeSeconds": 412,
    "pid": 1234,
    "nodeEnv": "production"
  }
}
```

### Field mapping (requirements → payload)

| Requirement | Field |
|-------------|--------|
| System C execution time | `startup.systemC.executionTimeMs` |
| System D execution time | `startup.systemD.executionTimeMs` |
| Total database boot time | `startup.totalDatabaseBootTimeMs` |
| Build commit SHA | `build.commitSha` (+ short form for UI) |
| Build timestamp | `build.buildTimestamp` |
| Environment | `environment` ∈ `local` \| `staging` \| `production` \| `unknown` |
| Database host (masked) | `database.hostMasked` |
| Database name | `database.databaseName` |
| Number of startup DDL batches | `startup.startupDdlBatches` |
| Number of startup failures | `startup.startupFailures` |

### Derived counts (v1 definition)

- **`startupDdlBatches`** = System C `queryBatches` + System D `queryCount`  
  (each `pool.query` registration/execution counted as one batch; matches existing metrics, not statement-level DDL count)  
- **`startupFailures`** = System C `failures` + (`1` if System D `failure` else `0`)  

UI may also show statement breakdowns from System C as secondary detail (already in metrics); not required for the headline table.

### Error / incomplete states

| Case | HTTP | Body |
|------|------|------|
| Not authenticated | 401 | `{ error: "Not authorised" }` |
| Admin but not master | 403 | `{ error: "Super Admin access required" }` |
| Metrics not settled yet | 200 | `startup.ready: false`, nullable timing fields, message `Boot metrics still settling` |
| Metrics module unavailable | 200 | `startup.ready: false` with explicit `reason` (should be rare) |

Never return 5xx solely because System C is still settling — that is a normal early-boot race if someone hits the API milliseconds after listen.

### Forbidden response content

Must **never** include:

- Full `DATABASE_URL` / password / user  
- `SESSION_SECRET`, admin passwords, OAuth client secrets  
- Raw SQL text from healers  
- Neon connection strings  
- Redis URLs with credentials  
- Render API keys  

---

## 5. Data sources (no behaviour change)

### 5.1 Boot metrics (existing)

Reuse `lib/db/src/boot-metrics.ts`:

- Export / call `getBootMetricsSnapshot()` (already present)  
- Optionally add a thin read-only helper `getStartupDiagnostics()` that formats totals — **no new SQL**, no healer edits beyond exporting what is already stored  

Metrics remain process-local, collected during the existing import / `ensureCoreSchema` path. Diagnostics only **reads** them.

### 5.2 Environment classification

Derive `environment` without new schema:

| Label | Detection order (design) |
|-------|--------------------------|
| `local` | `NODE_ENV=development` **or** host is localhost / `127.0.0.1` **or** `APP_DOMAIN` contains `localhost` |
| `staging` | `APP_DOMAIN` / `APP_URL` contains `staging` or `bidwar-staging` (configurable allowlist) |
| `production` | Canonical prod hosts (`bidwar.in`, production Render hostname) when not staging/local |
| `unknown` | Fallback if ambiguous |

Optional later: explicit `BIDWAR_ENV=local|staging|production` env var (ops-set on Render). Design prefers detecting from existing `APP_URL` / `APP_DOMAIN` first to avoid new required config; document `BIDWAR_ENV` as an override if present.

### 5.3 Database host / name (masked)

Parse `DATABASE_URL` (or runtime config’s database URL) **in memory**:

- `databaseName` ← URL pathname (strip leading `/`)  
- `hostMasked` ← hostname with middle labels redacted, e.g.  
  - `ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech`  
  - → `ep-****-****-****.ap-southeast-1.aws.neon.tech` (keep TLD + region-ish suffix; redact project-specific labels)  
- Never return username, password, query string secrets  

`sslModePresent`: boolean only (`sslmode` query param exists), not the full query string.

### 5.4 Build commit SHA + build timestamp

Repo currently does **not** surface a commit SHA. Design options (pick one at implementation time):

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | Render-injected env | `RENDER_GIT_COMMIT`, `RENDER_GIT_COMMIT_SHA`, or documented Render build env if present at runtime |
| 2 | Build-time bake | `pnpm build:deploy` writes `artifacts/api-server/dist/build-info.json` with `{ commitSha, buildTimestamp }` from `git rev-parse` / CI | 
| 3 | Optional env | `BIDWAR_GIT_SHA`, `BIDWAR_BUILD_TIMESTAMP` set in Render dashboard |

**Design recommendation:** Prefer (2) bake at `build:deploy` so Local / Staging / Production all get the same shape even when Render env names differ. Fallback to env vars when file missing (dev).

`buildTimestamp` = ISO time when the artifact was built (UTC), not process start time.

`build.source` documents which resolution path won (`build_info_file` | `render_env` | `env_override` | `unavailable`).

---

## 6. UI design (Admin Diagnostics page)

### Layout

Single column inside System Settings → **Diagnostics**:

1. **Environment strip** — badge: Local / Staging / Production / Unknown  
2. **Build card** — short SHA (copy full SHA), build timestamp, source  
3. **Database card** — masked host, database name  
4. **Startup card** — primary metrics table  

### Primary metrics table

| Metric | Value |
|--------|--------|
| System C execution time | `{n} ms` |
| System D execution time | `{n} ms` |
| Total database boot time | `{n} ms` |
| Startup DDL batches | `{n}` |
| Startup failures | `{n}` (emphasize if &gt; 0) |

Secondary expandable: System C statement breakdown; System D success/failure; process uptime.

### Interactions (v1)

- **Refresh** button → re-GET API (same process metrics; does not re-run DDL)  
- **Copy JSON** → clipboard of API payload (still masked)  
- No restart / migrate / push buttons  

### Empty / loading

- Spinner while fetching  
- If `ready: false`: “Boot metrics still settling — refresh in a few seconds.”  
- If build SHA unavailable: show `unknown` (not an error)

---

## 7. Architecture sketch

```
┌─────────────────────────────────────────────┐
│ Admin UI  /admin/settings/system/diagnostics │
│  useAdminPageGuard + master session          │
└──────────────────┬──────────────────────────┘
                   │ GET /api/auth/admin/diagnostics/startup
                   ▼
┌─────────────────────────────────────────────┐
│ API  requireMasterAdmin                      │
│  - getBootMetricsSnapshot()                  │
│  - maskDatabaseUrl()                         │
│  - resolveBuildInfo()                        │
│  - classifyEnvironment()                     │
└──────────────────┬──────────────────────────┘
                   │ read-only
                   ▼
┌─────────────────────────────────────────────┐
│ Existing process state                       │
│  boot-metrics (C/D) · runtime-env · build-info│
└─────────────────────────────────────────────┘
```

No new tables. No new DDL. Healers unchanged.

---

## 8. Multi-instance caveat (important)

Metrics are **per Node process**. On Render with multiple instances, each instance has its own boot timings. The Diagnostics page shows the instance that handled the HTTP request.

**v1 acceptance:** Document this in the UI footer: “Metrics for this server instance only.”

**v2 (out of scope):** Aggregate via Redis or log shipping — not required for removing Render-log dependency for single-instance staging.

---

## 9. Security

| Control | Detail |
|---------|--------|
| AuthN | Admin JWT required |
| AuthZ | Master admin only |
| Data minimization | Masked host; no secrets |
| Audit | Optional: write a platform audit event `diagnostics.startup.viewed` (nice-to-have; not blocking) |
| CSRF / cookies | Same as other admin APIs |
| Public exposure | Route must not be registered without middleware; no public `/api/diagnostics` alias |

---

## 10. Implementation plan (for a later phase — not now)

Ordered, behaviour-preserving steps:

1. **Export read API on boot metrics** — ensure snapshot includes total boot ms; no SQL changes.  
2. **Add masking + env + build-info helpers** in api-server (pure functions + tests).  
3. **Bake build-info in `build:deploy`** (or wire Render env fallbacks).  
4. **Add `GET /api/auth/admin/diagnostics/startup`** with `requireMasterAdmin`.  
5. **Add Admin Diagnostics tab + page** under System Settings.  
6. **Unit tests** — masking, env classification, 401/403, ready/not-ready payload.  
7. **Manual verify** — Local admin login → page; Staging after deploy → compare with one stdout summary if available.

Explicitly **do not** in that phase: remove healers, change migrate scripts, add Render API usage, or alter boot order.

---

## 11. Testing plan

| Test | Expect |
|------|--------|
| Unauthenticated GET | 401 |
| Data-entry admin GET | 403 |
| Master admin GET after boot | 200, `ready: true`, numeric timings |
| Masking unit tests | Password never appears; host redacted |
| Env classification | localhost → local; bidwar-staging → staging; bidwar.in → production |
| Early call before C settles | 200, `ready: false` |
| Response JSON schema | No keys matching `/password|secret|DATABASE_URL/i` |

---

## 12. Success criteria

- Engineering can open **Admin → System Settings → Diagnostics** on staging/production and see the required fields **without Render logs**.  
- Restarting the service updates metrics on next boot (refresh after settle).  
- No schema/SQL/healer behaviour change.  
- No secrets in API or UI.  

---

## 13. Open decisions (resolve at implementation kickoff)

1. **`requireMasterAdmin` vs `requireAdmin`** — design recommends master; confirm with owners.  
2. **Build info bake vs Render env only** — design recommends bake + env fallback.  
3. **Optional audit log on view** — yes/no for v1.  
4. **Whether to show statement-level DDL breakdown in UI** — optional secondary panel.

---

## 14. Status

| Item | Status |
|------|--------|
| Design (`DIAGNOSTICS_DESIGN.md`) | **Complete** |
| Implementation | **Not started** (blocked on explicit approval) |
| Render API dependency | **Removed from this path** |
