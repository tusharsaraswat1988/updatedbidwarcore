import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cricket match delete and edit contract", () => {
  const serviceSource = readFileSync(
    resolve(__dirname, "../lib/scoring-service.ts"),
    "utf8",
  );
  const routeSource = readFileSync(
    resolve(__dirname, "../routes/scoring.ts"),
    "utf8",
  );

  describe("deleteCricketMatch contract", () => {
    const start = serviceSource.indexOf("export async function deleteCricketMatch");
    const next = serviceSource.indexOf("\nexport async function", start + 1);
    const deleteFn = serviceSource.slice(start, next === -1 ? serviceSource.length : next);

    it("requires match to be in scheduled status and have no startedAt time", () => {
      expect(deleteFn).toContain('match.status !== "scheduled"');
      expect(deleteFn).toContain("match.startedAt !== null");
      expect(deleteFn).toContain("MATCH_ALREADY_STARTED");
    });

    it("verifies no MATCH_STARTED or BALL_RECORDED events exist prior to deletion", () => {
      expect(deleteFn).toContain("CricketEventType.MATCH_STARTED");
      expect(deleteFn).toContain("CricketEventType.BALL_RECORDED");
      expect(deleteFn).toContain("TOSS_ALREADY_CONDUCTED");
    });

    it("checks session state tossWinnerTeamId before deletion", () => {
      expect(deleteFn).toContain("state.tossWinnerTeamId != null");
    });

    it("performs transactional cascade across dependent scoring tables", () => {
      expect(deleteFn).toContain("await db.transaction(async (tx) =>");
      expect(deleteFn).toContain(".delete(scoringEventsTable)");
      expect(deleteFn).toContain(".delete(scoringSessionsTable)");
      expect(deleteFn).toContain(".delete(scoringMatchSquadsTable)");
      expect(deleteFn).toContain(".delete(scoringMatchesTable)");
      expect(deleteFn).toContain(".delete(scoringFixturesTable)");

      const sessionIdx = deleteFn.indexOf(".delete(scoringSessionsTable)");
      const matchIdx = deleteFn.indexOf(".delete(scoringMatchesTable)");
      const fixtureIdx = deleteFn.indexOf(".delete(scoringFixturesTable)");
      expect(sessionIdx).toBeLessThan(matchIdx);
      expect(matchIdx).toBeLessThan(fixtureIdx);
    });

    it("exposes DELETE /tournaments/:tournamentId/scoring/matches/:matchId route with organizer auth", () => {
      expect(routeSource).toContain('router.delete("/tournaments/:tournamentId/scoring/matches/:matchId"');
      expect(routeSource).toContain("requireTournamentOrganizer");
      expect(routeSource).toContain("await deleteCricketMatch(tournamentId, matchId)");
      expect(routeSource).toContain("res.status(204).send()");
    });
  });

  describe("updateScoringMatch post-toss/post-score editing contract", () => {
    const start = serviceSource.indexOf("export async function updateScoringMatch");
    const next = serviceSource.indexOf("\nexport async function", start + 1);
    const updateFn = serviceSource.slice(start, next === -1 ? serviceSource.length : next);

    it("allows editing display metadata on live/completed matches while locking team changes", () => {
      expect(updateFn).toContain("TEAMS_LOCKED_AFTER_START");
      expect(updateFn).toContain("input.roundName !== undefined");
      expect(updateFn).toContain("input.venue !== undefined");
      expect(updateFn).toContain("input.oversLimit !== undefined");
      expect(updateFn).toContain("input.resultSummary !== undefined");
    });

    it("re-projects match state when events exist rather than wiping to initial state", () => {
      expect(updateFn).toContain("events.length > 0");
      expect(updateFn).toContain("await projectMatchState(targetMatch)");
      expect(updateFn).toContain("createInitialCricketState");
    });

    it("broadcasts updated match and state to SSE clients", () => {
      expect(updateFn).toContain("broadcastScoringState(tournamentId,");
    });

    it("supports resultSummary in PATCH schema in routes/scoring.ts", () => {
      expect(routeSource).toContain("resultSummary: z.string().nullable().optional()");
    });
  });
});
