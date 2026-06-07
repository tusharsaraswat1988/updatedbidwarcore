# Local Mode — Full Roster Management Architecture Specification

**Version:** 1.0 (draft for approval)  
**Status:** Architecture specification only — **no implementation**  
**Scope:** Offline roster CRUD (players, teams, categories) during live auction with full cloud reconciliation, audit trail, and zero data loss.

**Related documents:**
- [LOCAL_MODE_ROSTER_CHANGES.md](./LOCAL_MODE_ROSTER_CHANGES.md) — current-state gap analysis
- [FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md](./FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md) — full-fidelity local mode plan
- [LOCAL_MODE_AUDIT.md](./LOCAL_MODE_AUDIT.md) — baseline local mode audit

---

## 1. Goals and non-goals

### Goals

| # | Requirement |
|---|-------------|
| G1 | Add, edit, delete **players**, **teams**, and **categories** while WAN is completely disconnected |
| G2 | Same operations allowed **during live auction** with explicit safety rules |
| G3 | Block unsafe mutations on **current auction player** and **sold/retained** players |
| G4 | **Full sync back to cloud** after event — no locally-created entity lost |
| G5 | **No duplicate creation** on cloud (idempotent sync) |
| G6 | **Audit history** preserved locally and replayed to cloud on sync |
| G7 | Organiser UI workflow matches cloud UX where possible |

### Non-goals (this spec)

- Build pipeline, Electron packaging, installer UX
- Cloud-side roster editing during local event (cloud is read-only while local is authoritative)
- Global player library search offline (optional future enhancement)
- WhatsApp consent capture offline (preserve existing values only)

---

## 2. Design principles

1. **Local LAN is authoritative during the event** — SQLite on the auction PC is source of truth for roster + auction state.
2. **Stable identity before sync** — every entity gets an immutable `localUuid` at creation; `cloudId` is assigned by cloud on first successful reconcile.
3. **Append-only change log** — all roster mutations write to `roster_events`; sync replays the log; cloud applies idempotently by `eventUuid`.
4. **Soft delete only** — hard deletes forbidden after import; tombstones sync to cloud.
5. **Auction routes own auction outcomes** — roster PATCH must not change `status`, `soldPrice`, `teamId` on sold players; use existing auction endpoints for sell/unsold/undo.
6. **Ordered sync pipeline** — categories → teams → players → auction results → audit replay.
7. **Fail closed on ambiguity** — sync returns conflicts for human resolution rather than silently duplicating.

---

## 3. Identity model

### 3.1 Dual-key strategy

Every roster entity (player, team, category) carries:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | INTEGER (local PK) | Fast local joins, auction session refs, UI lists |
| `localUuid` | TEXT (UUID v4) | **Immutable** stable identity across sync; never changes |
| `cloudId` | INTEGER nullable | Cloud PK after first reconcile; NULL until synced |
| `origin` | TEXT enum | `'cloud'` (imported) \| `'local'` (created offline) |
| `syncState` | TEXT enum | `'synced'` \| `'pending'` \| `'conflict'` |
| `deletedAt` | TEXT nullable | Soft-delete tombstone; NULL = active |

```
Import from cloud:
  localUuid  ← generated at import (NEW — backfill for existing rows)
  cloudId    ← cloud PK
  origin     ← 'cloud'
  syncState  ← 'synced'

Create offline:
  localUuid  ← uuid v4 at INSERT
  cloudId    ← NULL
  origin     ← 'local'
  syncState  ← 'pending'
```

### 3.2 Why not UUID-only?

Auction engine, bids, and session already use integer local IDs. Keeping local `id` avoids a large refactor. `localUuid` is the **sync correlation key**; `cloudId` is the **cloud correlation key**.

### 3.3 Reference resolution during sync

Payloads use **UUIDs**, not local integers:

```json
{
  "playerLocalUuid": "550e8400-e29b-41d4-a716-446655440000",
  "categoryLocalUuid": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "teamLocalUuid": null
}
```

Cloud resolves UUID → cloud PK via a new `entity_uuid_map` table (see §4.2).

---

## 4. Database schema changes

### 4.1 Local SQLite — entity columns (all three tables)

Apply to `players`, `teams`, `categories`:

```sql
ALTER TABLE players ADD COLUMN local_uuid TEXT NOT NULL;
ALTER TABLE players ADD COLUMN origin TEXT NOT NULL DEFAULT 'cloud';
ALTER TABLE players ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'synced';
ALTER TABLE players ADD COLUMN deleted_at TEXT;
ALTER TABLE players ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX uq_players_local_uuid ON players (local_uuid);
CREATE UNIQUE INDEX uq_players_tournament_name_active
  ON players (tournament_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_players_tournament_mobile_active
  ON players (tournament_id, mobile_number)
  WHERE deleted_at IS NULL AND mobile_number IS NOT NULL AND mobile_number != '';
```

Repeat analogous indexes for teams (`short_code`, `owner_mobile`) and categories (`name` per tournament).

**Player schema parity** — add missing cloud fields to local `players`:

```sql
ALTER TABLE players ADD COLUMN player_tag TEXT;
ALTER TABLE players ADD COLUMN player_tag_team_id INTEGER;
ALTER TABLE players ADD COLUMN is_non_playing_member INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN global_player_id TEXT;
```

**Team schema parity:**

```sql
ALTER TABLE teams ADD COLUMN owner_email TEXT;
ALTER TABLE teams ADD COLUMN owner_photo_url TEXT;
```

### 4.2 Local SQLite — `roster_events` (append-only change log)

```sql
CREATE TABLE roster_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uuid      TEXT NOT NULL UNIQUE,           -- idempotency key for cloud replay
  tournament_id   INTEGER NOT NULL,
  entity_type     TEXT NOT NULL,                  -- 'player' | 'team' | 'category'
  entity_local_uuid TEXT NOT NULL,
  entity_cloud_id INTEGER,                        -- known at emit time if origin=cloud
  operation       TEXT NOT NULL,                  -- 'create' | 'update' | 'delete'
  payload         TEXT NOT NULL,                  -- JSON: full snapshot OR field delta
  payload_hash    TEXT NOT NULL,                  -- SHA-256 for integrity
  actor_type      TEXT NOT NULL DEFAULT 'organizer',
  actor_label     TEXT,
  reason          TEXT,                           -- required for critical edits
  auction_status  TEXT,                           -- snapshot: idle|active|paused|...
  occurred_at     TEXT NOT NULL,
  synced_at       TEXT,
  sync_error      TEXT,
  severity        TEXT NOT NULL DEFAULT 'info'    -- info | warning
);

CREATE INDEX ix_roster_events_tournament_unsynced
  ON roster_events (tournament_id, synced_at)
  WHERE synced_at IS NULL;
```

Every roster mutation runs in a **single transaction**:

1. Validate guards (§6)
2. UPDATE/INSERT entity row
3. INSERT `roster_events` row
4. INSERT `local_audit_events` row (§4.3)
5. COMMIT

### 4.3 Local SQLite — `local_audit_events`

Mirror cloud audit shape for replay:

```sql
CREATE TABLE local_audit_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_uuid      TEXT NOT NULL UNIQUE,
  tournament_id   INTEGER NOT NULL,
  event_category  TEXT NOT NULL,     -- 'player' | 'team' | 'category' | 'roster'
  event_action    TEXT NOT NULL,     -- 'player.created', 'player.updated', ...
  summary         TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',
  outcome         TEXT NOT NULL DEFAULT 'success',
  resource_type   TEXT,
  resource_local_uuid TEXT,
  resource_cloud_id INTEGER,
  before_json     TEXT,
  after_json      TEXT,
  reason          TEXT,
  actor_type      TEXT NOT NULL DEFAULT 'organizer',
  actor_label     TEXT,
  occurred_at     TEXT NOT NULL,
  synced_at       TEXT
);
```

Local audit uses same snapshot helpers as cloud (`snapshotPlayer`, `snapshotTeam`, `snapshotCategory`) — shared package `@workspace/audit-snapshots`.

### 4.4 Local SQLite — `local_media`

For offline photo/logo upload (no Cloudinary at runtime):

```sql
CREATE TABLE local_media (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  media_uuid      TEXT NOT NULL UNIQUE,
  tournament_id   INTEGER NOT NULL,
  entity_type     TEXT,              -- 'player' | 'team' | 'tournament'
  entity_local_uuid TEXT,
  mime_type       TEXT NOT NULL,
  file_path       TEXT NOT NULL,     -- relative to {userData}/bidwar-data/media/
  sha256          TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
```

Entity `photoUrl` / `logoUrl` stores `/media/{mediaUuid}` locally — never an external URL during offline event.

### 4.5 Local SQLite — `sync_runs`

Track multi-phase sync state:

```sql
CREATE TABLE sync_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_uuid        TEXT NOT NULL UNIQUE,
  tournament_id   INTEGER NOT NULL,
  phase           TEXT NOT NULL,     -- 'roster' | 'results' | 'audit' | 'complete' | 'failed'
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  error           TEXT,
  cloud_response  TEXT
);
```

### 4.6 Cloud PostgreSQL — new tables

```sql
-- UUID ↔ cloud PK mapping (per tournament)
CREATE TABLE entity_uuid_map (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id),
  entity_type     TEXT NOT NULL,
  local_uuid      TEXT NOT NULL,
  cloud_id        INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, entity_type, local_uuid)
);

-- Idempotent roster event receipt log
CREATE TABLE roster_sync_events (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL,
  event_uuid      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  operation       TEXT NOT NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, event_uuid)
);
```

### 4.7 Cloud PostgreSQL — entity columns

Add to cloud `players`, `teams`, `categories` (nullable for backward compat):

```sql
ALTER TABLE players ADD COLUMN local_uuid TEXT;
CREATE UNIQUE INDEX uq_players_tournament_local_uuid
  ON players (tournament_id, local_uuid)
  WHERE local_uuid IS NOT NULL;
```

Same for teams and categories.

### 4.8 Import backfill migration

On `POST /local/import`, for every imported entity:

```typescript
localUuid: crypto.randomUUID(),  // NEW uuid even for cloud-origin rows
cloudId: cloudRow.id,
origin: 'cloud',
syncState: 'synced',
deletedAt: null,
```

Also INSERT into local `entity_uuid_map` equivalent (can be implicit via columns). Store mapping `{ localUuid → cloudId }` in memory during import for FK resolution in UI.

> **Important:** Import must **not** wipe roster if auction is in progress. Re-import becomes **merge-by-cloudId** (see §8.6) — separate from initial import.

---

## 5. Safety guards (live auction)

### 5.1 Auction context helper

All roster mutations call:

```typescript
async function getAuctionContext(tournamentId: number): Promise<{
  sessionStatus: 'idle' | 'active' | 'paused' | 'completed';
  currentPlayerId: number | null;
  currentPlayerLocalUuid: string | null;
  isLive: boolean;  // status === 'active' && currentPlayerId != null
}>
```

### 5.2 Guard matrix — players

| Operation | Guard | HTTP |
|-----------|-------|------|
| **Delete** | `deletedAt` already set | 404 |
| **Delete** | `session.currentPlayerId === player.id` | **409** `PLAYER_ON_BLOCK` |
| **Delete** | `status IN ('sold', 'retained')` | **409** `PLAYER_SOLD_OR_RETAINED` |
| **Delete** | bids exist for player | **409** `PLAYER_HAS_BIDS` (soft-delete still allowed via force flag — see below) |
| **Edit** | current player + field in `CRITICAL_FIELDS` | **409** `PLAYER_ON_BLOCK` |
| **Edit** | sold/retained + field in `AUCTION_OWNED_FIELDS` | **409** `USE_AUCTION_ROUTES` |
| **Edit** | sold/retained + non-metadata field | **409** |
| **Add** | tournament `status === 'completed'` | **409** `TOURNAMENT_COMPLETED` |
| **Add** | duplicate name (case-insensitive) | **409** `DUPLICATE_NAME` |
| **Add** | duplicate mobile (normalized) | **409** `DUPLICATE_MOBILE` |

```typescript
const CRITICAL_FIELDS = ['basePrice', 'categoryId', 'status', 'teamId', 'soldPrice', 'retainedPrice'];
const AUCTION_OWNED_FIELDS = ['status', 'soldPrice', 'teamId', 'retainedPrice'];
const METADATA_FIELDS = ['name', 'city', 'role', 'photoUrl', 'mobileNumber', 'email', ...]; // editable on current player
```

**Policy:** While player is **on the block** (`isLive && currentPlayerId === player.id`):

- ✅ Allow: photo, mobile, city, role, achievements, jersey, availability dates
- ❌ Block: basePrice, categoryId, status, teamId, soldPrice, delete

**Policy:** **Sold / retained** players:

- ✅ Allow: photo, mobile, email, achievements, playerTag (metadata)
- ❌ Block: delete (use undo flow first), basePrice, categoryId, status, teamId, soldPrice

### 5.3 Guard matrix — teams

| Operation | Guard | HTTP |
|-----------|-------|------|
| **Delete** | any player with `teamId` and not deleted | **409** `TEAM_HAS_PLAYERS` |
| **Delete** | `purseUsed > 0` | **409** `TEAM_HAS_SPEND` |
| **Delete** | team is `currentBidTeamId` | **409** `TEAM_IS_BIDDING` |
| **Edit** | `purse` reduced below `purseUsed` | **409** `PURSE_BELOW_SPENT` |
| **Edit** | duplicate `shortCode` or `ownerMobile` | **409** |
| **Add** | duplicate shortCode / ownerMobile | **409** |

### 5.4 Guard matrix — categories

| Operation | Guard | HTTP |
|-----------|-------|------|
| **Delete** | any active player with `categoryId` | **409** `CATEGORY_HAS_PLAYERS` |
| **Delete** | category in `session.activeCategoryIds` during live filter | **409** `CATEGORY_ACTIVE_IN_AUCTION` |
| **Edit** | `minBid` / `bidIncrement` change while auction active | **409** `CATEGORY_RULES_LOCKED` (optional organiser override with reason) |
| **Add** | duplicate name | **409** |

### 5.5 Soft delete semantics

```typescript
// Never: DELETE FROM players WHERE ...
// Always:
UPDATE players SET deleted_at = now(), sync_state = 'pending', sync_version = sync_version + 1
```

Deleted players:

- Excluded from `next-player` pool
- Remain in DB for audit + sync
- Hidden in UI by default (toggle "Show removed")

---

## 6. Operation specifications

### 6.1 Add player offline

**Endpoint:** `POST /api/tournaments/:tid/players` (enhanced)

**Request body:** Same as cloud `playerInputSchema` (full parity).

**Flow:**

```
1. Auth: organiser session OR operator PIN (X-Operator-Pin)
2. Validate guards (§5.2)
3. Resolve categoryLocalUuid → categoryId (local FK)
4. If photo: must be /media/{uuid} or base64 → local_media
5. INSERT player:
     localUuid = uuid()
     origin = 'local'
     syncState = 'pending'
     status = 'available' (forced — cannot create as sold)
6. INSERT roster_events (op='create', payload=full snapshot)
7. INSERT local_audit_events (action='player.created')
8. Return 201 + player JSON (includes localUuid)
```

**Live auction:** Allowed without pausing. New player immediately eligible for `next-player` if `status=available`.

**UI:** Players page → "Add Player" always enabled during auction; banner if adding while live: *"Player will be available for nomination immediately."*

---

### 6.2 Edit player offline

**Endpoint:** `PATCH /api/tournaments/:tid/players/:id`

**Flow:**

```
1. Auth
2. Load player; 404 if deletedAt set
3. Compute field delta vs guard matrix (§5.2)
4. If any CRITICAL_FIELDS on current player → 409
5. If AUCTION_OWNED_FIELDS on sold/retained → 409
6. If critical edit (cloud parity: isCriticalPlayerPatch) → require body.reason
7. UPDATE player; sync_state='pending'; sync_version++
8. roster_events (op='update', payload={ before, after, changedFields })
9. local_audit_events (action='player.updated')
10. Return 200
```

**Retained player purse side-effect:** If changing `retainedPrice` or `teamId` on retained player (when allowed pre-auction), adjust `team.purseUsed` in same transaction — mirror cloud logic.

---

### 6.3 Delete player offline

**Endpoint:** `DELETE /api/tournaments/:tid/players/:id`

**Flow:**

```
1. Auth
2. Guards: not on block, not sold/retained, not has bids (§5.2)
3. Soft delete: deleted_at = now()
4. roster_events (op='delete', payload={ snapshot })
5. local_audit_events (action='player.deleted', severity='warning')
6. Return 204
```

**No hard delete** except admin-only "purge before import" tooling (out of scope).

---

### 6.4 Add team offline

**Endpoint:** `POST /api/tournaments/:tid/teams`

**Flow:** Same pattern as §6.1 — `localUuid`, guards (§5.3), audit `team.created`.

**Live auction:** Allowed. New team can bid immediately if `isBiddingEnabled=true`.

**Owner access:** Generate owner join link using **local** `tournamentId` + `teamId`; QR encodes LAN URL. On sync, cloud returns new `cloudId` → update owner saved links optional post-sync.

---

### 6.5 Edit team offline

**Endpoint:** `PATCH /api/tournaments/:tid/teams/:id`

**Guards:** §5.3 — purse, duplicates, cannot disable bidding mid-bid if team is current bidder.

**Audit:** `team.updated` with before/after snapshots.

---

### 6.6 Add category offline

**Endpoint:** `POST /api/tournaments/:tid/categories`

**Flow:** Same identity pattern; audit `category.created`.

**Live auction:** Allowed. New category **not** auto-added to active category filter — operator must re-apply filter if needed.

---

### 6.7 Edit category offline

**Endpoint:** `PATCH /api/tournaments/:tid/categories/:id`

**Guards:** §5.4 — lock `minBid`/`bidIncrement` during active auction unless `reason` provided (organiser override).

**Audit:** `category.updated`.

> **Note:** Category delete is out of explicit user list but included for completeness — soft delete with guards, syncs as `op='delete'`.

---

## 7. Sync architecture

### 7.1 Overview — three-phase pipeline

Replace single `POST /local/sync-to-cloud` with ordered pipeline:

```
Phase A: Roster reconcile     POST /api/tournaments/:cloudId/sync/roster
Phase B: Auction results      POST /api/tournaments/:cloudId/sync/results  (existing, extended)
Phase C: Audit replay         POST /api/tournaments/:cloudId/sync/audit
```

Local orchestrator: `POST /local/sync-to-cloud` runs A → B → C atomically from organiser's perspective. Failure in any phase rolls forward retry state — **no partial cloud state without local tracking**.

```
┌─────────────────┐     Phase A      ┌─────────────────┐
│  Local SQLite   │ ───────────────► │  Cloud Postgres │
│  roster_events  │   roster sync    │  entity_uuid_map│
└─────────────────┘                  └─────────────────┘
        │                                      │
        │            Phase B                   │
        └──────────────────────────────────────►
                     results sync
        │                                      │
        │            Phase C                   │
        └──────────────────────────────────────►
                     audit replay
```

### 7.2 Phase A — `POST /api/tournaments/:cloudId/sync/roster`

**Auth:** `X-Export-Token` (existing export token validation)

**Request:**

```json
{
  "syncRunUuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "baseVersion": 1,
  "categories": {
    "creates": [{ "localUuid": "...", "name": "Gold", "minBid": 500000, ... }],
    "updates": [{ "localUuid": "...", "cloudId": 12, "patch": { "minBid": 600000 }, "syncVersion": 3 }],
    "deletes": [{ "localUuid": "...", "cloudId": 15, "deletedAt": "2026-06-08T..." }]
  },
  "teams": { "creates": [...], "updates": [...], "deletes": [...] },
  "players": { "creates": [...], "updates": [...], "deletes": [...] },
  "events": [
    { "eventUuid": "...", "entityType": "player", "operation": "create", "occurredAt": "...", "payloadHash": "..." }
  ]
}
```

**Cloud processing order (mandatory):**

1. Validate token not yet used for **full** sync (or allow roster-only pass — see §7.5)
2. For each `eventUuid`: skip if exists in `roster_sync_events` (**idempotent**)
3. **Categories** creates → updates → deletes
4. **Teams** creates → updates → deletes
5. **Players** creates → updates → deletes
6. Record all `eventUuid` in `roster_sync_events`
7. Upsert `entity_uuid_map` for every create

**Response:**

```json
{
  "ok": true,
  "mappings": {
    "categories": [{ "localUuid": "...", "cloudId": 45 }],
    "teams": [{ "localUuid": "...", "cloudId": 9 }],
    "players": [{ "localUuid": "...", "cloudId": 301 }]
  },
  "conflicts": [],
  "playersCreated": 2,
  "playersUpdated": 5,
  "playersDeleted": 1
}
```

**Local post-processing:**

- Apply `mappings` → `UPDATE players SET cloud_id = ?, sync_state = 'synced' WHERE local_uuid = ?`
- Mark `roster_events.synced_at`
- Update `sync_runs.phase = 'roster'`

### 7.3 Phase B — `POST /api/tournaments/:cloudId/sync/results`

Extends existing sync. Changes:

- `playerResults` entries may use `playerLocalUuid` **or** `cloudId` (cloud resolves via `entity_uuid_map`)
- `bids` entries reference `playerLocalUuid` / `teamLocalUuid`
- Idempotent bid insert: `UNIQUE (tournament_id, player_id, team_id, amount, timestamp)` or bid UUID

```json
{
  "playerResults": [
    { "playerLocalUuid": "...", "status": "sold", "teamLocalUuid": "...", "soldPrice": 1500000 }
  ],
  "teamPurses": [
    { "teamLocalUuid": "...", "purseUsed": 8500000 }
  ],
  "bids": [
    { "bidUuid": "...", "playerLocalUuid": "...", "teamLocalUuid": "...", "amount": 1500000, "timestamp": "..." }
  ]
}
```

Cloud resolves UUIDs → IDs before write. Existing UPDATE logic preserved.

### 7.4 Phase C — `POST /api/tournaments/:cloudId/sync/audit`

**Request:**

```json
{
  "events": [
    {
      "auditUuid": "...",
      "eventCategory": "player",
      "eventAction": "player.created",
      "summary": "Player \"Rahul Sharma\" added (offline)",
      "severity": "info",
      "resourceLocalUuid": "...",
      "beforeJson": null,
      "afterJson": { ... },
      "reason": null,
      "occurredAt": "...",
      "actorLabel": "Organiser (local)"
    }
  ]
}
```

Cloud inserts into `platform_audit_events` with `source = 'local_sync'` and dedupes on `auditUuid`.

### 7.5 Token and replay policy

| Scenario | Policy |
|----------|--------|
| First full sync after event | Allowed; sets `exportTokenSyncedAt` after Phase B+C complete |
| Roster phase fails | Token **not** consumed; local `sync_state` stays `pending`; retry |
| Results phase fails after roster OK | Token **not** consumed; cloud has new roster but not results — safe; retry results only |
| Duplicate `eventUuid` | Skip (idempotent) |
| Duplicate `localUuid` create | Return existing mapping (no second row) |

### 7.6 No duplicate creation — idempotency rules

| Key | Scope | Rule |
|-----|-------|------|
| `eventUuid` | Per tournament | Cloud skips already-applied events |
| `localUuid` | Per tournament per entity type | UNIQUE in `entity_uuid_map`; second create returns existing |
| `auditUuid` | Global | Skip duplicate audit inserts |
| `bidUuid` | Per tournament | Skip duplicate bid inserts |
| Name / mobile | Per tournament | Local guard at create; cloud double-check on sync |

---

## 8. Conflict resolution

### 8.1 When conflicts occur

Conflicts arise when cloud row changed **after export** while local also changed the same entity (unlikely during local event if cloud is read-only — but protect anyway).

### 8.2 Cloud read-only lock during local event

On export, cloud sets `tournament.localEventActive = true`:

- Cloud roster mutations return **423 Locked** with message *"Tournament is running in Local Mode"*
- Cloud auction mutations disabled
- Removes 99% of conflict cases

### 8.3 Conflict rules (when cloud row differs)

| Field category | Winner | Rule |
|----------------|--------|------|
| Roster metadata (name, photo, mobile) | **Local** | Local event is authoritative |
| Auction outcomes (status, soldPrice, teamId) | **Local** | From Phase B results |
| Cloud-only fields (whatsappConsent) | **Cloud** | Never overwritten by local |
| `basePrice` on sold player | **Local** | If sold, price locked at sale time |
| Duplicate mobile on create | **Reject** | Return conflict for manual merge |
| Delete locally, edit on cloud | **Local delete wins** | Tombstone sync |

### 8.4 Conflict response shape

```json
{
  "ok": false,
  "conflicts": [
    {
      "entityType": "player",
      "localUuid": "...",
      "cloudId": 88,
      "field": "mobileNumber",
      "localValue": "9876543210",
      "cloudValue": "9876543211",
      "resolution": "manual_required",
      "suggestedAction": "merge_or_skip"
    }
  ]
}
```

Local UI shows **Sync Conflicts** panel — organiser picks per conflict: *Use local*, *Use cloud*, *Skip*. Selection stored in `sync_conflict_resolutions` table; retry sync.

### 8.5 Merge-by-cloudId re-import (not mid-auction)

Initial import remains destructive. **Subsequent** cloud re-export (post-event correction) uses merge:

- Match by `cloudId`
- Preserve local-only entities (`origin='local'`)
- Never delete local auction data without explicit organiser confirmation

---

## 9. Local API surface (summary)

All routes require **organiser auth** (§10) or **operator PIN** for LAN.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/tournaments/:tid/players` | §6.1 |
| PATCH | `/api/tournaments/:tid/players/:id` | §6.2 |
| DELETE | `/api/tournaments/:tid/players/:id` | §6.3 soft delete |
| POST | `/api/tournaments/:tid/players/bulk` | CSV bulk — **new on local** |
| POST | `/api/tournaments/:tid/teams` | §6.4 |
| PATCH | `/api/tournaments/:tid/teams/:id` | §6.5 |
| DELETE | `/api/tournaments/:tid/teams/:id` | soft delete |
| POST | `/api/tournaments/:tid/categories` | §6.6 |
| PATCH | `/api/tournaments/:tid/categories/:id` | §6.7 |
| DELETE | `/api/tournaments/:tid/categories/:id` | soft delete |
| POST | `/api/media/upload` | Offline photo/logo → `local_media` |
| GET | `/media/:mediaUuid` | Serve local binary |
| GET | `/api/tournaments/:tid/roster/audit` | Local audit log (paginated) |
| POST | `/local/sync-to-cloud` | Orchestrates Phase A→B→C |
| GET | `/local/sync-status` | Extended: phase, conflicts, pending counts |

**List endpoints** filter `deleted_at IS NULL` by default; `?includeDeleted=1` for audit UI.

---

## 10. Authentication and authorization

Roster mutations require one of:

1. **Organiser session** — `POST/GET /api/auth/organizer/:tid/login|me` on local server (password hash from export)
2. **Operator PIN** — `X-Operator-Pin` header (existing auction PIN extended to roster routes)

Read endpoints (GET lists) remain open on LAN for display/owner apps.

Audit events record which auth method was used in `actor_type` / `actor_label`.

---

## 11. UI workflow

### 11.1 Navigation — always available during auction

Sidebar entries **never disabled** during live auction:

- Teams
- Categories  
- Players

Badge on sidebar if `sync_state='pending'` count > 0: *"3 unsynced changes"*

### 11.2 Players page

| Action | Live auction UX |
|--------|-----------------|
| **Add player** | Dialog opens normally; info banner: *"Available for nomination immediately"* |
| **Edit player** | Critical fields greyed out if on block or sold; tooltip explains why |
| **Delete player** | Disabled with tooltip if on block / sold / has bids |
| **Bulk CSV** | Allowed pre-auction and during pause; during live → confirm dialog |
| **Photo upload** | Local crop/upload → `/api/media/upload`; preview from `/media/...` |

### 11.3 Operator panel integration

- **Quick-add player** button in operator panel (optional P1) → minimal form (name, category, base price) → returns to auction
- **Player list** reflects new players without refresh (SSE invalidate `players`)
- If deleted player was in queue, silently skipped

### 11.4 Teams page

- Add team during auction → show generated **owner LAN link** immediately
- Edit purse / access code allowed; delete blocked if spend > 0

### 11.5 Categories page

- Add category during auction → prompt: *"Apply category filter now?"* → deep-link to operator filter
- Edit min bid during live → requires reason modal (audit)

### 11.6 Sync UI (Local Mode page)

```
┌─────────────────────────────────────────────┐
│  Sync to Cloud                              │
│  ─────────────────────────────────────────  │
│  Roster changes:  12 pending                │
│  Audit events:    12 pending                │
│  Auction results: Ready                       │
│                                             │
│  [ Sync Now ]                               │
│                                             │
│  Last sync: —                               │
└─────────────────────────────────────────────┘
```

Progress steps during sync:

1. ✓ Uploading roster (categories, teams, players)
2. ✓ Uploading auction results
3. ✓ Uploading audit history
4. ✓ Complete

On conflict → **Resolve Conflicts** screen before retry.

### 11.7 Offline indicator

No cloud calls from roster UI. `useBranding`, media, auth — all local. Network indicator shows *"Local Mode — offline"* not an error state.

---

## 12. Audit history

### 12.1 Local audit (during event)

Every roster mutation writes `local_audit_events` with:

- `before_json` / `after_json` (redacted snapshots — same as cloud)
- `reason` when required (critical edits, category rule override)
- `auction_status` context in `roster_events`

Organiser can view **Roster History** tab on Local Mode page — filter by entity type, searchable.

### 12.2 Cloud audit (after sync)

Phase C replays all unsynced `local_audit_events` to `platform_audit_events`.

Additional cloud-only entries on sync:

- `roster.sync_completed` — summary counts
- `roster.sync_conflict_resolved` — manual resolutions

Audit entries include `metadata.source = 'bidwar_local'` and `metadata.localUuid`.

---

## 13. Media workflow (offline photos)

```
User selects photo in PlayerForm
  → ImageEditorDialog (existing UI)
  → POST /api/media/upload (local — NOT Cloudinary)
  → Saves to {userData}/bidwar-data/media/{sha256}.webp
  → INSERT local_media
  → Returns { mediaUuid, url: "/media/{mediaUuid}" }
  → player.photoUrl = "/media/{mediaUuid}"

On sync Phase A:
  → Include media file bytes OR pre-uploaded cloud URL in create payload
  → Cloud stores to Cloudinary once during sync (online)
  → Cloud returns final photoUrl → optional local update
```

Bulk CSV offline: photo column accepts empty; photos added later via edit.

---

## 14. Migration and rollout

### Phase 1 — Schema + identity
- Add columns to local SQLite
- Import backfill `localUuid`
- Shared audit snapshot package

### Phase 2 — Guards + event log
- Refactor local roster routes with guards (§5)
- `roster_events` + `local_audit_events` writes
- Local media upload

### Phase 3 — Cloud sync endpoints
- `entity_uuid_map`, `roster_sync_events` tables
- `POST .../sync/roster`, extend `.../sync/results`, `POST .../sync/audit`
- Cloud `localEventActive` lock on export

### Phase 4 — UI + auth
- Local organiser auth
- Players/teams/categories UX updates
- Sync progress + conflict resolution UI

### Phase 5 — Operator quick-add + bulk local

---

## 15. Acceptance criteria

Before marking roster management **production-ready**:

### Offline functionality
- [ ] Add/edit/delete player, team, category with WAN unplugged
- [ ] All operations work while auction status is `active`
- [ ] Photo upload works offline via local media store
- [ ] Bulk CSV import works on local server

### Safety
- [ ] Cannot delete player on auction block (409)
- [ ] Cannot delete sold/retained player (409)
- [ ] Cannot change basePrice/category on current player (409)
- [ ] Cannot delete team with spend or assigned players (409)
- [ ] Soft delete only — no hard delete in normal flow

### Sync
- [ ] Locally-created player sold offline → appears on cloud after sync with correct team and price
- [ ] Locally-created team → cloud team created once (retry does not duplicate)
- [ ] Re-run sync is idempotent (same counts, no duplicates)
- [ ] Audit events visible on cloud admin audit log with `source=bidwar_local`
- [ ] Conflict UI handles duplicate mobile gracefully

### Data integrity
- [ ] `entity_uuid_map` complete for all entities after sync
- [ ] Bid history matches sold players including locally-created
- [ ] No orphaned bids after player soft-delete attempt (blocked)

---

## 16. Open decisions (for approval)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Single sync token for all phases vs per-phase tokens | **Single token**; consume only after Phase C |
| D2 | Allow category rule edits during live auction with reason | **Yes** with reason + audit |
| D3 | Operator quick-add from auction panel in v1 | **Phase 5** (post core) |
| D4 | Cloud `localEventActive` lock | **Yes** — strongly recommended |
| D5 | Media upload to cloud during roster sync vs results sync | **Roster sync** (Phase A) |

---

## 17. File impact map (implementation reference)

| Area | Files |
|------|-------|
| Local schema | `lib/db-local/src/setup.ts`, `lib/db-local/src/schema/*` |
| Local roster routes | `artifacts/bidwar-local/src/server/routes/players.ts`, `teams.ts`, `categories.ts` |
| Roster service (new) | `artifacts/bidwar-local/src/server/lib/roster-service.ts` |
| Sync orchestrator | `artifacts/bidwar-local/src/server/routes/local.ts` |
| Cloud sync routes | `artifacts/api-server/src/routes/tournaments.ts` (new sub-routes) |
| Cloud schema | `lib/db/src/schema/*`, new migration |
| Audit shared | `artifacts/api-server/src/lib/audit-snapshots.ts` → `@workspace/audit-snapshots` |
| UI | `artifacts/auction-platform/src/pages/players.tsx`, `teams.tsx`, `categories.tsx`, `local-mode.tsx` |
| Media | `artifacts/bidwar-local/src/server/routes/media.ts` (new) |

---

## 18. Approval checklist

Please confirm:

- [ ] Dual-key identity (`localUuid` + `cloudId`) approach
- [ ] Append-only `roster_events` change log
- [ ] Soft delete only
- [ ] Three-phase sync pipeline (roster → results → audit)
- [ ] Guard matrix for live auction (§5)
- [ ] Cloud `localEventActive` lock during local event
- [ ] Conflict resolution UX (manual merge for edge cases)
- [ ] Phase rollout order (§14)

**No code will be written until this specification is approved.**

---

*Document version 1.0 — BidWar Local Mode Roster Architecture*
