---
name: bidwar_architecture_skill
description: Permanent architecture & engineering contract for BidWar. Mandatory reference for architectural, database, API, routing, authentication, UI, performance, refactoring, and module-boundary changes across tournaments, members, auctions, and sports scoring.
---

# BIDWAR — PERMANENT ARCHITECTURE & ENGINEERING SKILL

> **Purpose:** This file is a permanent engineering contract for Antigravity and any AI/developer working inside the BidWar codebase.
>
> **Rule:** Read this file before making architectural, database, API, routing, authentication, UI, performance, or module-boundary changes.
>
> This document defines the intended architecture. Existing code may contain legacy behavior that conflicts with these rules. In such cases, **do not blindly preserve legacy architecture**. Identify it, document it, and refactor toward this contract.

---

## 1. Core Principle
BidWar is a sports management platform with independent product modules.
A Tournament is NOT inherently an Auction tournament.
The platform must support:
- Auction only
- Sports Scoring only
- Auction + Sports Scoring
- Future modules without redesigning the core architecture

The following concepts must remain independent:
- Member
- Organizer
- Tournament
- Auction
- Sports Scoring
- Sport-specific Scoring
- Team
- Player / Participant
- Competition Format
- Statistics
- Roles and Permissions

Never create architecture where one module is the parent of another simply because that was true in an older version of BidWar.

---

## 2. Product Architecture
The conceptual platform hierarchy is:

```text
BIDWAR
│
├── Member Identity
│   ├── Players
│   ├── Umpires
│   ├── Scorers
│   ├── Fans
│   ├── Live Streamers
│   ├── Associates
│   ├── Mentors
│   └── Future Roles
│
├── Organizer Capability
│
├── Tournaments
│   │
│   ├── Auction
│   │
│   ├── Sports Scoring
│   │   ├── Cricket Scoring
│   │   ├── Badminton Scoring
│   │   └── Future Sports
│   │
│   └── Other Future Modules
│
├── Teams
│
└── Statistics / History
```

This is a conceptual model, not necessarily a database tree.

### Critical rule
Auction and Sports Scoring are sibling product modules.
- Scoring must never require Auction to exist.
- Auction must never require Scoring to exist.

A tournament may enable:
```text
AUCTION
SCORING
BOTH
```

The implementation should derive this state from explicit module flags rather than treating it as a permanent tournament type.

---

## 3. Member Identity Is Foundational
BidWar must have a single global Member identity.
A human must never need separate identities for:
- Player
- Umpire
- Scorer
- Fan
- Live Streamer
- Associate
- Mentor
- Coach
- Team Manager
- Official
- Sponsor/Partner
- Future roles

A person has one BidWar Member ID.
Their capabilities and participation are represented through relationships, roles, sport profiles, and tournament participation.

### Correct
```text
Member
 ├── Sport Profile: Cricket
 ├── Sport Profile: Badminton
 ├── Role: Player
 ├── Role: Scorer
 └── Role: Umpire
```

### Incorrect
```text
CricketPlayerAccount
BadmintonPlayerAccount
ScorerAccount
UmpireAccount
FanAccount
```

Do not create separate human identities for each role.

---

## 4. Member ≠ Organizer ≠ Tournament
These are different concepts.

- **Member**: Represents the person/account.
- **Organizer**: Represents a capability/relationship that allows a Member to create and manage tournaments.
  - A Member may become an Organizer without becoming a different person/account.
- **Tournament**: Represents a competition/event created or managed by an Organizer.

Therefore:
```text
Member
   │
   ├── organizer capability
   │
   └── participates in many tournaments
```

- Do not duplicate Member records when the same person participates in multiple tournaments.
- Do not create a new identity merely because a Member changes role.

---

## 5. Sport Profiles
Player information must be sport-aware without polluting the core Member table.
Prefer a model conceptually similar to:
```text
members
member_sports / sport_profiles
member_roles
tournament_members / participations
```

A Member may have:
```text
Member A
 ├── Cricket Profile
 ├── Badminton Profile
 └── Football Profile
```

Do NOT add columns such as:
```text
cricketRuns
cricketWickets
badmintonWins
footballGoals
```
to the core Member table.
Sport-specific information belongs in sport-specific/profile/stat structures.
This is necessary because BidWar will expand to more sports.

---

## 6. Player Is a Role / Participation, Not a Separate Person
A player is still a Member.
For example:
```text
Member
  ↓
Cricket Player
  ↓
Tournament Participation
  ↓
Team
```

The same Member may be:
```text
Cricket Player
Badminton Player
Scorer
Umpire
Fan
```
at the same time or across different contexts.
Do not model `Player` as a completely separate identity system.

---

## 7. Tournament Module Selection
When creating a tournament, the organizer should explicitly choose the enabled product modules.
Conceptually:
```text
Tournament
│
├── Auction: ON/OFF
└── Sports Scoring: ON/OFF
```

This creates:
- **Auction Only**: `Auction = ON`, `Scoring = OFF`
- **Scoring Only**: `Auction = OFF`, `Scoring = ON`
- **Both**: `Auction = ON`, `Scoring = ON`

### Important
Do NOT use a single legacy field such as `licenseType` as the permanent source of truth for product architecture.
If legacy fields exist, they should be migrated away from as the primary domain model.

---

## 8. Module State Must Be Explicit
For core product modules, use explicit persisted state.
Recommended conceptual fields:
```text
auction_enabled
scoring_enabled
```

The combined product mode should be derived, not stored redundantly.
Example:
```text
auction_enabled = true, scoring_enabled = false → auction_only
auction_enabled = false, scoring_enabled = true → scoring_only
auction_enabled = true, scoring_enabled = true  → both
```

Avoid storing:
```text
mode = "both"
```
as the primary source of truth if it can become inconsistent with the actual module flags.

---

## 9. Product and Competition Format Are Different
Do not confuse:
- **Product modules**: `Auction`, `Sports Scoring`, `Both`
with:
- **Competition formats**: `Auction`, `Registered Teams`, `Hybrid`, `Practice`, `Future Formats`

A tournament can use Sports Scoring without Auction.
A tournament can use Auction without Sports Scoring.
A competition format such as `Hybrid` must not automatically mean that the Sports Scoring product is enabled.
Keep these concepts separate at database, API, UI, and business-logic levels.

---

## 10. Sport Capability
Auction is intended to be a cross-sport platform capability.
Sports Scoring is currently sport-dependent.
Current supported scoring sports:
```text
Cricket
Badminton
```
Future sports must be possible without restructuring the platform.
For unsupported sports:
```text
Auction → Available
Sports Scoring → Coming Soon / Disabled
Both → Not available until scoring is supported
```
The UI must not be the only enforcement layer.
The backend must validate whether the requested sport supports the requested module.

---

## 11. Tournament Creation
Tournament creation should conceptually follow:
```text
1. Tournament Details
   ├── Name
   ├── Sport
   ├── Location
   ├── Venue
   └── Other basic information

2. Select Product Modules
   ├── Auction
   ├── Sports Scoring
   └── Both

3. Configure Selected Modules
   ├── Auction settings if Auction enabled
   └── Scoring settings if Scoring enabled

4. Configure Competition Format
   └── Separate from module selection

5. Create Tournament
```

Do not load or validate irrelevant module configuration.
For example:
- **Scoring-only tournament** → do not require Auction configuration
- **Auction-only tournament** → do not require Scoring configuration

---

## 12. Generic Tournament Home
The canonical tournament entry point should be neutral and lightweight.
Conceptually:
```text
/tournament/:id
```
This page represents the Tournament and its available modules.
It should NOT be an Auction page disguised as a tournament page.
It should show appropriate module entry points such as:
```text
Tournament
├── Auction
├── Sports Scoring
├── Teams
├── Players / Participants
├── Settings
└── Other enabled features
```
Only show modules enabled for that tournament.

---

## 13. Auction Must Be Independent
Auction should have its own workspace.
Conceptually:
```text
/tournament/:id/auction
```
The Auction application should:
- load Auction-specific code
- load Auction-specific APIs
- load Auction-specific state
- load Auction-specific realtime systems
- not initialize Sports Scoring unnecessarily

A scoring-only tournament must never load Auction as a hidden dependency.

---

## 14. Sports Scoring Must Be Independent
Sports Scoring should have its own application/workspace.
Conceptually:
```text
/tournament/:id/scoring
```
Sport-specific scoring is selected beneath this boundary:
```text
Sports Scoring
├── Cricket Scoring
├── Badminton Scoring
└── Future Sports
```

A scoring-only tournament must work perfectly without Auction.
A tournament with both modules may connect Auction output to scoring inputs, but this must be an integration relationship, not a hard dependency.

---

## 15. Auction → Scoring Integration
When both modules are enabled, Auction may provide:
```text
Auctioned Player
→ Team Assignment
→ Tournament Roster
→ Scoring Eligibility
```
But Scoring must also support:
```text
Direct Player Registration
→ Team Assignment
→ Scoring
```
Therefore:
```text
Auction ───────┐
               ├──> Tournament Team / Roster
Direct Entry ──┘
               ↓
          Sports Scoring
```
This allows:
- Auction + Scoring tournaments
- Scoring-only tournaments
- Auction-only tournaments
without duplicating scoring logic.

---

## 16. Performance Isolation Is Mandatory
A major architectural requirement is to prevent unnecessary module loading.

Opening **Organizer Home** must NOT automatically load:
- Cricket Scoring bundle
- Badminton Scoring bundle
- Scoring APIs
- Scoring SSE/WebSocket connections
- Scoring polling
- Scoring data
- Scoring preload chunks

Opening **Tournament Home** must remain lightweight.
Opening **Auction** must not load the full Sports Scoring application.
Opening **Sports Scoring** may load the required scoring code.

### Rule
Load heavy functionality at the point of use, not at the platform root.

---

## 17. Lazy Loading
Use route-level and module-level lazy loading wherever practical.
Do not import large scoring modules into generic Organizer/Tournament components merely to decide whether the module exists.

Prefer:
```text
Tournament Home
  ↓
User clicks Sports Scoring
  ↓
Load scoring application
  ↓
Load sport-specific scoring module
```
not:
```text
Tournament Home
  ↓
Load entire scoring application
  ↓
Maybe user opens scoring later
```

Review all:
- dynamic imports
- eager imports
- preload functions
- route loaders
- React providers
- global hooks
- API calls
- SSE/WebSocket initialization
- polling timers
that may accidentally pull scoring into unrelated pages.

---

## 18. Cricket and Badminton Scoring Isolation
Cricket and Badminton are separate scoring domains.
Do not create a single giant scoring component containing every sport.

Prefer:
```text
Sports Scoring Core
│
├── Cricket Scoring
│   ├── Cricket rules
│   ├── Cricket events
│   ├── Cricket statistics
│   └── Cricket UI
│
├── Badminton Scoring
│   ├── Badminton rules
│   ├── Badminton events
│   ├── Badminton statistics
│   └── Badminton UI
│
└── Future Sports
```

Common infrastructure may be shared:
- authentication
- tournament access
- member identity
- team identity
- match identity
- event infrastructure
- audit logs
- realtime infrastructure

Sport rules must remain sport-specific.

---

## 19. Statistics Architecture
BidWar must maintain long-term sport-wise statistics for Members/Players.
Statistics must distinguish at least:

### Auction Statistics
Examples:
```text
auction appearances
times sold
highest bid
total auction value
teams acquired for
auction history
```

### Sports Performance Statistics
Examples for Cricket:
```text
matches
innings
runs
average
strike rate
wickets
economy
catches
etc.
```

Examples for Badminton:
```text
matches
wins
losses
points
sets
tournament results
etc.
```

Do not mix Auction economics with Sports performance.
A player's auction price is not a sports performance statistic.

---

## 20. Tournament Participation
A Member can participate in many tournaments.
Use relationship/participation records rather than duplicating Member identities.
Conceptually:
```text
Member
   ↓
Tournament Participation
   ↓
Team / Role / Sport / Status
```

The same Member can have different roles in different tournaments.
Example:
```text
Tournament A → Member = Player
Tournament B → Member = Scorer
Tournament C → Member = Umpire
```
The identity remains the same.

---

## 21. Roles Must Be Extensible
Do not hard-code a single role column such as `member_type = player`.
The platform must be capable of multiple roles:
- Player
- Umpire
- Scorer
- Fan
- Live Streamer
- Associate
- Mentor
- Coach
- Team Manager
- Official
- Sponsor/Partner
- Organizer
- Future Roles

A Member may have multiple roles.
Role scope may eventually be: `Global`, `Sport`, `Tournament`, `Team`, `Match`.
Do not redesign the identity system every time a new role is introduced.

---

## 22. Organizer Authorization
Organizer capability and module authorization are separate concerns.
A backend route should conceptually enforce:
```text
Is authenticated?
        ↓
Is Member authorized for this Tournament?
        ↓
Is requested module enabled?
        ↓
Is requested sport supported?
        ↓
Allow operation
```

Do not rely solely on frontend visibility. Reusable authorization primitives:
```text
requireTournamentOrganizer(...)
requireTournamentModule("auction")
requireTournamentModule("scoring")
```

---

## 23. API Design
APIs should be module-aware.
Prefer:
```text
GET /api/tournaments/:id
GET /api/tournaments/:id/auction/...
GET /api/tournaments/:id/scoring/...
```
rather than making every tournament API implicitly depend on Auction or Scoring.
Tournament summary APIs should be lightweight.
Do not return massive scoring payloads from generic tournament endpoints unless explicitly required.

---

## 24. Data Loading Rules
Generic endpoints should return only what the current screen needs.
Avoid loading tournament + auction + scoring + cricket matches + badminton matches + player stats + live events + SSE when the user has only opened the tournament home.

Prefer:
```text
Tournament Home
→ tournament summary
→ enabled modules
→ lightweight counts/status
```
Then load module data after entering that module.

---

## 25. Realtime Systems
SSE/WebSocket/realtime subscriptions must be scoped to the active module and screen.
- Do not initialize Cricket scoring realtime when on Organizer Home, Auction, or Tournament Settings.
- Clean up subscriptions on unmount/navigation.

---

## 26. Database Design Principles
Before changing schema:
1. Inspect current schema.
2. Inspect all migrations.
3. Inspect all creation paths.
4. Inspect all readers of the affected field.
5. Inspect all writers of the affected field.
6. Identify legacy fields.
7. Identify inconsistent existing data.
8. Prepare a migration/backfill plan.
9. Only then change schema.

Never add a new field and immediately assume old data is consistent.

---

## 27. Migration Safety
Existing tournaments may contain mixed legacy signals.
Before backfilling a new module field, generate an audit report containing at minimum:
```text
Tournament ID
Sport
scoring_enabled
auction-related fields
competition type
legacy license/product fields
player registration mode
inferred current behavior
proposed new module state
```
Review ambiguous cases before destructive migration.
Never silently convert historical tournaments based on an unverified assumption.

---

## 28. Legacy Code Policy
Legacy code is evidence, not architecture.
When you find old routing, old license fields, old tournament modes, duplicated auth/member identities, auction-dependent scoring, or deprecated feature flags:
```text
Identify → Document → Determine intended replacement → Migrate safely → Remove obsolete dependency → Test
```
Do not create another abstraction layer merely to hide an architectural problem.

---

## 29. Avoid Duplicate Systems
Before creating a new authentication system, player model, member model, role model, tournament mode, feature flag, scoring session, team model, stats table, or authorization helper: **search the repository first**.
- If an existing system is reusable and architecturally correct, extend it.
- If an existing system is architecturally wrong, do not duplicate it just because migration is difficult.

---

## 30. Source of Truth
Every important domain concept must have one clear source of truth:
```text
Member identity          → Member system
Tournament identity        → Tournament system
Auction enabled            → Tournament module configuration
Scoring enabled            → Tournament module configuration
Sport                      → Tournament / Sport model
Player identity            → Member + sport profile
Tournament participation   → Participation relationship
Auction history            → Auction domain
Sports performance         → Scoring/statistics domain
```
Avoid multiple fields that can independently claim contradictory states.

---

## 31. Frontend Architecture
Frontend components must respect domain boundaries:
```text
shared/
auction/
scoring/
scoring/cricket/
scoring/badminton/
```
Shared components should contain genuinely shared behavior. Do not move module-specific logic into shared code just because two modules currently use it.

---

## 32. Routing Rules
Canonical routing should make product boundaries obvious:
```text
/tournament/:id                    → Tournament Home
/tournament/:id/auction            → Auction
/tournament/:id/scoring            → Sports Scoring
/tournament/:id/scoring/cricket    → Cricket Scoring
/tournament/:id/scoring/badminton  → Badminton Scoring
```
When changing routes:
- preserve valid legacy deep links where necessary
- redirect safely
- do not break bookmarks
- do not create duplicate route implementations
- test direct navigation, refresh, authentication, and base paths

---

## 33. Navigation Rules
Navigation must reflect enabled modules:
```text
Tournament
│
├── Auction       [if enabled]
├── Sports Scoring [if enabled + sport supported]
├── Teams
├── Players
└── Settings
```
Do not show a module merely because the platform supports it globally.

---

## 34. Platform Capability vs Tournament Enablement
```text
Module Available =
Platform Supports Module
AND
Tournament Enables Module
AND
Sport Supports Module
AND
User Is Authorized
```

---

## 35. Testing Requirements
Every architectural change must include tests appropriate to the affected boundary:
- **Tournament creation**: Auction only, Scoring only, Both, Unsupported scoring sport.
- **Authorization**: Organizer + enabled module, Organizer + disabled module, Non-organizer, Unauthenticated user.
- **Routing**: Tournament Home, Auction, Sports Scoring, Cricket Scoring, Badminton Scoring, Legacy deep links.
- **Performance**: Verify Tournament Home and Auction do NOT initialize scoring resources. Verify Sports Scoring does initialize required resources.
- **Data**: Verify Auction-only works without scoring, Scoring-only works without auction, Both integrates correctly.

---

## 36. Before Every Major Change
Antigravity must answer:
1. What domain concept is changing?
2. What is the current source of truth?
3. What code writes it?
4. What code reads it?
5. What APIs expose it?
6. What database tables store it?
7. What frontend routes consume it?
8. What legacy behavior depends on it?
9. What modules should remain independent?
10. What existing users/tournaments could be affected?
11. What migration is required?
12. What tests prove the change is safe?

---

## 37. Required Change Workflow
```text
PHASE A — DISCOVER
Read relevant code → Map dependencies → Identify source of truth → Identify legacy behavior

PHASE B — DESIGN
Define target architecture → DB changes → API changes → Frontend/routing changes → Migration strategy → Tests

PHASE C — IMPLEMENT
Make smallest coherent change → Keep module boundaries intact → Avoid unrelated refactors

PHASE D — VERIFY
Typecheck → Lint → Unit tests → Integration tests → Build → Route verification → Performance verification

PHASE E — REVIEW
Check duplicate systems → Check legacy dependencies → Check unintended imports → Check DB consistency → Check Git diff → Check migration safety
```

---

## 38. Never Make These Architectural Mistakes
Never:
1. Make Auction the parent of Tournament.
2. Make Scoring depend on Auction.
3. Make Auction depend on Scoring.
4. Create separate human identities for every role.
5. Create separate Player identities for every sport.
6. Store all sport statistics directly on Member.
7. Store Cricket and Badminton rules in one giant generic rules engine.
8. Use frontend-only checks for module authorization.
9. Load all scoring code on Organizer Home.
10. Load scoring code on Auction pages unnecessarily.
11. Start realtime scoring connections globally.
12. Conflate product modules with competition formats.
13. Use legacy `licenseType` as the permanent product architecture.
14. Add another duplicate authentication system without a documented architectural reason.
15. Add duplicate member/player tables to work around migration difficulty.
16. Introduce a new mode field when it can be derived safely from module flags.
17. Perform destructive migrations without auditing existing data.
18. Fix one screen while leaving the same architectural dependency elsewhere.

---

## 39. Future-Proofing
The architecture must grow toward more sports, roles, competition formats, product modules, statistics, and broadcast features without redesigning Member Identity, Tournament Identity, Organizer Identity, or Auction architecture.

---

## 40. Product Independence
BidWar must support:
- Customer A → Auction only
- Customer B → Sports Scoring only
- Customer C → Auction + Sports Scoring
without code duplication.

---

## 41. Member Statistics Must Survive Module Independence
```text
Member
  │
  ├── Cricket Profile
  │
  ├── Auction History (Tournament A, Tournament C)
  │
  └── Cricket Performance (Tournament B, Tournament C)
```
Auction and scoring may be independent products, but Member history remains unified.

---

## 42. Observability and Debugging
Identify the layer before changing code:
`Identity` → `Authorization` → `Tournament` → `Module Enablement` → `Sport Capability` → `Routing` → `API` → `Domain Logic` → `Database` → `Realtime` → `Frontend State` → `UI`.

---

## 43. Performance Investigation
For any performance issue, inspect bundle size, import graph, dynamic imports, route chunks, React providers, global hooks, polling, SSE, WebSockets, API waterfalls, duplicate requests, unnecessary re-renders, preload behavior, caching, and database queries.

---

## 44. Git Discipline
Before declaring complete:
- Run `git status`, `git diff`, `git diff --stat`.
- Confirm intended files changed, no secrets, no unrelated refactors, migrations and tests included.

---

## 45. Documentation Discipline
Document what changed, why it changed, source of truth, migration requirements, compatibility considerations, testing performed, and known limitations.

---

## 46. When Existing Code Conflicts With This File
Follow priority:
1. Data integrity
2. Security / authorization
3. Clear domain boundaries
4. Backward compatibility
5. Performance isolation
6. Maintainability
7. UI convenience

---

## 47. Required Mental Model
```text
MEMBER
   ↓
CAPABILITIES / ROLES
   ↓
SPORT PROFILES
   ↓
TOURNAMENT PARTICIPATION
   ↓
TOURNAMENT
   │
   ├── AUCTION
   │
   ├── SPORTS SCORING (CRICKET, BADMINTON, ...)
   │
   ├── TEAMS
   │
   └── OTHER MODULES
```

---

## 48. Final Rule
Before adding code, understand the domain boundary.
Before adding a table, identify the source of truth.
Before adding a role, check whether Member Identity already supports it.
Before adding a module, make it independently usable.
Before loading a module, confirm the user actually entered that module.
Before changing historical data, audit it.
Before declaring success, test the complete flow and verify the Git diff.
BidWar should evolve as a platform, not as a collection of patches.

---

## Architecture North Star

```text
                         BIDWAR
                            │
              ┌─────────────┴─────────────┐
              │                           │
        MEMBER IDENTITY              ORGANIZER
              │                           │
      ┌───────┼────────┐                  │
      │       │        │                  │
   Roles   Sports   History               │
           Profiles                       │
              │                           │
              └────────────┬──────────────┘
                           │
                       TOURNAMENT
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          AUCTION      SPORTS SCORING   OTHER
                           │
                    ┌──────┴──────┐
                    │             │
                 CRICKET      BADMINTON
                    │             │
                    └──────┬──────┘
                           │
                      STATISTICS
                           │
                    MEMBER HISTORY
```
This architecture must remain the default direction for future BidWar development unless a deliberate architectural decision explicitly supersedes it.
