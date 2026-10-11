import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Completed cricket match repair", () => {
  const repairSource = readFileSync(
    resolve(__dirname, "../lib/cricket-match-repair.ts"),
    "utf8",
  );
  const routeSource = readFileSync(
    resolve(__dirname, "../routes/scoring.ts"),
    "utf8",
  );
  const resetSource = readFileSync(
    resolve(__dirname, "../lib/scoring-service.ts"),
    "utf8",
  );

  it("exposes an organizer repair route for rebuild and reset", () => {
    expect(routeSource).toContain(
      'router.post("/tournaments/:tournamentId/scoring/matches/repair"',
    );
    expect(routeSource).toContain("requireTournamentOrganizer");
    expect(routeSource).toContain('z.enum(["rebuild", "reset"])');
    expect(routeSource).toContain("repairCompletedCricketMatches");
  });

  it("rebuilds from the ball log and refreshes points without double-counting career stats", () => {
    expect(repairSource).toContain("deriveCricketMatchResult");
    expect(repairSource).toContain("replayScoringMatchState");
    expect(repairSource).toContain("projectMatchPlayerStats");
    expect(repairSource).toContain("projectMatchAwards");
    expect(repairSource).toContain("rebuildTournamentStandings");
    expect(repairSource).toContain("rebuildTournamentLeaderboards");
    expect(repairSource).toContain("advanceTournamentProgression");
    expect(repairSource).not.toContain("projectGlobalCricketStatsForMatch");
  });

  it("reset deletes balls and derived scores but keeps the squad", () => {
    const start = repairSource.indexOf("async function resetOne");
    const next = repairSource.indexOf("async function repairCompletedCricketMatches", start);
    const resetFn = repairSource.slice(start, next);
    expect(resetFn).toContain(".delete(scoringEventsTable)");
    expect(resetFn).toContain(".delete(scoringMatchPlayerStatsTable)");
    expect(resetFn).toContain(".delete(scoringPlayerAwardsTable)");
    expect(resetFn).toContain('status: "scheduled"');
    expect(resetFn).toContain("winnerTeamId: null");
    expect(resetFn).not.toContain("scoringMatchSquadsTable");
  });

  it("only accepts finished matches", () => {
    expect(repairSource).toContain('"completed", "abandoned", "walkover"');
    expect(repairSource).toContain("MATCH_NOT_FINISHED");
  });

  it("pre-toss reset updates the linked fixture from the loaded match", () => {
    const start = resetSource.indexOf("export async function resetCricketMatchSetup");
    const next = resetSource.indexOf("\nexport ", start + 1);
    const resetFn = resetSource.slice(start, next === -1 ? resetSource.length : next);
    expect(resetFn).toContain("match.fixtureId");
    expect(resetFn).not.toContain("existing.fixtureId");
    expect(resetFn).toContain("const updatedMatch = await db.transaction");
  });
});
