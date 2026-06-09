# API Layer Audit

**Stack:** Express (`artifacts/api-server`), mounted at `/api`  
**Contract:** OpenAPI for auction APIs (`lib/api-spec/openapi.yaml`); scoring/badminton hand-maintained

---

## Routing Architecture

| Router | Mount (main) | Mount (badminton branch) | Rating |
|--------|--------------|--------------------------|--------|
| `auction.ts` | `/api/tournaments/:tid/auction/*` | Unchanged | **PASS** |
| `scoring.ts` | `/api/tournaments/:tid/scoring/*` | Unchanged | **PASS** (cricket only) |
| `badminton.ts` | N/A | `/api/tournaments/:id/badminton/*` | **PASS** (isolated) |
| `tournaments.ts` | `/api/tournaments/*` | Unchanged | **WARNING** (cricket scoring gate) |

**Evidence:** Badminton branch adds 2 lines to `routes/index.ts` — purely additive mount.

---

## Cricket Scoring API (`/scoring/*`)

### Endpoints

| Method | Path | Auth | Rating |
|--------|------|------|--------|
| GET | `/tournaments/:tid/scoring/standings` | Public | **PASS** |
| GET | `/tournaments/:tid/scoring/squads` | Organizer/admin | **WARNING** (auction squad model) |
| GET | `/tournaments/:tid/scoring/live` | Public | **PASS** |
| GET | `/tournaments/:tid/scoring/events` | Public (SSE) | **PASS** |
| GET | `/tournaments/:tid/scoring/matches` | Organizer/admin | **PASS** |
| POST | `/tournaments/:tid/scoring/matches` | Organizer/admin | **WARNING** (cricket-only) |
| GET | `/tournaments/:tid/scoring/matches/:mid` | Organizer/admin | **PASS** |
| POST | `/tournaments/:tid/scoring/matches/:mid/events` | Organizer/admin/PIN | **PASS** |
| POST | `/tournaments/:tid/scoring/matches/:mid/undo` | Organizer/admin/PIN | **PASS** |

### Cricket-specific assumptions

| Assumption | Evidence | Rating |
|------------|----------|--------|
| `tournament.sport !== "cricket"` → 400 | `scoring-service.ts:131` | **FAIL** for multi-sport |
| `homeTeamId`/`awayTeamId` required | `createScoringMatch` | **WARNING** |
| `rules.overs`, `rules.maxWickets` | `matchToJson`, create match | **FAIL** |
| Squads from auction sold/retained players | `scoring-standings.ts` | **WARNING** |
| `scoring_enabled` gate | `ensureTournamentScoring` | **PASS** |
| Tournament-level `scoringPin` | `canWriteScoring` | **PASS** |
| Generic event POST | `cricket.*` event types in body | **PASS** (extensible transport) |

### Auth model — **WARNING**

- `isOrganizerOrAdmin(req, tournamentId)` — broad organizer access
- Badminton uses stricter `isTournamentOwner` — production should adopt badminton's IDOR pattern

---

## Badminton API (`/badminton/*`)

### Endpoints (branch)

| Method | Path | Auth | Rating |
|--------|------|------|--------|
| GET | `/stream?matchId=` | Public (SSE) | **PASS** |
| GET/POST/PATCH/DELETE | `/players`, `/players/:id` | Read public / write owner | **PASS** |
| GET/POST/PATCH/DELETE | `/courts`, `/courts/:id` | Same | **PASS** |
| GET/POST/PATCH | `/categories`, `/categories/:id` | Same | **PASS** |
| GET/POST | `/categories/:id/registrations` | Same | **PASS** |
| GET | `/fixtures` | Public | **PASS** |
| POST | `/categories/:id/generate-draw` | Owner | **PASS** |
| GET/POST | `/matches` | Same | **PASS** |
| GET | `/matches/:matchId` | Public | **PASS** |
| POST | `/matches/:matchId/start` | Owner/scorer PIN | **PASS** |
| POST | `/matches/:matchId/point` | Owner/scorer PIN | **PASS** |
| POST | `/matches/:matchId/undo` | Owner/scorer PIN | **PASS** |
| POST | `/matches/:matchId/timeout` | Owner/scorer PIN | **PASS** |
| POST | `/matches/:matchId/retirement` | Owner/scorer PIN | **PASS** |
| POST | `/matches/:matchId/walkover` | Owner/scorer PIN | **PASS** |
| GET | `/dashboard` | Public | **PASS** |

### Design differences from cricket

| Aspect | Cricket | Badminton | Verdict |
|--------|---------|-----------|---------|
| Event ingress | Generic `POST .../events` | Semantic `POST .../point` | **WARNING** — two styles |
| Command layer | Client sends raw events | Server runs `cmdAwardPoint` | **PASS** — better for badminton |
| Scorer PIN | Tournament `scoringPin` | Per-match `scorerPin` | **WARNING** |
| Tenant guard | Route param only | `getMatchMeta(matchId, tournamentId)` | **PASS** (badminton better) |
| `scoring_enabled` | Required | Not checked | **WARNING** |
| OpenAPI | Not documented | Not documented | **FAIL** |

**Evidence:** `badminton-service.ts` header documents tenant-isolation contract.

---

## Auction API — **PASS**

Independent product module. ~40 endpoints under `/auction/*`. SSE at `/auction/events`. No sport assumptions in bid flow.

Key files:
- `artifacts/api-server/src/routes/auction.ts`
- `artifacts/api-server/src/lib/broadcast.ts`

---

## Analytics API — **WARNING**

| Endpoint area | Cricket assumptions |
|---------------|---------------------|
| `/analytics/*` | Auction-focused |
| `/intelligence/*` | Auction bid intelligence |
| Scoring standings | NRR, team-based |

No badminton analytics API beyond `/badminton/dashboard`.

---

## Registration API — **WARNING**

| Flow | API | Sport |
|------|-----|-------|
| Auction player registration | `POST /tournaments/:id/players/register` | Cricket fields (batting_style, etc.) |
| Badminton category registration | `POST .../badminton/categories/:id/registrations` | Separate |

Two unrelated registration models. Acceptable for optional modules; not unified.

---

## Side-by-Side API Comparison

| Concern | Cricket | Badminton | Multi-sport ready? |
|---------|---------|-----------|-------------------|
| Namespace | `/scoring` | `/badminton` | **WARNING** — per-sport prefix scales linearly |
| Event transport | Raw events | Commands → events | **WARNING** |
| Match CRUD | In scoring router | In badminton router | **WARNING** |
| Live read | `/scoring/live` | `/matches/:id` + SSE | **WARNING** |
| Standings | `/scoring/standings` | None | **FAIL** |
| Draws/fixtures | None | Full CRUD | N/A |
| Error codes | `UNSUPPORTED_SPORT`, `SEQUENCE_CONFLICT` | `BadmintonServiceError` codes | **WARNING** — inconsistent |

---

## Target API Shape (minimal, not over-engineered)

For cricket + badminton coexistence, **do not** unify into one mega-router yet. Accept:

```
/api/tournaments/:tid/scoring/*     → cricket (unchanged)
/api/tournaments/:tid/badminton/* → badminton (unchanged)
```

### P0 API fixes before merge

1. Port `getMatchMeta(expectedTournamentId)` IDOR pattern to cricket `scoring-service.ts`.
2. Document both APIs in OpenAPI (even if separate tags).
3. Standardize error response shape (`{ error, code }`).

### P1 (before sport #3)

4. Introduce thin dispatcher only if needed:
   ```
   GET /api/tournaments/:tid/matches/:mid/live
   → dispatch by match.sport_slug
   ```
5. Unify SSE entry point (see streaming audit).

---

## Risks

| Risk | Impact |
|------|--------|
| OpenAPI drift | Frontend hand-writes `scoring-api.ts`; badminton uses inline fetch |
| Semantic vs generic endpoints | Sport #3 must choose a pattern |
| Auth inconsistency | Operator confusion, security review burden |
| No API versioning | Event schema changes could break clients |

---

## Recommendations

| Priority | Action |
|----------|--------|
| P0 | Adopt badminton tenant guards in cricket |
| P0 | Add OpenAPI tags: `Scoring/Cricket`, `Scoring/Badminton` |
| P1 | Shared error code enum across services |
| P2 | Optional unified live endpoint at sport #3 |
| Defer | Generic `/sports/:slug/*` router until 3+ sports |

---

## Subsystem Ratings

| Subsystem | Cricket | Badminton | Combined |
|-----------|---------|-----------|----------|
| REST design | PASS | PASS | WARNING |
| Auth / tenancy | WARNING | PASS | WARNING |
| Event ingress | PASS | PASS | WARNING |
| OpenAPI coverage | FAIL | FAIL | FAIL |
| Auction independence | PASS | PASS | PASS |
| Multi-sport dispatch | FAIL | FAIL | FAIL |
