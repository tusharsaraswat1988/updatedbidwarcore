# teamId=0 Impact Audit (P0 Merge)

**Date:** 2026-06-09  
**Branch:** `p0-merge-prep`  
**Verdict:** Acceptable for merge with documented residual risk.

## Where `teamId: 0` is written

| Location | Value | Purpose |
|----------|-------|---------|
| `badminton-service.ts` insert | `homeTeamId: 0`, `awayTeamId: 0` | Satisfies NOT NULL FK columns; badminton uses player sides, not auction teams |
| `buildScoringSideFromBadmintonSide()` | `teamId: 0` inside `homeSideJson` / `awaySideJson` | Placeholder in side JSON; real identity is `playerIds` + `displayName` |

## Cricket read paths (all guarded)

| Consumer | `sport_slug` filter | Tournament sport guard |
|----------|---------------------|------------------------|
| `scoring-service.ts` — list/get/live/create | `cricket` | `ensureTournamentScoring()` rejects non-cricket |
| `scoring-standings.ts` — rebuild | `cricket` | `ensureScoringEnabled()` rejects non-cricket |
| `scoring.ts` routes | Via service layer | Via service layer |
| Cricket frontend (`scoring-match*.tsx`, `pre-match-setup.tsx`) | N/A (API-only cricket data) | Hub only shows cricket block when `sport === "cricket"` |

Badminton rows with `homeTeamId: 0` are **invisible** to all cricket scoring and standings queries.

## Badminton read paths (scoped)

| Consumer | Isolation |
|----------|-----------|
| `badminton-service.ts` | `sportSlug = 'badminton'` + `tournamentId` on every match load |
| `badminton.ts` routes | URL tenant `:id` + service re-checks |
| Badminton frontend | Tournament hub + match pages under `/tournament/:id/badminton` |

## Residual risks (post-P0)

1. **Unguarded future queries** — Any new code selecting `scoring_matches` without `sport_slug` could surface `teamId: 0` rows. Mitigation: convention + code review; nullable FK migration deferred.
2. **`loadMatchEvents(matchId)`** — Cricket projector does not filter events by sport; safe today because `getScoringMatch` requires cricket row first. IDOR via cricket route with badminton match ID returns 404 (no cricket row).
3. **Standings UI** — Cricket standings never include badminton matches (sport filter + tournament sport check on hook).
4. **Auction / teams** — Unaffected; badminton does not reference `teams` table for match sides.

## ENABLE_BADMINTON deploy gate

- API: all `/api/tournaments/:id/badminton/*` return 404 when `ENABLE_BADMINTON !== "true"`.
- UI: tournament hub badminton card and badminton routes hidden unless `/api/settings/features` reports `badminton: true`.
- Per-tournament: `ensureBadmintonTournament()` still requires `tournament.sport === "badminton"`.

## Recommendation

Safe to merge. Monitor first badminton tournament in production with `ENABLE_BADMINTON=true` only on the deployment serving badminton events.
