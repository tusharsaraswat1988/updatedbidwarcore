# Platform Audit Logging — Implementation Summary

**Date:** 7 June 2026  
**Status:** Wave 1 + Wave 2 + Operational Monitoring complete. Wave 3+ pending.

> **Full handoff (migrate, rebuild, file index, testing):** see [AUDIT_LOGGING_HANDOFF.md](./AUDIT_LOGGING_HANDOFF.md)

---

## Database migration summary

### Table: `platform_audit_events`

Append-only investigation index. No UPDATE/DELETE routes or UI.

| Column | Purpose |
|--------|---------|
| `id` | BIGSERIAL primary key |
| `occurred_at` | Event timestamp (indexed) |
| `event_category` | Domain: auth, tournament, team, player, auction, admin, category, … |
| `event_action` | Verb e.g. `auction.undo`, `team.purse_updated` |
| `event_severity` | info / warning / critical |
| `outcome` | success / failure / denied / partial |
| `actor_type`, `actor_id`, `actor_label`, `actor_ip`, `actor_user_agent` | Who did it |
| `resource_type`, `resource_id` | Primary resource |
| `tournament_id`, `team_id`, `player_id` | Scope for timeline filters |
| `summary` | Human-readable one-liner |
| `reason` | Mandatory text for critical actions (min 10 chars) |
| `before_json`, `after_json`, `changes_json` | Snapshots + field diff |
| `metadata_json` | Extra context |
| `alert_key` | Alert engine seed |
| `critical_tags_json` | Operational tags (purse_edit, undo, etc.) |
| `monitoring_flags_json` | Suspicion score + rule hits |
| `exportable` | CSV export gate (default true) |
| `request_method`, `request_path`, `source` | Request provenance |

### Indexes

- `(tournament_id, occurred_at DESC)`
- `(actor_type, actor_id, occurred_at DESC)`
- `(resource_type, resource_id, occurred_at DESC)`
- `(event_category, event_action, occurred_at DESC)`
- `(occurred_at DESC)`
- `(alert_key, occurred_at DESC)` partial
- `(event_severity, occurred_at DESC)`

### How to apply

```bash
# 1. Set DATABASE_URL in .env (see .env.example)
# 2. Rebuild libs
pnpm run typecheck:libs

# 3. Run migrations
pnpm --filter @workspace/scripts run migrate
```

Runtime bootstrap in `lib/db/src/index.ts` also ensures table + columns exist on API start.

**Files:** `lib/db/src/schema/platform_audit.ts`, `scripts/src/migrate.ts`, `lib/db/src/index.ts`

---

## Routes integrated

### Read API (append-only — no write/delete)

| Method | Path | Access |
|--------|------|--------|
| GET | `/auth/admin/audit/events` | Any admin — paginated timeline |
| GET | `/auth/admin/audit/events/:id` | Any admin — detail |
| GET | `/auth/admin/audit/alerts` | Any admin — warning/critical feed |
| GET | `/auth/admin/audit/export` | Master admin — CSV |
| GET | `/auth/admin/audit/feed` | Any admin — dashboard monitoring feed |
| GET | `/auth/admin/audit/monitoring` | Master admin — suspicion rule catalog |
| GET | `/auth/admin/audit/meta` | Any admin — filter metadata |

### Write integrations (fire-and-forget `auditLog()`)

| Route file | Endpoints with audit |
|------------|---------------------|
| `auth.ts` | Admin login/logout/failed; organizer account login/logout; per-tournament organizer login/logout/failed; grant/revoke/set-license; lock/unlock; admin tournament patch/delete; organizer link/update/delete |
| `auction.ts` | start/resume, pause, manual-sell, undo, re-auction, re-auction-all-unsold, reset-trial |
| `teams.ts` | create, update (purse/owner/code), delete, access verify/deny |
| `tournaments.ts` | PATCH (config), DELETE |
| `players.ts` | create, PATCH (critical), delete, import |
| `categories.ts` | create, PATCH (config), delete |

### Admin UI

| Path | Component |
|------|-----------|
| `/admin` | `AdminRecentActivityFeed` — recent, critical, suspicious, 24h stats |
| `/admin/settings/system/audit-logs` | `SystemLogsPanel` — filters, tags, suspicion flags, CSV export (master) |

### Frontend reason capture (critical actions)

| UI | Reason required when |
|----|---------------------|
| Auction operator | Manual sell, re-auction (toolbar, queue, resume-restart), batch re-auction unsold |
| Teams | Purse/owner edits, regenerate access code |
| Tournament settings | Any save (auction config fields always sent) |
| Players | Edit existing player |
| Categories | Edit category bidding rules |
| Auction reset page | Clear practice data |
| Admin licence controls | Switch trial/live, end auction |
| Admin reset dialogs | Super-admin auction data reset |
| Admin tournament edit | Auction config fields in DetailPanel |

---

## Events covered

### Auth
- `auth.admin_login`, `auth.admin_login_failed`, `auth.admin_logout`
- `auth.organizer_login`, `auth.organizer_logout`
- `auth.tournament_organizer_login`, `auth.tournament_organizer_login_failed`, `auth.tournament_organizer_logout`

### Admin / licence
- `tournament.license_granted`, `tournament.license_revoked`, `tournament.license_status_set`
- `tournament.locked`, `tournament.unlocked`
- `tournament.admin_deleted`, `tournament.admin_updated`, `tournament.organizer_linked`
- `admin.organizer_updated`, `admin.organizer_suspended`, `admin.organizer_deleted`

### Tournament
- `tournament.config_updated`, `tournament.updated`, `tournament.deleted`

### Team
- `team.created`, `team.updated`, `team.purse_updated`, `team.owner_changed`, `team.access_code_regenerated`
- `team.deleted`, `team.access_code_verified`, `team.access_code_denied`

### Player
- `player.created`, `player.updated`, `player.deleted`, `player.imported`

### Category
- `category.created`, `category.updated`, `category.config_updated`, `category.deleted`

### Auction
- `auction.started`, `auction.resumed`, `auction.paused`
- `auction.manual_sell`, `auction.undo`, `auction.reauction`, `auction.reauction_all_unsold`
- `auction.reset_trial`

---

## Events still pending (Wave 3+)

| Area | Examples |
|------|----------|
| Auth gaps | Password change, Google OAuth, OTP signup completion, failed organizer-account login persistence |
| Tournament create | `POST /tournaments`, organizer portal create |
| Communications | `comm.ts` — blast, template edits, consent |
| Webhooks / sync | Export token sync, mirror, bidwar-local operator pin actions |
| Upload / global players | Media uploads, global player merges |
| Finance | Purse reconciliation jobs (if added) |
| Sessions table | Optional `platform_audit_sessions` for login session correlation |
| BidWar Local parity | Mirror critical actions from Electron/local API |
| Undo in operator UI | Backend requires reason; dedicated undo button not yet wired (re-auction covers last sale) |
| Alert delivery | Email/SMS on suspicion score — framework only, no notifications yet |

---

## Sample audit entries

### Purse edit (critical + reason + snapshots)

```json
{
  "eventCategory": "team",
  "eventAction": "team.purse_updated",
  "eventSeverity": "critical",
  "outcome": "success",
  "actorType": "tournament_organizer",
  "actorLabel": "Tournament 42 Organizer",
  "tournamentId": 42,
  "teamId": 7,
  "summary": "Team \"Mumbai Hawks\" purse updated to ₹1,20,00,000",
  "reason": "Correcting purse after sponsor top-up agreed offline",
  "beforeJson": { "purse": 10000000, "purseUsed": 3500000 },
  "afterJson": { "purse": 12000000, "purseUsed": 3500000 },
  "changesJson": [{ "field": "purse", "old": 10000000, "new": 12000000 }],
  "alertKey": "purse_manual_edit",
  "exportable": true
}
```

### Manual sell (auction critical)

```json
{
  "eventCategory": "auction",
  "eventAction": "auction.manual_sell",
  "eventSeverity": "critical",
  "tournamentId": 42,
  "playerId": 156,
  "teamId": 3,
  "summary": "Manual sell: Virat K. → Delhi Capitals for ₹45,00,000",
  "reason": "Owner phone disconnected; verbal agreement recorded on floor",
  "beforeJson": { "player": { "status": "available" }, "team": { "purseUsed": 2000000 } },
  "afterJson": { "player": { "status": "sold", "soldPrice": 4500000 }, "team": { "purseUsed": 6500000 } },
  "alertKey": "auction_manual_sell"
}
```

### Licence change (admin)

```json
{
  "eventCategory": "admin",
  "eventAction": "tournament.license_status_set",
  "eventSeverity": "critical",
  "actorType": "master_admin",
  "tournamentId": 42,
  "summary": "License status set to \"active\" for tournament \"Corporate Cup 2026\"",
  "reason": "Payment confirmed via WhatsApp screenshot #8842",
  "beforeJson": { "licenseStatus": "trial" },
  "afterJson": { "licenseStatus": "active", "licenseGrantedAt": "2026-06-07T10:30:00.000Z" },
  "alertKey": "license_granted"
}
```

### Denied team access (security)

```json
{
  "eventCategory": "team",
  "eventAction": "team.access_code_denied",
  "eventSeverity": "warning",
  "outcome": "denied",
  "actorType": "public",
  "tournamentId": 42,
  "teamId": 5,
  "summary": "Failed team owner access code verification",
  "actorIp": "103.21.44.12"
}
```

---

## Design notes for future features

- **Timeline:** Filter by `tournamentId` + `occurredAt` (index ready).
- **Global feed:** Query `alert_key IS NOT NULL` or `event_severity IN ('warning','critical')`.
- **Alert engine:** Subscribe to `alert_key` values already stamped on high-risk events.
- **CSV export:** `GET /auth/admin/audit/export` respects `exportable = true`; master admin only.

**Append-only guarantee:** No PATCH/DELETE on `platform_audit_events`; UI shows read-only notice.
