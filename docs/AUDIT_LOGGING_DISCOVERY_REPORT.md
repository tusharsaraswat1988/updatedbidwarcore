# BidWar Audit Logging — Discovery & Implementation Plan

**Document version:** 1.0  
**Date:** 7 June 2026  
**Status:** Discovery complete — awaiting implementation approval  
**Scope:** Full codebase audit (`artifacts/api-server`, `artifacts/bidwar-local`, `lib/db`, frontend apps)

---

## Executive Summary

BidWar has **domain-specific logging** (auction intelligence, communications, notifications, player imports) but **no unified platform audit trail**. Authorization is JWT claim–based with per-resource secrets — there is no RBAC enum or permissions table.

| Area | Current State |
|------|---------------|
| Auction behavior | Strong — 3 append-only tables (`auction_bid_events`, `auction_player_events`, `auction_timer_events`) |
| Communications | Strong — `comm_logs`, `wa_consent_events`, `otp_sessions` |
| Auth / admin / CRUD | Weak — Pino HTTP logs only; no queryable login or mutation audit |
| Finance / purse | Partial — `bids` ledger + auction events; no audit when purse is manually edited |
| Legal commitment | Terms promise bid history, operator activity, login timestamps, IP records — only partially met |

---

## 1. User Roles Found

### Platform authentication roles (JWT `bidwar_auth`)

| Role | Claim / Mechanism | Definition |
|------|-------------------|------------|
| **Master Admin** | `isAdmin: true`, `adminLevel: "master"` | `ADMIN_PASSWORD` — full destructive access |
| **Data Entry Admin** | `isAdmin: true`, `adminLevel: "data_entry"` | `ADMIN_DATA_PASSWORD` — limited write (no license grant, comm blast, reports export) |
| **Organizer Account** | `organizerAccountId: number` | Self-service portal (`organizers` table); license: `pending` / `active` / `suspended` |
| **Per-Tournament Organizer** | `organizer[tournamentId]: true` | Tournament password, admin grant, or account auto-link |

**Source:** `artifacts/api-server/src/lib/jwt.ts`, `middleware/require-organizer.ts`

### Operational personas (no JWT role enum)

| Persona | Auth Mechanism | Notes |
|---------|----------------|-------|
| **Auction Operator** | Same as Organizer or Admin in UI | Not a separate JWT role; runs operator panel |
| **Team Owner** | Team `accessCode` + `sessionStorage` | `POST .../teams/:teamId/verify-access`; bids via `accessCode` in body |
| **Public Viewer** | Optional `auctionCode` gate | `sessionStorage`; no account |
| **Player (self-register)** | Public when registration open | `POST .../register` — immediate insert, no approval |
| **Local Operator** | `X-Operator-Pin` header | BidWar Local / Electron only |
| **Cloud sync client** | `X-Export-Token` | One-time sync + mirror |
| **Seed / demo** | `X-Seed-Key` = admin password | `POST /seed/demo` |

### License / gate statuses (not user roles, but affect permissions)

| Entity | Status Values |
|--------|---------------|
| Tournament | `trial` / `active` / `completed` (+ `adminLocked`) |
| Organizer account | `pending` / `active` / `suspended` |

### Domain data labeled “role” (not auth)

| Type | Values | Purpose |
|------|--------|---------|
| Sport roles | Per sport in `sport_roles` | Player position (Batsman, etc.) |
| Player tags | `captain`, `vice_captain`, `owner`, `co_owner`, `booster`, `icon`, `star_player` | Cosmetic |
| Player status | `available`, `sold`, `unsold`, `retained` | Auction state |
| Comm recipient | `player`, `team_owner`, `organizer`, `manual` | Messaging |

### Legal / marketing roles (terms only — not implemented in code)

Terms mention: **Super Admin, Tournament Organizer, Auction Operator, Team Owner, Viewer, Reseller, Subaccounts**. Only the first four exist in code; Reseller/Subaccounts have no backend implementation.

---

## 2. Critical Events Inventory

Grouped by module. **Exists** = dedicated persistent log today. **Gap** = action exists but no audit trail.

### Authentication

| Event | Route / Trigger | Actor | Logged Today? |
|-------|-----------------|-------|---------------|
| Admin login | `POST /auth/admin/login` | Master / Data Entry | **Gap** (Pino only) |
| Admin logout | `POST /auth/admin/logout` | Admin | **Gap** |
| Organizer account login | `POST /auth/organizer-account/login` | Organizer | **Gap** (login guard is in-memory) |
| Organizer account logout | `POST /auth/organizer-account/logout` | Organizer | **Gap** |
| Organizer account signup (OTP) | `POST .../signup/send-otp`, `.../verify` | Public | Partial (`otp_sessions`) |
| Password reset OTP | `POST .../otp/send`, `.../verify` | Organizer | Partial (`otp_sessions`) |
| Password change | `POST .../change-password`, `.../set-password` | Organizer | **Gap** |
| Google OAuth start/complete | `GET /auth/google`, `/callback` | Public | **Gap** |
| Google complete-profile OTP | `POST .../complete-profile/*` | Public | Partial (`otp_sessions`) |
| Per-tournament organizer login | `POST /auth/organizer/:tid/login` | Organizer / Admin | **Gap** |
| Per-tournament organizer logout | `POST /auth/organizer/:tid/logout` | Organizer | **Gap** |
| Tournament password change | `PATCH /auth/organizer/:tid/password` | Tournament organizer | **Gap** |
| Team owner access verify | `POST .../teams/:teamId/verify-access` | Team owner | **Gap** |
| Owner onboarding lookup | `POST /owner/onboarding/lookup` | Public | **Gap** (rate-limited only) |
| Failed login / captcha / cooldown | Login attempt guard | Any | **Gap** (not persisted) |

### Tournament

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Create tournament (API) | `POST /tournaments` | Account or Admin | **Gap** |
| Create tournament (portal) | `POST /auth/organizer-account/tournaments` | Organizer account | **Gap** |
| Create tournament (admin) | `POST /auth/admin/tournaments` | Any Admin | **Gap** |
| Update tournament settings | `PATCH /tournaments/:tid` | Organizer or Admin | **Gap** |
| Admin update tournament | `PATCH /auth/admin/tournaments/:tid` | Any Admin | **Gap** |
| Delete tournament | `DELETE /tournaments/:tid`, `DELETE /auth/admin/tournaments/:tid` | Organizer or Admin / Admin | **Gap** |
| Link organizer | `POST /auth/admin/tournaments/:tid/link-organizer` | Any Admin | **Gap** |
| Grant license | `POST .../grant-license` | Master Admin | Partial (`licenseGrantedBy` on row) |
| Revoke license | `POST .../revoke-license` | Master Admin | **Gap** |
| Set license status | `POST .../set-license-status` | Master Admin | **Gap** |
| Lock tournament | `POST .../lock` | Any Admin | Partial (`adminLockedAt`) |
| Unlock tournament | `POST .../unlock` | Any Admin | **Gap** |
| Open/close registration | `PATCH` with `registrationDeadline` / `registrationLimit` | Organizer or Admin | **Gap** |
| Export for local mode | `GET /tournaments/:tid/export` | Organizer / Admin | Partial (token fields on tournament row) |
| Sync local → cloud | `POST /tournaments/:tid/sync` | Export token | Partial (`exportTokenSyncedAt`; Pino warnings) |
| Share viewer link | `POST .../share-viewer-link` | Organizer / Admin | Partial (`comm_logs` if SMS sent) |
| Reset trial auction | `POST .../auction/reset-trial` | Password-based | Partial (`lastResetBy`, `resetCount`) |

**Note:** No player/team registration **approve/reject** flows exist. Registration is gated by deadline/limit only.

### Categories

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Create category | `POST .../categories` | Organizer or Admin | **Gap** |
| Update category | `PATCH .../categories/:id` | Organizer or Admin | **Gap** |
| Delete category | `DELETE .../categories/:id` | Organizer or Admin | **Gap** |

### Teams

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Create team | `POST .../teams` | Organizer or Admin | **Gap** |
| Update team (name, owner, purse, bidding) | `PATCH .../teams/:id` | Organizer or Admin | **Gap** |
| Regenerate access code | `PATCH` with `regenerateCode: true` | Organizer or Admin | **Gap** |
| Enable/disable bidding | `PATCH` with `isBiddingEnabled` | Organizer or Admin | **Gap** |
| Delete team | `DELETE .../teams/:id` | Organizer or Admin | **Gap** |
| Verify owner access | `POST .../verify-access` | Public | **Gap** |
| Owner SMS on create | Side effect | System | Partial (`comm_logs`) |

### Players

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Add player (organizer) | `POST .../players` | Organizer or Admin | **Gap** |
| Public self-register | `POST .../register` | Public | Partial (consent → `wa_consent_events`) |
| Bulk create | `POST .../players/bulk` | Organizer or Admin | **Gap** |
| Import from tournament | `POST .../import-players` | Organizer or Admin | Partial (`player_import_logs` — count only) |
| Edit player | `PATCH .../players/:id` | Organizer or Admin | **Gap** |
| Set retained / assign team | `PATCH` with `status`, `teamId`, `retainedPrice` | Organizer or Admin | **Gap** |
| Delete player | `DELETE .../players/:id` | Organizer or Admin | **Gap** |
| Global player upsert | `POST /global-players` | **Unauthenticated** | **Gap** |

### Auction

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Start / resume | `POST .../auction/start` | Organizer or Admin | **Gap** (session state only) |
| Pause | `POST .../auction/pause` | Organizer or Admin | **Gap** |
| Next player | `POST .../auction/next-player` | Organizer or Admin | Partial (`auction_player_events` in_progress) |
| Place bid | `POST .../auction/bid` | Team owner / Organizer / Admin | **Exists** (`auction_bid_events`) — no actor identity |
| Sell | `POST .../auction/sell` | Organizer or Admin | Partial (player event + `bids` row) |
| Manual sell | `POST .../auction/manual-sell` | Organizer or Admin | Partial (`isManualBid` flag) |
| Mark unsold | `POST .../auction/unsold` | Organizer or Admin | **Exists** (`auction_player_events`) |
| Re-auction player | `POST .../auction/re-auction` | Organizer or Admin | **Gap** |
| Re-auction all unsold | `POST .../auction/re-auction-unsold` | Organizer or Admin | **Gap** |
| Defer player | `POST .../auction/defer-player` | Organizer or Admin | **Exists** (outcome `deferred`) |
| Undo last sold | `POST .../auction/undo` | Organizer or Admin | **Gap** — high dispute risk |
| Start/stop/extend timer | `POST .../start-timer`, `/stop-timer` | Organizer or Admin | **Exists** (`auction_timer_events`) |
| Break timer | `POST .../break-timer` | Organizer or Admin | **Gap** |
| Pre-auction countdown | `POST .../pre-auction-countdown` | Organizer or Admin | **Gap** |
| Display overlay / filter | `POST .../display-overlay`, `/display-player-filter` | Organizer or Admin | **Gap** |
| Fortune wheel | `POST .../auction/fortune-wheel` | Organizer or Admin | **Gap** |
| Category filter | `POST .../category-filter` | Organizer or Admin | **Gap** |
| Mirror from local | `POST .../auction/mirror` | Export token | Partial (`exportTokenLastMirrorAt`) |
| Audience cheer | `POST .../cheer` | Public | **Gap** |

### Finance / Purse

| Event | Trigger | Logged Today? |
|-------|---------|---------------|
| Purse spend on sell | `auction/sell`, `manual-sell` | Partial (`bids` + `teams.purseUsed`) |
| Purse revert on undo | `auction/undo` | **Gap** |
| Purse revert on re-auction | `auction/re-auction` | **Gap** |
| Manual purse edit | `PATCH .../teams/:id` with `purse` | **Gap** — critical |
| Trial reset purse | `auction/reset-trial` | Partial (`lastResetBy`) |
| Retained player purse recalc | `PATCH .../players/:id` | **Gap** |

**No payment gateway integration** — license is admin-driven, not webhook-driven.

### Organizer accounts (admin)

| Event | Route | Actor | Logged Today? |
|-------|-------|-------|---------------|
| Update organizer (suspend, limits) | `PATCH /auth/admin/organizers/:id` | Any Admin | **Gap** |
| Delete organizer | `DELETE /auth/admin/organizers/:id` | Any Admin | **Gap** |
| Profile update | `PATCH /auth/organizer-account/profile` | Self | **Gap** |

### Communications & consent

| Event | Logged Today? |
|-------|---------------|
| Send blast | **Exists** (`comm_logs`) |
| Consent declare (single/bulk) | Partial (`wa_consent_events`) |
| WA YES / OTP / decline | **Exists** (`wa_consent_events`) |
| Web checkbox consent | **Exists** (`wa_consent_events`) |
| Template CRUD | **Gap** |
| SMS settings | **Gap** |

### Admin / system configuration

| Event | Route | Logged Today? |
|-------|-------|---------------|
| Branding update | `PUT /auth/admin/branding` | **Gap** |
| Showcase events CRUD | `/auth/admin/showcase-events*` | **Gap** |
| Display auctions CRUD | `/auth/admin/display-auctions*` | **Gap** |
| Sports catalog CRUD | `/auth/admin/sports*` | **Gap** |
| Installer URL / builds | `/auth/admin/settings/*`, `/builds/*` | **Gap** |
| Admin reports export | `/auth/admin/reports/*/export` | **Gap** |
| Demo seed | `POST /seed/demo` | **Gap** |
| File upload | `POST /upload/*` | **Gap** (unauthenticated) |
| Intelligence queries | `GET /intelligence/*` | **Gap** (no server auth) |

### Existing logging infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT LOGGING LAYER                     │
├─────────────────────────────────────────────────────────────┤
│ Pino HTTP logs (all requests, redacts cookies)                │
│ auction_bid_events / auction_player_events / auction_timer   │
│ comm_logs / wa_consent_events / otp_sessions                 │
│ notification_logs / player_import_logs (minimal)             │
│ bids (financial ledger, not audit)                           │
│ Tournament metadata: licenseGrantedBy, lastResetBy, etc.     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    NO UNIFIED audit_logs TABLE
```

**Key schema files:**

- `lib/db/src/schema/auction_events.ts` — auction intelligence tables
- `lib/db/src/schema/comm.ts` — comm + consent audit
- `lib/db/src/schema/player_import_logs.ts` — import count only
- `artifacts/api-server/src/lib/auction-logger.ts` — fire-and-forget auction logger

---

## 3. High-Risk Actions (require before/after snapshots)

| Priority | Action | Why | Current Coverage |
|----------|--------|-----|------------------|
| P0 | Manual purse edit (`PATCH teams.purse`) | Direct financial dispute | None |
| P0 | Auction undo | Reverses sale + purse + player status | Bid/player events only; no undo record |
| P0 | Manual sell | Operator overrides highest bidder | `isManualBid` only |
| P0 | Re-auction sold player | Reverses financial state | None unified |
| P0 | Trial reset | Mass state wipe | `lastResetBy` only |
| P0 | Tournament config change (bid tiers, timers, basePurse, minBid) | Changes auction rules mid-event | None |
| P1 | Team owner change | Identity / bidding authority | None |
| P1 | Access code regenerate | Old codes may still work until invalidated | None |
| P1 | Player edit (status, teamId, retainedPrice, mobile) | Roster integrity | None |
| P1 | Category create/update/delete | Affects bidding rules per category | None |
| P1 | License grant/revoke/lock | Platform access control | Partial metadata |
| P1 | Organizer suspend | Blocks all tournaments for account | None |
| P1 | Cloud sync (`/sync`) | One-time irreversible merge | Timestamp only |
| P2 | Bulk player import / bulk create | Mass data mutation | Count only |
| P2 | Delete tournament / team / player | Destructive | None |
| P2 | Global player upsert (unauthenticated) | Cross-tournament data pollution | None |

---

## 4. Recommended Audit Schema

### Core table: `platform_audit_events`

Append-only investigation layer. Existing domain tables remain for analytics; this table is the **actor + intent + context** index.

```sql
CREATE TABLE platform_audit_events (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Classification
  event_category  TEXT NOT NULL,   -- auth|tournament|team|player|auction|finance|admin|comm|sync|security
  event_action    TEXT NOT NULL,   -- e.g. 'team.purse_updated', 'auction.undo'
  event_severity  TEXT NOT NULL DEFAULT 'info',  -- info|warning|critical
  outcome         TEXT NOT NULL DEFAULT 'success', -- success|failure|denied|partial

  -- Actor (who did it)
  actor_type      TEXT NOT NULL,   -- master_admin|data_entry_admin|organizer_account|
                                   -- tournament_organizer|team_owner|system|export_token|public
  actor_id        TEXT,
  actor_label     TEXT,
  actor_ip        INET,
  actor_user_agent TEXT,
  session_id      TEXT,

  -- Resource (what was affected)
  resource_type   TEXT,
  resource_id     TEXT,
  tournament_id   INTEGER,
  team_id         INTEGER,
  player_id       INTEGER,

  -- Investigation payload
  summary         TEXT NOT NULL,
  metadata_json   JSONB,
  before_json     JSONB,
  after_json      JSONB,
  changes_json    JSONB,           -- [{field, old, new}]

  -- Linkage to existing domain logs
  related_table   TEXT,
  related_id      BIGINT,

  -- Request context
  request_id      TEXT,
  request_method  TEXT,
  request_path    TEXT,
  source          TEXT NOT NULL DEFAULT 'api',  -- api|local|webhook|scheduler|mirror

  -- Alerts / export
  alert_key       TEXT,
  exportable      BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Supporting tables (phase 2)

| Table | Purpose |
|-------|---------|
| `platform_audit_sessions` | Login session lifecycle |
| `platform_audit_alert_rules` | Configurable thresholds |
| `platform_audit_exports` | CSV/PDF export job tracking |

### Indexes

```sql
CREATE INDEX ix_audit_tournament_time ON platform_audit_events (tournament_id, occurred_at DESC);
CREATE INDEX ix_audit_actor_time ON platform_audit_events (actor_type, actor_id, occurred_at DESC);
CREATE INDEX ix_audit_resource ON platform_audit_events (resource_type, resource_id, occurred_at DESC);
CREATE INDEX ix_audit_auth ON platform_audit_events (event_category, event_action, occurred_at DESC)
  WHERE event_category = 'auth';
CREATE INDEX ix_audit_alerts ON platform_audit_events (alert_key, occurred_at DESC)
  WHERE alert_key IS NOT NULL;
CREATE INDEX ix_audit_metadata ON platform_audit_events USING GIN (metadata_json);
CREATE INDEX ix_audit_changes ON platform_audit_events USING GIN (changes_json);
-- Partition BY RANGE (occurred_at) monthly when >50M rows
```

### Event naming convention

`{domain}.{verb}` — e.g. `auction.bid_placed`, `team.purse_updated`, `auth.login_failed`.

### Relationship to existing tables

| Existing Table | Role |
|----------------|------|
| `auction_bid_events` | Behavioral detail; link via `related_table` |
| `auction_player_events` | Player auction lifecycle |
| `auction_timer_events` | Timer detail |
| `comm_logs` | Message delivery |
| `wa_consent_events` | Consent legal trail |
| `bids` | Financial ledger (not replaced) |
| `platform_audit_events` | **Who did what, when, why** |

---

## 5. Implementation Plan (awaiting approval)

### Architecture

```
Route handler → auditService.log() (fire-and-forget) → platform_audit_events
                      │
              Actor resolver ← req.jwtUser, accessCode, export token
              Snapshot diff  ← before/after for high-risk
              Alert evaluator
```

### Service layer

**File:** `artifacts/api-server/src/lib/audit-service.ts`

- `auditLog(req, input)` — fire-and-forget (same contract as `auction-logger.ts`)
- `auditLogSystem(input)` — webhooks, scheduler
- `resolveActor(req)` — JWT, team access code, export token, public
- `computeChanges(before, after)` — field-level diff

### Integration waves

| Wave | Routes | Pattern |
|------|--------|---------|
| **Wave 1** | `auth.ts`, `auction.ts` (undo, manual-sell), `teams.ts` (purse, owner) | Manual `auditLog()` after mutation |
| **Wave 2** | `tournaments.ts`, `players.ts`, `categories.ts`, admin routes | Before/after on PATCH |
| **Wave 3** | `comm.ts`, `webhooks.ts`, sync/mirror, `global-players.ts` | System actor + linkage |
| **Wave 4** | `bidwar-local` | `source: 'local'` with operator PIN actor |

### Read APIs (Super Admin)

| Endpoint | Purpose |
|----------|---------|
| `GET /auth/admin/audit/events` | Filtered timeline |
| `GET /auth/admin/audit/events/:id` | Full event with before/after |
| `GET /auth/admin/audit/export` | CSV/JSON export (Master Admin) |
| `GET /auth/admin/audit/alerts` | Recent critical events |

### Local / cloud parity

- BidWar Local writes to SQLite `platform_audit_events`
- Cloud sync includes audit batch in `/sync` payload
- Mirror events tagged `source: 'mirror'`

---

## 6. Super Admin at Scale: Disputes & Investigation

### Common disputes (1000+ tournaments)

| Dispute | Information Needed | Required Audit Events |
|---------|-------------------|----------------------|
| Wrong team won bid | Bid sequence, timer, access code, IP | `auction.bid_placed` + actor identity |
| Operator sold to wrong team | Manual sell params, operator, prior highest bid | `auction.manual_sell` with before/after |
| Undo was unfair | Who triggered, purse/player before/after | `auction.undo` with full snapshot |
| Purse doesn't match | Every purse mutation with running balance | `finance.purse_updated` chain |
| Player retained illegally | Retained assignment history | `player.retained_set` |
| Registration closed early | Deadline/limit change history | `tournament.registration_config_changed` |
| Duplicate player / wrong mobile | Create/edit/import trail | `player.created`, `player.updated`, `player.imported` |
| Team owner changed | Owner history, access code regen | `team.owner_changed`, `team.access_code_regenerated` |
| Rules changed mid-auction | Tournament PATCH diff vs auction start | `tournament.config_updated` (critical) |
| License revoked mid-event | License change actor + reason | `tournament.license_revoked` |
| Local vs cloud differ | Sync/mirror timestamps, replay rejection | `sync.completed`, `sync.replay_rejected` |
| Unauthorized admin action | Admin level, IP, session | `auth.login_success`, `admin.*` |
| Consent dispute | Consent method, question version, IP | Link `wa_consent_events` |

### Missing events to add

| Suggested Event | Rationale |
|-----------------|-----------|
| `auth.login_failed` | Brute-force investigation |
| `team.access_code_verified` / `denied` | Owner portal disputes |
| `auction.undo` | Highest dispute volume |
| `auction.reauction` | Purse integrity |
| `tournament.config_updated` | Rule-change disputes |
| `sync.export_token_issued` / `sync.completed` | Local/cloud integrity |
| `security.unauthorized_access` | Failed auth checks |
| `global_player.upserted` | Unauthenticated write trail |
| `admin.organizer_suspended` | Account-level disputes |
| `finance.purse_protection_triggered` | Bid rejected due to reserve |

### Investigation workflow

1. Identify tournament + team + player
2. Query `platform_audit_events` by `tournament_id` + time range
3. Filter `auction` + `finance` categories
4. Expand linked `auction_bid_events` / `bids`
5. Reconstruct timeline with actor labels
6. Export PDF/CSV for organizer/legal

---

## 7. Gaps vs Legal Commitment

Terms (`artifacts/auction-platform/src/pages/legal.tsx`) promise: *bid history, operator activity, login timestamps, IP records, operational changes*.

| Promised | Status |
|----------|--------|
| Bid history | Met |
| Operator activity | Partial |
| Login timestamps | **Not met** |
| IP records | Partial (consent only) |
| Operational changes | **Not met** |

---

## 8. Approval Checklist

Before implementation, confirm:

1. **Schema approval** — `platform_audit_events` + `platform_audit_sessions`?
2. **Wave priority** — Wave 1 (auth + auction undo + purse) first?
3. **Retention** — indefinite append-only, or partition/archive after N months?
4. **PII policy** — full mobile/email in `actor_label`, or hash/redact?
5. **Local app** — audit in BidWar Local SQLite from day one, or cloud-only phase 1?
6. **Existing tables** — keep auction intelligence separate (recommended)?

---

## Key file index

| Concern | Path |
|---------|------|
| Auth routes | `artifacts/api-server/src/routes/auth.ts` |
| Auction routes | `artifacts/api-server/src/routes/auction.ts` |
| Teams / players | `artifacts/api-server/src/routes/teams.ts`, `players.ts` |
| JWT / cookies | `artifacts/api-server/src/lib/jwt.ts` |
| Organizer guards | `artifacts/api-server/src/middleware/require-organizer.ts` |
| Auction logger | `artifacts/api-server/src/lib/auction-logger.ts` |
| DB schemas | `lib/db/src/schema/` |
| Legal audit promise | `artifacts/auction-platform/src/pages/legal.tsx` |

---

*Generated from full codebase audit. No implementation code has been written.*
