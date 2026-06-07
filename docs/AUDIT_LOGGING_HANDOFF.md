# BidWar Platform Audit Logging — Complete Handoff

**Document version:** 2.0  
**Date:** 7 June 2026  
**Status:** Wave 1 + Wave 2 + Operational Monitoring complete · Wave 3 pending  
**Audience:** Next developer, Super Admin operators, dispute investigators

---

## 1. Executive summary

BidWar now has a **unified, append-only platform audit trail** (`platform_audit_events`) plus an **operational monitoring layer** for Super Admins. Critical actions require a **mandatory reason** (min 10 characters). Logs are **read-only** from API and UI — no edit or delete.

| Layer | Status |
|-------|--------|
| Schema + migration | Done (incl. monitoring columns) |
| `audit-service.ts` write pipeline | Done |
| Wave 1 routes (auth, auction, teams) | Done |
| Wave 2 routes (tournaments, players, categories, admin) | Done |
| Admin System Logs UI | Done |
| Dashboard Recent Activity Feed | Done |
| Critical event tagging | Done |
| Suspicious activity framework | Done (rules configurable later) |
| Enhanced undo audit trail | Done |
| Wave 3 (comm, sync, local, OAuth, etc.) | **Not started** |

**Related docs:**
- Discovery (pre-implementation): [AUDIT_LOGGING_DISCOVERY_REPORT.md](./AUDIT_LOGGING_DISCOVERY_REPORT.md)
- Short implementation index: [AUDIT_LOGGING_IMPLEMENTATION_SUMMARY.md](./AUDIT_LOGGING_IMPLEMENTATION_SUMMARY.md)

---

## 2. Migrate & rebuild (required before deploy)

### 2.1 Prerequisites

1. Copy `.env.example` → `.env` and set `DATABASE_URL` (or `NEON_DATABASE_URL`).
2. Install deps: `pnpm install`

### 2.2 Rebuild (TypeScript project references)

```bash
# From repo root — builds lib/db and other referenced libs
pnpm run typecheck:libs
```

**Verified in this session:** `pnpm run typecheck:libs` — **PASS**  
**Verified in this session:** `pnpm --filter @workspace/api-server run typecheck` — **PASS** (after `audit-service.ts` type fix)

### 2.3 Database migration

```bash
pnpm --filter @workspace/scripts run migrate
```

Expected output includes:
```
[migrate] applied: create_platform_audit_events
[migrate] applied: platform_audit_monitoring_columns
```

**Verified in this session:** Migration **not run** — `DATABASE_URL` missing in local `.env`.  
Runtime bootstrap in `lib/db/src/index.ts` also ensures table + columns on API server start (defensive, not a substitute for migrate in production).

### 2.4 Full verification (optional)

```bash
pnpm run typecheck          # all artifacts + scripts
pnpm run verify:local       # if local stack configured
```

### 2.5 Production deploy order

1. Deploy API with new code.
2. Run `migrate` against production DB **before** or immediately after deploy.
3. Confirm Super Admin dashboard shows Recent Activity (empty until first audited action).
4. Smoke-test one critical action with reason (e.g. licence switch in admin).

---

## 3. Database schema

### Table: `platform_audit_events`

Append-only. Application code **INSERT only** — no UPDATE/DELETE routes.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | BIGSERIAL | Primary key |
| `occurred_at` | TIMESTAMPTZ | Event time (indexed) |
| `event_category` | TEXT | auth, tournament, team, player, auction, admin, category, … |
| `event_action` | TEXT | e.g. `auction.undo`, `team.purse_updated` |
| `event_severity` | TEXT | info / warning / critical |
| `outcome` | TEXT | success / failure / denied / partial |
| `actor_type`, `actor_id`, `actor_label`, `actor_ip`, `actor_user_agent` | TEXT | Actor identity |
| `session_id` | TEXT | Reserved for future session correlation |
| `resource_type`, `resource_id` | TEXT | Primary resource |
| `tournament_id`, `team_id`, `player_id` | INTEGER | Scope filters |
| `summary` | TEXT | Human-readable one-liner |
| `reason` | TEXT | Mandatory for critical actions (≥10 chars) |
| `metadata_json` | JSONB | Extra context (undo details, config fields, etc.) |
| `before_json`, `after_json`, `changes_json` | JSONB | Snapshots + field diff |
| `related_table`, `related_id` | TEXT | Linked record (e.g. `bids`) |
| `request_id`, `request_method`, `request_path` | TEXT | HTTP provenance |
| `source` | TEXT | api / local / webhook / scheduler / mirror |
| `alert_key` | TEXT | Alert engine seed |
| `critical_tags_json` | JSONB | Operational tags array |
| `monitoring_flags_json` | JSONB | `{ flags: [...], score: number }` |
| `exportable` | BOOLEAN | CSV export gate (default true) |

### Migrations

| Label | File | What it does |
|-------|------|--------------|
| `create_platform_audit_events` | `scripts/src/migrate.ts` | Creates table + indexes |
| `platform_audit_monitoring_columns` | `scripts/src/migrate.ts` | Adds `critical_tags_json`, `monitoring_flags_json` |

**Schema source:** `lib/db/src/schema/platform_audit.ts`  
**Runtime ensure:** `lib/db/src/index.ts`

---

## 4. Backend architecture

### 4.1 Write pipeline

```
Route handler → auditLog(req, input)
  → buildRow() — actor, snapshots, changes
  → resolveCriticalTags()
  → evaluateStaticSuspicion()
  → enrichMonitoringFlagsAsync() — burst rules (DB lookups)
  → INSERT platform_audit_events (fire-and-forget)
```

| Module | Path | Role |
|--------|------|------|
| Audit service | `artifacts/api-server/src/lib/audit-service.ts` | `auditLog`, `auditDenied`, `auditLogSystem` |
| Reason validation | `artifacts/api-server/src/lib/audit-reason.ts` | `parseAuditReason`, critical patch detectors |
| Snapshots | `artifacts/api-server/src/lib/audit-snapshots.ts` | `snapshotTournament/Team/Player/Category`, `computeFieldChanges` |
| Critical tags | `artifacts/api-server/src/lib/audit-critical-tags.ts` | Action → tag mapping |
| Suspicion rules | `artifacts/api-server/src/lib/audit-suspicion.ts` | Rule registry + static evaluation |
| Async enrichment | `artifacts/api-server/src/lib/audit-enrichment.ts` | IP/tournament burst detection |

### 4.2 Read API (append-only)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/auth/admin/audit/events` | Any admin | Paginated timeline + filters |
| GET | `/auth/admin/audit/events/:id` | Any admin | Event detail |
| GET | `/auth/admin/audit/alerts` | Any admin | Warning/critical feed |
| GET | `/auth/admin/audit/feed` | Any admin | **Dashboard operational feed** |
| GET | `/auth/admin/audit/monitoring` | Master admin | Suspicion rule catalog |
| GET | `/auth/admin/audit/export` | Master admin | CSV export |
| GET | `/auth/admin/audit/meta` | Any admin | Filter metadata |

**Router:** `artifacts/api-server/src/routes/audit.ts` (mounted in `routes/index.ts`)

### 4.3 Critical tags (operational)

| Tag | Meaning |
|-----|---------|
| `purse_edit` | Manual purse change |
| `manual_sell` | Operator manual sell |
| `undo` | Auction undo |
| `re_auction` | Re-auction player(s) |
| `owner_change` | Team owner / access code |
| `license_change` | Licence grant/revoke/status |
| `tournament_config` | Auction rules / tournament settings |
| `player_critical` | Critical player field edit |
| `category_config` | Category bidding rules |
| `data_reset` | Trial/practice reset |
| `auth_failure` | Failed login |
| `access_denied` | Denied access verify |
| `admin_action` | Master admin mutations |
| `auction_control` | Start/pause/sell/undo control |
| `finance` | Purse / bid financial impact |

### 4.4 Suspicion rules (framework)

**Write-time** (`audit-suspicion.ts` — toggle `enabled` per rule):
- `auth_denied`, `access_code_denied`
- `critical_finance_no_context`, `high_value_undo` (≥ ₹50,00,000)
- `license_change`, `tournament_config_change`, `data_reset`
- `after_hours_critical`, `public_actor_critical`

**Enrichment-time** (`audit-enrichment.ts`):
- `critical_burst_ip` — 4+ critical events / 10 min / IP
- `auth_failure_burst_ip` — 5+ denied/failed / 15 min / IP
- `tournament_critical_burst` — 6+ critical / 5 min / tournament

Future: expose rule thresholds via env or admin UI using `GET /auth/admin/audit/monitoring`.

---

## 5. Routes with audit integration

### Wave 1

| File | Events |
|------|--------|
| `routes/auth.ts` | Admin + organizer login/logout/failed; licence grant/revoke/set; lock/unlock; admin tournament patch/delete; organizer link/update/delete; per-tournament organizer login/logout |
| `routes/auction.ts` | start/resume, pause, manual-sell, **undo (enhanced)**, re-auction, re-auction-all-unsold, reset-trial |
| `routes/teams.ts` | create, update (purse/owner/code), delete, access verify/deny |

### Wave 2

| File | Events |
|------|--------|
| `routes/tournaments.ts` | PATCH config (reason), DELETE |
| `routes/players.ts` | create, critical PATCH, delete, import |
| `routes/categories.ts` | create, config PATCH, delete |

---

## 6. Mandatory reason — backend + frontend

**Rule:** `parseAuditReason(body, true)` → 400 if missing or &lt; 10 chars.

| Critical action | Backend | Frontend reason UI |
|-----------------|---------|-------------------|
| Purse / owner edit | `teams.ts` PATCH | `teams.tsx` form |
| Manual sell | `auction.ts` | `auction-operator.tsx` |
| Undo | `auction.ts` | API ready; **no dedicated undo button in UI yet** |
| Re-auction | `auction.ts` | `auction-operator.tsx` (toolbar, queue, resume-restart) |
| Licence change | `auth.ts` | `admin.tsx`, `live-emergency-panel.tsx` |
| Tournament config | `tournaments.ts`, `auth.ts` admin PATCH | `tournament-settings.tsx`, **admin DetailPanel edit** |
| Player critical edit | `players.ts` | `players.tsx` |
| Category config | `categories.ts` | `categories.tsx` |
| Reset trial | `auction.ts` | `auction-reset.tsx`, admin reset dialogs |

**Shared UI components:**
- `artifacts/auction-platform/src/components/audit-reason-field.tsx`
- `artifacts/auction-platform/src/components/audit-reason-dialog.tsx`
- `artifacts/auction-platform/src/lib/audit-reason.ts` (client helpers)

---

## 7. Admin UI

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin` | `AdminRecentActivityFeed` in `admin-dashboard-overview.tsx` | Live monitoring: recent, critical, suspicious, 24h stats |
| `/admin/settings/system/audit-logs` | `system-logs-panel.tsx` | Full timeline, filters, CSV (master), tags + suspicion badges |

**Client API:** `artifacts/auction-platform/src/lib/audit-api.ts` — `fetchAuditFeed()`

---

## 8. Enhanced undo audit trail

`POST /tournaments/:id/auction/undo` now logs:

- `related`: `{ table: "bids", id }`
- `metadata`: `undoType`, `bidId`, `amount`, `purseDelta`, `purseUsedBefore/After`, `playerName`, `teamName`, `teamShortCode`, `bidTimestamp`, `saleReversed`
- `before`: player, team, bid, **session** snapshot
- `after`: player, team, bid cleared
- Tags: `undo`, `finance`, `auction_control`
- Alert key: `auction_undo`

---

## 9. Events covered vs pending

### Covered (queryable today)

**Auth:** `auth.admin_*`, `auth.organizer_*`, `auth.tournament_organizer_*`  
**Admin:** licence, lock/unlock, organizer CRUD, admin tournament patch  
**Tournament:** config update, delete  
**Team:** create, purse/owner/code, delete, access verify/deny  
**Player:** create, critical update, delete, import  
**Category:** create, config update, delete  
**Auction:** start/resume, pause, manual-sell, undo, re-auction, reset-trial  

### Pending (Wave 3+)

| Area | Examples |
|------|----------|
| Auth | Password change, Google OAuth, failed organizer-account login persistence |
| Tournament create | `POST /tournaments`, organizer portal create |
| Communications | `comm.ts` |
| Webhooks / sync | Export token, mirror, BidWar Local |
| Upload / global players | Media, global player merges |
| Sessions | `platform_audit_sessions` table (optional) |
| Undo UI | Dedicated undo button with reason in operator panel |
| Alert delivery | Email/SMS/push on `monitoring_flags_json.score` threshold |

---

## 10. Sample audit rows

### Purse edit
```json
{
  "eventAction": "team.purse_updated",
  "eventSeverity": "critical",
  "criticalTags": ["purse_edit", "finance"],
  "reason": "Correcting purse after sponsor top-up agreed offline",
  "changesJson": [{ "field": "purse", "old": 10000000, "new": 12000000 }],
  "alertKey": "purse_manual_edit"
}
```

### Undo (enhanced)
```json
{
  "eventAction": "auction.undo",
  "metadata": {
    "undoType": "last_bid_sale",
    "amount": 4500000,
    "purseDelta": -4500000,
    "playerName": "Virat K.",
    "teamName": "Delhi Capitals",
    "bidTimestamp": "2026-06-07T14:22:00.000Z"
  },
  "criticalTags": ["undo", "finance", "auction_control"],
  "monitoringFlags": { "score": 8, "flags": [{ "ruleId": "high_value_undo", "severity": "high" }] }
}
```

### Suspicious licence change
```json
{
  "eventAction": "tournament.license_status_set",
  "reason": "Payment confirmed via WhatsApp #8842",
  "criticalTags": ["license_change", "admin_action"],
  "monitoringFlags": {
    "score": 3,
    "flags": [{ "ruleId": "license_change", "label": "Licence status change", "severity": "medium" }]
  }
}
```

---

## 11. Testing checklist

- [ ] `pnpm run typecheck:libs` passes
- [ ] `pnpm --filter @workspace/api-server run typecheck` passes
- [ ] `pnpm --filter @workspace/scripts run migrate` against DB with `DATABASE_URL` set
- [ ] Super Admin login → `/admin` shows Recent Activity feed
- [ ] Perform manual sell with reason → event appears with `manual_sell` tag
- [ ] Edit team purse without reason → API 400
- [ ] Admin tournament edit config without reason → blocked in UI + API 400
- [ ] `/admin/settings/system/audit-logs` — expand event shows reason, changes, suspicion flags
- [ ] Master admin CSV export works
- [ ] `GET /auth/admin/audit/feed` returns stats + tag breakdown
- [ ] Confirm no PATCH/DELETE audit endpoints exist

---

## 12. File index (quick reference)

```
lib/db/src/schema/platform_audit.ts
lib/db/src/index.ts
scripts/src/migrate.ts

artifacts/api-server/src/lib/audit-service.ts
artifacts/api-server/src/lib/audit-reason.ts
artifacts/api-server/src/lib/audit-snapshots.ts
artifacts/api-server/src/lib/audit-critical-tags.ts
artifacts/api-server/src/lib/audit-suspicion.ts
artifacts/api-server/src/lib/audit-enrichment.ts
artifacts/api-server/src/routes/audit.ts

artifacts/auction-platform/src/lib/audit-api.ts
artifacts/auction-platform/src/lib/audit-reason.ts
artifacts/auction-platform/src/components/audit-reason-field.tsx
artifacts/auction-platform/src/components/audit-reason-dialog.tsx
artifacts/auction-platform/src/components/admin/admin-recent-activity-feed.tsx
artifacts/auction-platform/src/components/admin/system-logs-panel.tsx
artifacts/auction-platform/src/pages/admin-dashboard-overview.tsx
artifacts/auction-platform/src/pages/admin-system-page.tsx
```

---

## 13. Design guarantees (do not break)

1. **Append-only** — never add UPDATE/DELETE for `platform_audit_events`.
2. **Fire-and-forget writes** — audit failure must not block user requests.
3. **Reason on critical paths** — keep backend `parseAuditReason(..., true)` even if UI adds new callers.
4. **Tags + flags at write time** — dashboard reads pre-computed data; avoid heavy analysis on every page load.
5. **Future alert engine** — subscribe to `alert_key`, `event_severity`, `monitoring_flags_json.score`.

---

## 14. Session changelog (this conversation)

| Step | What changed |
|------|--------------|
| Discovery | Full codebase audit → `AUDIT_LOGGING_DISCOVERY_REPORT.md` |
| Wave 1–2 | Table, service, routes, System Logs UI, reason on critical endpoints |
| Monitoring | Dashboard feed, critical tags, suspicion framework, enhanced undo |
| Admin config reason | DetailPanel edit + `updateAdminTournament` sends `reason` |
| Build fix | `audit-service.ts` explicit `AuditRowDraft` type (TS7023) |
| Rebuild | `typecheck:libs` + api-server typecheck **verified PASS** |
| Migrate | **Blocked locally** — set `DATABASE_URL` in `.env` and run migrate |

---

*End of handoff. For dispute investigation at scale, start with `tournamentId` + time range on `/auth/admin/audit/events`, then drill into `before_json` / `after_json` / `reason` on critical events.*
