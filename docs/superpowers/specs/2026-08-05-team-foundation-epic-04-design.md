# EPIC-04 — Team Foundation

**Date:** 2026-08-05  
**Status:** APPROVED (Modified) — Architecture Frozen  
**Depends on:** EPIC-01, EPIC-02, EPIC-03  
**Scope:** Platform Team Identity — Configuration, Members (views), Role Catalog, Type Catalog, Lifecycle, Validation, Team View, lock-once Configuration History  
**Non-goals:** Auction execution, Team/Player assignment engine, Fixtures, Scheduling, Matches, Standings, Statistics, Broadcast, roster history

---

## 1. Objective

Establish **Team** as a Platform Identity so every downstream module (Auction, Fixtures, Matches, Standings, Broadcast, Statistics) consumes **Team View** — never sport-specific or auction-specific team models.

Architecture correctness takes priority. Reuse before rewrite. No parallel Team systems.

---

## 2. Decision record

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| `teams` + owners + purse | Auction franchise runtime |
| `master_teams` + PTA | Canonical branding / roster history |
| Badminton franchise overlay | Sport metadata, not Team identity |
| Cosmetic `playerTag` / `isNonPlayingMember` | Captain/VC/staff signals |
| EPIC-03 SquadRules + formation strategy | Competition config only |
| Match squads | Cricket scoring runtime |

**Finding:** Mature auction team runtime; no platform Team Identity, Role Catalog, Team lifecycle, Team View, or Team Configuration History.

### 2.2 Chosen approach — A (Modified)

**Product Layer + Sport Bridges** (same pattern as EPIC-03):

- Team Identity / Configuration / Members / Validation in `platform-core`
- Team is a **platform identity**; members are **relationships** (views)
- Sport Bridges map `teams` (+ assignment tags) → Team View pieces
- No new Team table, no dual-write, no data migration this epic
- Freeze once into `team_configuration_history`

---

## 3. Permanent architecture boundary

```
Product Layer
  Team Identity
  Team Configuration (Working)
  Locked Team Configuration (History)
  Team Members (views)
  Team Roles (catalog)
  Team Types (catalog)
  Validation Result
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges
    AuctionTeamsBridge | MasterTeamsBridge | Future
        ↓
Runtime Layer (unchanged auction behavior)
  teams / players.teamId / playerTag / master_teams
```

**Permanent rules:**

1. Nothing below the boundary leaks into public product APIs.
2. Nothing above the boundary depends on runtime storage shapes.
3. Public APIs speak product language: Identity, Configuration, Members, Validation, History.
4. Bridges expose Team View only — never runtime entities.

### 3.1 Ownership chain (never violate)

```
Tournament
  → Competition Configuration / Plan
      → Participant
          → Registration
              → Team Formation
                  → Team
                      → Squad / Fixtures / Matches (out of scope)
```

### 3.2 Identity vs membership (critical)

- A **Team exists independently of its members**.
- Changing members must **never** change Team identity.
- Identity is Team. Members are relationships. Do not couple them.

---

## 4. Product terminology

| Product name | Meaning | Forbidden |
|--------------|---------|-----------|
| Team Identity | Stable platform identity | Franchise, Auction Team, Match Team |
| Team Configuration | Editable working config | Captain, Vice Captain, Owner-as-property |
| Team Member | Participant + Role + Status | Runtime assignment IDs, Player |
| Team Role | Catalog-driven membership role | Hardcoded role enums in validators |
| Locked Configuration | Immutable history version | Roster history, runtime snapshots |
| Team View | Modular public contract | Giant Team blob, runtime tables |

---

## 5. Team Identity

Team is **not** Registration, Competition, Participant, Squad, Franchise, or Match Team.

Team **types** (catalog):

| id | Display |
|----|---------|
| `competitive` | Competitive |
| `practice` | Practice |
| `selection` | Selection |
| `temporary` | Temporary |

No sport-specific inheritance.

---

## 6. Team Configuration

Working configuration fields only:

- Name
- Display Name
- Short Name
- Logo
- Branding (primary/secondary color)
- Visibility
- Type (`teamTypeId`)
- Status (lifecycle status on working config)
- Theme

**Explicitly excluded from Configuration:**

- Captain
- Vice Captain
- Owner (as a property)

Those are **Team Member Roles**. Storing them in Configuration creates duplicate truth.

Optional Manager/Owner contacts that exist on the auction runtime remain runtime-only; product surfaces them only via Members → Role.

---

## 7. Team Members

```
Team Member {
  participant   // Participant view reference (id + displayName + kind)
  roleId        // catalog role
  status        // active | inactive | invited | … (product)
}
```

Rules:

- References **Participant**, never Player
- Never expose runtime assignment IDs
- Members are relationships; removing all members does not delete Team Identity

### 7.1 Owner

Owner is **exactly like every other role**:

```
Team Member → Role = owner
```

Supports multiple owners, investors, sponsors, representatives without redesign. Owner is **not** a Team property.

---

## 8. Team Role Catalog

Catalog-driven. Never hardcoded in validation logic beyond reading catalog constraints.

| id | Required | Max (exact/multiple) |
|----|----------|----------------------|
| `captain` | Required | Exactly one |
| `vice_captain` | Optional | Exactly one |
| `player` | Optional | Multiple |
| `coach` | Optional | Multiple |
| `manager` | Optional | Multiple |
| `owner` | Optional | Multiple |
| `support_staff` | Optional | Multiple |
| `official` | Optional | Multiple |

Catalog fields per role:

- `required: boolean`
- `multipleAllowed: boolean`
- `maxCount: number | null` (`1` for exactly-one roles; `null` = unlimited when multiple)

---

## 9. Squad rules

**Do not duplicate EPIC-03 SquadRules.**

Team Validation **references** Competition Squad Rules (from Competition Configuration / Plan). One source of truth.

---

## 10. Team Lifecycle

Independent of Tournament, Competition, and Registration lifecycles.

```
Draft → Building → Ready → Locked → Active → Completed → Archived
```

Rules:

- `Archived` only after `Completed` (no direct Ready → Archived unless admin override — out of scope this epic)
- Locking Configuration moves status to `Locked` when validation passes
- Never merge lifecycle enums across layers

---

## 11. Lock pattern (EPIC-03 exact)

```
Working Team Configuration
  → Validation
  → Lock
  → Configuration History (append-only)
  → Execution (downstream; out of scope)
```

- No silent updates after lock
- No version mutation
- History stores **locked configurations only** — never runtime roster history

---

## 12. Team View (modular)

Never return one giant Team object. Separate:

1. Identity
2. Configuration
3. Members
4. Validation
5. History

---

## 13. Storage

### 13.1 Working on existing `teams` (additive nullable columns)

- `team_type_id`
- `display_name`
- `secondary_color`
- `visibility`
- `theme_json`
- `lifecycle_status`
- `configuration_locked`

Reuse existing: `name`, `short_code`, `color`, `logo_url` / `logo_public_id`.

**No new Team table.**

### 13.2 History

`team_configuration_history` — append-only locked configurations (Version 1 this epic).

---

## 14. Bridges

| Bridge | Source | Exposes |
|--------|--------|---------|
| AuctionTeamsBridge | `teams` + player tags/assignment | Team Identity, Configuration, Members |
| MasterTeamsBridge | `master_teams` branding hints | Branding enrichment only |
| Future | — | Same Team View contracts |

Bridges must expose **Team View only**. Never runtime entities (purse, accessCode, bidding flags, raw player rows).

---

## 15. APIs

Product subresources under the teams aggregate (auction CRUD remains for runtime compatibility):

```
GET    /tournaments/:id/teams/identities
GET    /tournaments/:id/teams/:teamId/identity
GET    /tournaments/:id/teams/:teamId/configuration
PATCH  /tournaments/:id/teams/:teamId/configuration
GET    /tournaments/:id/teams/:teamId/members
GET    /tournaments/:id/teams/:teamId/validation
GET    /tournaments/:id/teams/:teamId/history
POST   /tournaments/:id/teams/:teamId/ready
```

`POST .../ready` = Lock Team Setup (validation → freeze → history).

Existing auction `GET/POST/PATCH/DELETE /tournaments/:id/teams` remain runtime surfaces for the auction product — not Team View.

---

## 16. UI

- Extend Tournament Setup with **Team Setup** (one job = one screen)
- Reuse existing teams list patterns for identity/configuration editing
- No Auction UI, Player Assignment UI, or Match UI

---

## 17. Migration

None this epic. Bridges map current rows. Do not rewrite Master/Badminton/Auction teams.

---

## 18. Testing

- Team Identity independent of members
- Configuration excludes captain/owner properties
- Role catalog constraints (required / multiple)
- Lifecycle Archive-after-Completed
- Lock-once history
- Bridge never leaks runtime
- Cricket / Badminton regression (auction teams CRUD still works)

---

## 19. Explicitly forbidden

- New Team table
- Team assignment engine
- Player assignment
- Captain stored twice (config + membership)
- Owner stored twice (property + role)
- Sport-specific Team models
- Runtime leakage into Team View
- Duplicate SquadRules on Team

---

## 20. Success criteria

BidWar has Platform Team Identity. Every downstream module consumes Team View. No module creates its own Team identity.
