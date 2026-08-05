# EPIC-05 — Match Foundation

**Date:** 2026-08-05  
**Status:** APPROVED (Modified) — Architecture Frozen  
**Depends on:** EPIC-01, EPIC-02, EPIC-03, EPIC-04  
**Scope:** Platform Match Identity — Configuration, Sides, Officials, Role/Type Catalogs, Lifecycle (separate), Validation, Match View, lock-once Configuration History  
**Non-goals:** Scoring, Scoreboards, Broadcast, Statistics, Analytics, Streaming, Highlights, Scheduling Engine, Fixture Engine, Rule Engine

---

## 1. Objective

Establish **Match** as a Platform Identity so Scoring, Broadcast, Statistics, Streaming, Analytics, and Highlights consume **Match View** — never sport-specific or score-specific match models.

Architecture correctness takes priority. Reuse before rewrite. No parallel Match systems.

---

## 2. Decision record

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| `scoring_matches` | Canonical playable unit (cricket + badminton) |
| `badminton_match_details` + badminton engine | Sport scoring runtime |
| Cricket `scoring-core` + scoring APIs | Sport scoring runtime |
| Dual fixture systems | Planning — Fixture ≠ Match |
| Broadcast / OBS | Presentation consumers |
| EPIC-03 / EPIC-04 | Participant / Team product layers — Match not built |

**Finding:** Mature sport runtimes; no platform Match Identity, Match Side abstraction, Match Configuration History, or Match View.

### 2.2 Chosen approach — A (Modified)

**Product Layer + Sport Bridges** over `scoring_matches`:

- No new Match table
- Match Identity independent of sides, schedule, venue, officials
- Sides abstract Team vs Individual competition shapes
- Officials are Match Members (not Configuration)
- Lifecycle is its own module (not inside Configuration)
- Freeze once into `match_configuration_history`

---

## 3. Permanent architecture boundary

```
Product Layer
  Match Identity
  Match Configuration (Working)
  Locked Match Configuration (History)
  Match Sides (views)
  Match Officials (members)
  Match Roles / Types (catalogs)
  Match Lifecycle (separate)
  Validation Result
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges
    ScoringMatchesBridge | BadmintonMatchBridge | CricketMatchBridge | Future
        ↓
Runtime Layer (unchanged)
  scoring_matches / badminton_* / scoring_fixtures / events / sessions
```

**Permanent rules:**

1. Nothing below the boundary leaks into public product APIs.
2. Nothing above depends on runtime storage shapes.
3. Public APIs: Identity, Configuration, Sides, Officials, Validation, History.
4. Bridges expose Match View only.

### 3.1 Identity independence (critical)

A Match exists independently of:

- Participants / Sides
- Schedule
- Venue
- Officials

Changing any of those must **not** change Match Identity. Identity is permanent. Everything else is relationships or configuration.

### 3.2 Ownership chain

```
Tournament → Competition → Participant → Team Formation → Team → Match → (Scoring / Broadcast …)
```

---

## 4. Match Identity

Match is **not** Fixture, Schedule, Score, Statistics, Broadcast, Highlight, or Stream.

Match represents one playable contest.

**Type catalog:** `league` | `knockout` | `practice` | `friendly` | `exhibition` | `custom` (+ future)

---

## 5. Match Configuration

Working configuration fields only:

- Name
- Display Name
- Match Type
- Venue
- Surface
- Scheduled Date
- Scheduled Time
- Visibility
- Branding

**Excluded:**

- Lifecycle Status (runtime state — separate module)
- Home / Away / Team A / Player A labels
- Officials (Match Members)
- Score, toss, lineup

---

## 6. Match Side (first-class)

**Match Side is a first-class platform concept** — not a presentation label and not a direct Team/Participant child of Match.

```
Match
  → Match Side          (platform slot)
       → Team           OR
       → Participant
       → Roles (catalog)
```

Forbidden ownership shapes:

```
Match → Teams          ✗
Match → Participants   ✗
```

Why: every sport has sides, but they are not always “Home” and “Away”:

| Sport / format | Presentation labels (later) | Platform |
|----------------|----------------------------|----------|
| Cricket | Team A / Team B | `side_a` / `side_b` |
| Badminton singles | Player A / Player B | same |
| Doubles | Pair A / Pair B | same |
| Relay | Lane A / Lane B | same |
| Multi-team | Side N… | `side_c`… evolves |

Platform side ids: `side_a` | `side_b` (+ future `side_c`…).

**Rejected as platform ids/roles:** `home`, `away`, `team_a`, `team_b`, `player_a`, `player_b` — presentation labels only. Presentation Profile maps Side slots → Home/Away, Red/Blue, Left/Right, etc. later.

Concept in this epic (product types + bridges + `/sides` API). **No dedicated sides table** — runtime bridges map sport storage into Match Side views.

Team and Individual competitions use the same Side architecture.

---

## 7. Officials

Officials are **Match Members**, not Configuration (same principle as Captain in EPIC-04).

Catalog roles: `official` | `referee` | `umpire` | `scorer` | `observer` (+ future)

Constraints (`required`, `multipleAllowed`, `maxCount`) live on the catalog.

Exposed separately from Sides in Match View.

---

## 8. Match Lifecycle (separate module)

```
Draft → Scheduled → Ready → Locked → Live → Completed → Verified → Archived
```

- Independent of Tournament / Competition / Team / Registration
- Never stored inside Match Configuration product view
- `Archived` only after `Verified` (admin override out of scope / optional)

---

## 9. Validation

Validate:

- Competition compatibility
- **Competition State** before Match Ready (reference EPIC-03 — Competition must be Ready / locked; no duplicate competition logic)
- Team / Participant availability for sides
- Rule Profile / Presentation Profile compatibility (refs)
- Scheduling consistency (warnings; no scheduling engine)

No scoring validation.

---

## 10. Match View (modular)

Never one giant Match object. Separate:

1. Identity  
2. Configuration  
3. Sides  
4. Officials  
5. Validation  
6. History  

---

## 11. Lock pattern

```
Working Match Configuration
  → Validation
  → Lock
  → Configuration History
  → Execution (downstream)
```

History stores **locked configuration only** — never score, events, officials history, or roster history.

---

## 12. Storage

### Working on existing `scoring_matches` (additive)

- `match_type_id`
- `display_name`
- `surface`
- `visibility`
- `branding_json`
- `lifecycle_status` (lifecycle module storage — not Configuration)
- `configuration_locked`

Reuse: `match_label` (name), `venue`, `scheduled_at`, side team ids / side JSON for bridges.

**No new Match table.**

### History

`match_configuration_history` — append-only locked configurations.

---

## 13. APIs

```
GET    /tournaments/:id/matches/identities
GET    /tournaments/:id/matches/:matchId/identity
GET    /tournaments/:id/matches/:matchId/configuration
PATCH  /tournaments/:id/matches/:matchId/configuration
GET    /tournaments/:id/matches/:matchId/sides
GET    /tournaments/:id/matches/:matchId/officials
GET    /tournaments/:id/matches/:matchId/validation
GET    /tournaments/:id/matches/:matchId/history
GET    /tournaments/:id/matches/:matchId/lifecycle
POST   /tournaments/:id/matches/:matchId/ready
```

Existing `/scoring/*` and `/badminton/matches/*` remain runtime.

---

## 14. UI

Match Setup on Tournament Setup. One job = one screen. No scoring / scoreboard / timer / broadcast / OBS.

---

## 15. Migration

None. Bridges map current rows.

---

## 16. Explicitly forbidden

- New Match table
- Scoring in Match Identity
- Fixture as Match
- Schedule as Match
- Broadcast as Match
- Home/Away hardcoded into platform
- Runtime leakage
- Lifecycle duplicated inside Configuration
- Officials inside Configuration

---

## 17. Success criteria

BidWar has Platform Match Identity. Downstream modules consume Match View. No module creates another Match identity.
