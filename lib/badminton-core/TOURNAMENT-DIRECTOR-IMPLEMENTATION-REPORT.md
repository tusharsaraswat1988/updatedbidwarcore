# Tournament Director Mode — Implementation Report

**Date:** 2026-06-17  
**Scope:** Professional tournament control layer above umpire scoring

---

## Summary

Tournament Director Mode adds event-sourced match administration on top of the existing badminton scoring engine. Umpires/scorers continue to control points, timeouts, and intervals via PIN. Tournament Directors (and admins/organizers) manage pause/resume, incidents, outcomes, notes, and report export via a dedicated Match Control Center.

All director actions append auditable events with timestamp, actor type, actor ID, and payload. State is always reconstructed by replay — no silent mutations.

---

## New Role: Tournament Director

| Permission | Endpoint | PIN allowed? |
|------------|----------|--------------|
| Pause Match | `POST …/pause` | No |
| Resume Match | `POST …/resume` | No |
| Add Match Notes | `POST …/note` | No |
| Declare Walkover | `POST …/walkover` | No |
| Declare Retirement | `POST …/retirement` | No |
| Declare Disqualification | `POST …/disqualification` | No |
| Force End Match | `POST …/force-end` | No |
| Export Match Report | `GET …/report?format=json\|pdf` | No |
| View Incident Log | `GET …/incidents` | No |

**Auth model:**
- JWT claim: `tournamentDirector[tournamentId]: true` (new)
- Also granted to: `isAdmin`, `organizer[tournamentId]`
- Scorer PIN explicitly excluded from director routes

**Actor types on events:** `tournament_director`, `admin`, `organizer`

---

## Event Types Added

| Event | Payload |
|-------|---------|
| `badminton.match.paused` | `{ reason, detail? }` |
| `badminton.match.resumed` | `{ reason? }` |
| `badminton.match.note.added` | `{ text }` |

Existing events reused for outcomes: `retirement.declared`, `walkover.declared`, `disqualification.declared`, `match.ended`.

---

## Match Status

New status: **`paused`** — blocks umpire scoring until `MATCH_RESUMED`.

Terminal statuses now fully handled in snapshot updates: `completed`, `walkover`, `retired`, `disqualified`, `abandoned`.

---

## Core Module: `match-director.ts`

- `deriveIncidentLog(events)` — full timestamped timeline
- `deriveDirectorIncidents(events)` — director-relevant entries (no point-by-point noise)
- `buildMatchReport(state, events)` — JSON report structure
- `deriveDirectorStatusBanner(state)` — OBS/display banner derivation
- `formatPauseReason`, `formatRetirementReason`, `formatWalkoverReason`

---

## API Routes

```
POST /api/tournaments/:id/badminton/matches/:matchId/pause
POST /api/tournaments/:id/badminton/matches/:matchId/resume
POST /api/tournaments/:id/badminton/matches/:matchId/note
POST /api/tournaments/:id/badminton/matches/:matchId/disqualification
POST /api/tournaments/:id/badminton/matches/:matchId/force-end
GET  /api/tournaments/:id/badminton/matches/:matchId/incidents
GET  /api/tournaments/:id/badminton/matches/:matchId/report?format=json|pdf
```

Retirement and walkover moved from scorer guard to director guard.

---

## Frontend

| Component / Page | Path |
|------------------|------|
| `MatchControlCenter` | Embedded panel |
| `BadmintonMatchControlPage` | `/tournament/:id/badminton/matches/:matchId/control` |
| `DirectorStatusBanner` | OBS compact overlay, broadcast display |
| `useBadmintonDirector` | Hook for director POST actions |

Matches list includes **Control** button linking to Match Control Center.

---

## OBS / Display Integration

`DirectorStatusBanner` renders when match is:
- Paused (with reason, e.g. "Reason: Medical Timeout")
- Retired / Walkover / Disqualified / Completed / Abandoned

Umpire scoring blocked when `isPaused` or `matchStatus === "paused"`.

---

## Tests

**File:** `lib/badminton-core/src/match-director.test.ts`

| Test | Status |
|------|--------|
| Pause / Resume with reason in event log | ✅ |
| Retirement with result generation | ✅ |
| Walkover from scheduled | ✅ |
| Disqualification (reason required) | ✅ |
| Match notes in state and report | ✅ |
| Force end as abandoned | ✅ |
| Full replay integrity (pause → resume → note → retirement) | ✅ |
| JSON report export structure | ✅ |

Run: `npx vitest run src/match-director.test.ts` in `lib/badminton-core`

---

## Files Changed

### Core (`lib/badminton-core`)
- `src/types.ts` — paused status, director fields, actor type
- `src/events/badminton.ts` — new event types + schemas
- `src/commands.ts` — pause, resume, note, force-end, disqualification
- `src/reducer/reducer.ts` — apply new events
- `src/reducer/state.ts` — initial state defaults
- `src/match-director.ts` — timeline, report, banners (new)
- `src/match-director.test.ts` — test suite (new)
- `src/scoring/umpire-assistance.ts` — pause scoring block
- `src/sync-snapshot.ts` — pause fields in sync snapshot
- `src/index.ts` — export match-director

### API (`artifacts/api-server`)
- `src/lib/jwt.ts` — `tournamentDirector` claim
- `src/lib/badminton-service.ts` — director handlers
- `src/lib/badminton-match-report.ts` — PDF generation (new)
- `src/routes/badminton.ts` — director guard + routes

### Frontend (`artifacts/auction-platform`)
- `src/components/badminton/match-control-center.tsx` (new)
- `src/components/badminton/director-status-banner.tsx` (new)
- `src/pages/badminton/match-control.tsx` (new)
- `src/hooks/use-badminton-match.ts` — `useBadmintonDirector`
- `src/pages/badminton/matches.tsx` — Control link
- `src/components/badminton/obs-overlays.tsx` — banner
- `src/components/badminton/broadcast-display.tsx` — banner
- `src/App.tsx` — route

---

## Assigning Tournament Directors

Set JWT claim when signing auth token:

```typescript
signAuthJwt({
  organizerAccountId: 123,
  tournamentDirector: { "42": true }, // tournament ID 42
});
```

Organizers for a tournament automatically receive director permissions without a separate claim.

---

## Audit Trail

Every director action creates a row in `scoring_events` with:
- `sequence` (monotonic)
- `occurredAt` (timestamp)
- `actorType` / `actorId`
- `eventType` + `payloadJson`

Replay via `replayBadmintonEvents()` reconstructs identical state on all surfaces (operator, OBS, display, report).
