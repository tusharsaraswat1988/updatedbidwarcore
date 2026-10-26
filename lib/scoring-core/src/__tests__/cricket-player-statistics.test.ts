import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  aggregateTournamentPlayerStats,
  applyStatisticPlan,
  buildCanonicalCricketAggregates,
  buildCricketScorecardFromEvents,
  buildLeaderboard,
  createEventEnvelope,
  identityKey,
  mastersToRefreshForMatch,
  parseOversNotation,
  planCricketStatisticWrites,
  resolveBowlingSpell,
  resolveOpaquePlayerIdentities,
  scorecardToPlayerStats,
  type AssignmentSnapshot,
  type CanonicalLedgerRow,
  type PlayerIdentityResolution,
  type StoredStatisticRow,
} from "../index";

const meta = { homeTeamId: 1, awayTeamId: 2 };

function ball(sequence: number, payload: Record<string, unknown>) {
  return createEventEnvelope({
    matchId: 1,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence,
    payload: {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
      ...payload,
    },
    actorType: "organizer",
  });
}

function start() {
  return createEventEnvelope({
    matchId: 1,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.MATCH_STARTED,
    sequence: 1,
    payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
    actorType: "organizer",
  });
}

function ledgerRow(
  overrides: Partial<CanonicalLedgerRow> & Pick<CanonicalLedgerRow, "matchId" | "playerId">,
): CanonicalLedgerRow {
  return {
    tournamentId: 10,
    teamId: 1,
    innings: 1,
    batting: null,
    bowling: null,
    fielding: { catches: 0, runOuts: 0, stumpings: 0 },
    ...overrides,
  };
}

function assignment(
  overrides: Partial<AssignmentSnapshot> &
    Pick<AssignmentSnapshot, "tournamentId" | "opaquePlayerId" | "masterPlayerId">,
): AssignmentSnapshot {
  return {
    isActive: true,
    assignedAtMs: 1,
    ...overrides,
  };
}

function identitiesFor(
  rows: AssignmentSnapshot[],
): Map<string, PlayerIdentityResolution> {
  return resolveOpaquePlayerIdentities(rows);
}

function careerMatches(rows: StoredStatisticRow[], playerId: string): number {
  return rows.find((row) => row.playerId === playerId && row.tournamentId == null)?.matchesPlayed ?? 0;
}

describe("cricket overs notation", () => {
  it("treats 4.2 as 26 legal balls in a six-ball over, not the decimal 4.2", () => {
    expect(parseOversNotation("4.2", 6)).toBe(26);
    expect(resolveBowlingSpell({ overs: "4.2" })?.oversDecimal).toBeCloseTo(26 / 6, 10);
  });

  it("uses the match's balls-per-over instead of assuming six", () => {
    const spell = resolveBowlingSpell({ overs: "1.4", legalBalls: 12, ballsPerOver: 8 });
    expect(spell?.legalBalls).toBe(12);
    expect(spell?.oversDecimal).toBe(1.5);
    expect(parseOversNotation("1.6", 6)).toBeNull();
    expect(parseOversNotation("1.6", 8)).toBe(14);
  });

  it("projects an eight-ball over from the scorecard legal-ball count", () => {
    const events = [
      start(),
      ...Array.from({ length: 8 }, (_, index) =>
        ball(index + 2, { over: 0, ball: index + 1, runsOffBat: index === 0 ? 1 : 0 }),
      ),
    ];
    const card = buildCricketScorecardFromEvents(1, events, { ...meta, ballsPerOver: 8 }, 8);
    const bowler = card.innings[0]!.bowling[0]!;
    expect(bowler.legalBalls).toBe(8);
    expect(bowler.ballsPerOver).toBe(8);
    expect(bowler.overs).toBe("1.0");
    const aggregate = aggregateTournamentPlayerStats(scorecardToPlayerStats(card)).get(201)!;
    expect(aggregate.legalBalls).toBe(8);
    expect(aggregate.oversBowled).toBe(1);
    expect(aggregate.oversNotation).toBe("canonical");
  });
});

describe("cricket scorecard statistics", () => {
  it("does not charge byes to the bowler and does not face a wide", () => {
    const card = buildCricketScorecardFromEvents(
      1,
      [
        start(),
        ball(2, { extras: { type: "bye", runs: 4 }, runsOffBat: 0 }),
        ball(3, {
          ball: 2,
          extras: { type: "wide", runs: 1 },
          isLegalDelivery: false,
        }),
      ],
      meta,
    );
    const batter = card.innings[0]!.batting.find((row) => row.playerId === 101)!;
    const bowler = card.innings[0]!.bowling[0]!;
    expect(batter.balls).toBe(1);
    expect(batter.runs).toBe(0);
    expect(bowler.runs).toBe(1);
    expect(bowler.legalBalls).toBe(1);
    expect(bowler.wides).toBe(1);
    expect(card.innings[0]!.extras.byes).toBe(4);
  });

  it("credits a run-out to the fielder and not the bowler", () => {
    const card = buildCricketScorecardFromEvents(
      1,
      [
        start(),
        ball(2, {
          wicket: { type: "run_out", dismissedPlayerId: 101, fielderId: 303 },
        }),
      ],
      meta,
    );
    const stats = scorecardToPlayerStats(card);
    expect(stats.find((row) => row.playerId === 201)?.bowling?.wickets).toBe(0);
    expect(stats.find((row) => row.playerId === 303)?.fielding.runOuts).toBe(1);
    const batter = card.innings[0]!.batting.find((row) => row.playerId === 101)!;
    expect(batter.notOut).toBe(false);
    expect(batter.fielderId).toBe(303);
    expect(batter.dismissedByPlayerId).toBe(201);
  });

  it("credits a stumping to the keeper and the bowler", () => {
    const card = buildCricketScorecardFromEvents(
      1,
      [
        start(),
        ball(2, {
          wicket: { type: "stumped", dismissedPlayerId: 101, fielderId: 304 },
        }),
      ],
      meta,
    );
    const stats = scorecardToPlayerStats(card);
    expect(stats.find((row) => row.playerId === 201)?.bowling?.wickets).toBe(1);
    expect(stats.find((row) => row.playerId === 304)?.fielding.stumpings).toBe(1);
  });

  it("counts a duck for an out batter and not for retired hurt", () => {
    const out = aggregateTournamentPlayerStats([
      ledgerRow({
        matchId: 1,
        playerId: 1,
        batting: {
          playerId: 1,
          runs: 0,
          balls: 1,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          notOut: false,
          dismissalType: "bowled",
          dismissedByPlayerId: 9,
          fielderId: null,
        },
      }),
    ]).get(1)!;
    expect(out.ducks).toBe(1);
    expect(out.notOuts).toBe(0);

    const hurt = aggregateTournamentPlayerStats([
      ledgerRow({
        matchId: 1,
        playerId: 1,
        batting: {
          playerId: 1,
          runs: 0,
          balls: 2,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          notOut: true,
          dismissalType: "retired_hurt",
          dismissedByPlayerId: null,
          fielderId: null,
        },
      }),
    ]).get(1)!;
    expect(hurt.ducks).toBe(0);
    expect(hurt.notOuts).toBe(1);
    expect(hurt.highestScoreNotOut).toBe(true);
  });

  it("keeps a hundred out of the fifty count and ignores not-outs in the average", () => {
    const totals = aggregateTournamentPlayerStats([
      ledgerRow({
        matchId: 1,
        playerId: 1,
        batting: {
          playerId: 1,
          runs: 100,
          balls: 50,
          fours: 10,
          sixes: 4,
          strikeRate: 200,
          notOut: false,
          dismissalType: "caught",
          dismissedByPlayerId: 9,
          fielderId: 8,
        },
      }),
      ledgerRow({
        matchId: 2,
        playerId: 1,
        batting: {
          playerId: 1,
          runs: 40,
          balls: 20,
          fours: 4,
          sixes: 1,
          strikeRate: 200,
          notOut: true,
          dismissalType: null,
          dismissedByPlayerId: null,
          fielderId: null,
        },
      }),
    ]).get(1)!;
    expect(totals.hundreds).toBe(1);
    expect(totals.fifties).toBe(0);
    expect(totals.innings).toBe(2);
    expect(totals.notOuts).toBe(1);
    const { scoped } = buildCanonicalCricketAggregates({
      ledger: [
        ledgerRow({
          matchId: 1,
          playerId: 11,
          tournamentId: 1,
          batting: {
            playerId: 11,
            runs: 100,
            balls: 50,
            fours: 0,
            sixes: 0,
            strikeRate: 200,
            notOut: false,
            dismissalType: "bowled",
            dismissedByPlayerId: 1,
            fielderId: null,
          },
        }),
        ledgerRow({
          matchId: 2,
          playerId: 11,
          tournamentId: 1,
          batting: {
            playerId: 11,
            runs: 40,
            balls: 20,
            fours: 0,
            sixes: 0,
            strikeRate: 200,
            notOut: true,
            dismissalType: null,
            dismissedByPlayerId: null,
            fielderId: null,
          },
        }),
      ],
      identities: identitiesFor([assignment({ tournamentId: 1, opaquePlayerId: 11, masterPlayerId: "master-a" })]),
    });
    expect(scoped.find((row) => row.tournamentId == null)?.stats.battingAverage).toBe(140);
    expect(scoped.find((row) => row.tournamentId == null)?.stats.strikeRate).toBe(200);
  });

  it("ranks best bowling by wickets, then fewer runs", () => {
    const totals = aggregateTournamentPlayerStats([
      ledgerRow({
        matchId: 1,
        playerId: 7,
        bowling: {
          playerId: 7,
          overs: "2.0",
          legalBalls: 12,
          ballsPerOver: 6,
          maidens: 0,
          runs: 20,
          wickets: 2,
          wides: 1,
          noBalls: 0,
          economy: 10,
        },
      }),
      ledgerRow({
        matchId: 2,
        playerId: 7,
        innings: 1,
        bowling: {
          playerId: 7,
          overs: "4.0",
          legalBalls: 24,
          ballsPerOver: 6,
          maidens: 1,
          runs: 10,
          wickets: 2,
          wides: 0,
          noBalls: 1,
          economy: 2.5,
        },
      }),
    ]).get(7)!;
    expect(totals.bestBowlingWickets).toBe(2);
    expect(totals.bestBowlingRuns).toBe(10);
    expect(totals.legalBalls).toBe(36);
    expect(totals.maidens).toBe(1);
    expect(totals.wides).toBe(1);
    expect(totals.noBalls).toBe(1);
    const board = buildLeaderboard(new Map([[7, totals]]), "economy", 5);
    expect(board[0]?.value).toBeCloseTo(30 / 6, 2);
  });
});

describe("canonical cricket projection", () => {
  const resolved = identitiesFor([
    assignment({ tournamentId: 10, opaquePlayerId: 11, masterPlayerId: "master-a" }),
    assignment({ tournamentId: 20, opaquePlayerId: 99, masterPlayerId: "master-a" }),
    assignment({ tournamentId: 10, opaquePlayerId: 12, masterPlayerId: "master-b" }),
  ]);

  function batting(playerId: number, runs: number): CanonicalLedgerRow["batting"] {
    return {
      playerId,
      runs,
      balls: runs,
      fours: 0,
      sixes: 0,
      strikeRate: 100,
      notOut: false,
      dismissalType: "bowled",
      dismissedByPlayerId: 1,
      fielderId: null,
    };
  }

  function project(ledger: CanonicalLedgerRow[], existing: StoredStatisticRow[] = []) {
    const { scoped, excluded } = buildCanonicalCricketAggregates({
      ledger,
      identities: resolved,
    });
    const plan = planCricketStatisticWrites({ existing, scoped });
    return { scoped, excluded, plan, stored: applyStatisticPlan(existing, plan) };
  }

  it("projects one completed match once", () => {
    const first = project([
      ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 37) }),
    ]);
    expect(careerMatches(first.stored, "master-a")).toBe(1);
    expect(first.scoped.find((row) => row.masterPlayerId === "master-a" && row.tournamentId == null)?.stats.runs).toBe(37);

    const second = project(
      [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 37) })],
      first.stored,
    );
    expect(careerMatches(second.stored, "master-a")).toBe(1);
    expect(second.scoped.find((row) => row.tournamentId == null)?.stats.runs).toBe(37);
  });

  it("adds a second match and a second tournament without merging a different person", () => {
    const projected = project([
      ledgerRow({ matchId: 1, tournamentId: 10, playerId: 11, batting: batting(11, 20) }),
      ledgerRow({ matchId: 2, tournamentId: 10, playerId: 11, batting: batting(11, 15) }),
      ledgerRow({ matchId: 3, tournamentId: 20, playerId: 99, batting: batting(99, 40) }),
      ledgerRow({ matchId: 4, tournamentId: 10, playerId: 12, batting: batting(12, 99) }),
    ]);
    const career = projected.scoped.find(
      (row) => row.masterPlayerId === "master-a" && row.tournamentId == null,
    )!;
    const tournament = projected.scoped.find(
      (row) => row.masterPlayerId === "master-a" && row.tournamentId === 10,
    )!;
    expect(career.stats.matches).toBe(3);
    expect(career.stats.runs).toBe(75);
    expect(tournament.stats.runs).toBe(35);
    expect(career.stats.runs).toBe(
      projected.scoped
        .filter((row) => row.masterPlayerId === "master-a" && row.tournamentId != null)
        .reduce((sum, row) => sum + row.stats.runs, 0),
    );
    const other = projected.scoped.find(
      (row) => row.masterPlayerId === "master-b" && row.tournamentId == null,
    )!;
    expect(other.stats.runs).toBe(99);
    expect(other.stats.matches).toBe(1);
  });

  it("replaces a corrected scorecard and drops a player removed from it", () => {
    const original = project([
      ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 80) }),
      ledgerRow({ matchId: 1, playerId: 12, batting: batting(12, 10) }),
    ]);
    const corrected = project(
      [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 18) })],
      original.stored,
    );
    expect(corrected.scoped.find((row) => row.masterPlayerId === "master-a")?.stats.runs).toBe(18);
    expect(careerMatches(corrected.stored, "master-b")).toBe(0);
    expect(corrected.plan.deleteIds.length).toBeGreaterThan(0);
  });

  it("removes a reset match and keeps a non-cricket row", () => {
    const withMatch = project([
      ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 12) }),
    ]);
    const badminton: StoredStatisticRow = {
      id: 500,
      playerId: "master-a",
      sport: "badminton",
      tournamentId: 10,
      matchesPlayed: 4,
    };
    const reset = planCricketStatisticWrites({
      existing: [...withMatch.stored, badminton],
      scoped: [],
      affectedMasterIds: ["master-a"],
    });
    const stored = applyStatisticPlan([...withMatch.stored, badminton], reset);
    expect(stored.find((row) => row.sport === "badminton")?.matchesPlayed).toBe(4);
    expect(stored.some((row) => row.sport === "cricket")).toBe(false);
  });

  it("does not merge two active identities and does not guess a missing one", () => {
    const ambiguous = resolveOpaquePlayerIdentities([
      assignment({
        tournamentId: 10,
        opaquePlayerId: 11,
        masterPlayerId: "master-a",
        assignedAtMs: 1,
      }),
      assignment({
        tournamentId: 10,
        opaquePlayerId: 11,
        masterPlayerId: "master-b",
        assignedAtMs: 2,
      }),
    ]);
    expect(ambiguous.get(identityKey(10, 11))?.status).toBe("ambiguous");

    const { scoped, excluded } = buildCanonicalCricketAggregates({
      ledger: [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 50) })],
      identities: ambiguous,
    });
    expect(scoped).toEqual([]);
    expect(excluded[0]?.status).toBe("ambiguous");

    const missing = buildCanonicalCricketAggregates({
      ledger: [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 50) })],
      identities: new Map(),
    });
    expect(missing.scoped).toEqual([]);
    expect(missing.excluded[0]?.status).toBe("unresolved");
  });

  it("uses the latest active identity when an older assignment belongs to someone else", () => {
    const map = resolveOpaquePlayerIdentities([
      assignment({
        tournamentId: 10,
        opaquePlayerId: 11,
        masterPlayerId: "old-player",
        isActive: false,
        assignedAtMs: 1,
      }),
      assignment({
        tournamentId: 10,
        opaquePlayerId: 11,
        masterPlayerId: "current-player",
        isActive: true,
        assignedAtMs: 2,
      }),
    ]);
    const { scoped } = buildCanonicalCricketAggregates({
      ledger: [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 9) })],
      identities: map,
    });
    expect(scoped.every((row) => row.masterPlayerId === "current-player")).toBe(true);
  });

  it("refreshes a playing XI player and a cached player who is no longer in the match", () => {
    const masters = mastersToRefreshForMatch({
      tournamentId: 10,
      assignments: [
        assignment({ tournamentId: 10, opaquePlayerId: 11, masterPlayerId: "batter" }),
        assignment({ tournamentId: 10, opaquePlayerId: 501, masterPlayerId: "fielder" }),
        assignment({ tournamentId: 10, opaquePlayerId: 77, masterPlayerId: "removed" }),
      ],
      previousMasterIds: ["batter"],
      ledgerOpaqueIds: [11],
      playingXiIds: [501],
      cachedMasterIds: ["removed"],
    });
    expect(masters).toEqual(["batter", "fielder", "removed"]);
  });

  it("counts a playing XI appearance without a batting or bowling row", () => {
    const { scoped } = buildCanonicalCricketAggregates({
      ledger: [],
      appearances: [{ tournamentId: 10, matchId: 5, playerId: 11, teamId: 1 }],
      identities: resolved,
    });
    const career = scoped.find((row) => row.tournamentId == null)!;
    expect(career.stats.matches).toBe(1);
    expect(career.stats.runs).toBe(0);
    expect(career.stats.innings).toBe(0);
  });

  it("collapses duplicate career rows instead of adding them together", () => {
    const existing: StoredStatisticRow[] = [
      { id: 1, playerId: "master-a", sport: "cricket", tournamentId: null, matchesPlayed: 4 },
      { id: 2, playerId: "master-a", sport: "cricket", tournamentId: null, matchesPlayed: 9 },
    ];
    const { plan, stored } = project(
      [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 5) })],
      existing,
    );
    expect(plan.deleteIds).toContain(2);
    expect(stored.filter((row) => row.playerId === "master-a" && row.tournamentId == null)).toHaveLength(1);
    expect(careerMatches(stored, "master-a")).toBe(1);
  });

  it("keeps an empty tournament baseline that has never had a contribution", () => {
    const baseline: StoredStatisticRow = {
      id: 8,
      playerId: "master-a",
      sport: "cricket",
      tournamentId: 10,
      matchesPlayed: 0,
    };
    const plan = planCricketStatisticWrites({ existing: [baseline], scoped: [] });
    expect(plan.deleteIds).toEqual([]);
  });

  it("rolls back a failed write and succeeds on retry", () => {
    const ledger = [ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 22) })];
    const { plan } = project(ledger);
    const original: StoredStatisticRow[] = [];
    const attempted = applyStatisticPlan(original, plan);
    const rolledBack = original;
    expect(careerMatches(rolledBack, "master-a")).toBe(0);
    const retried = applyStatisticPlan(rolledBack, plan);
    expect(retried).toEqual(attempted);
    expect(careerMatches(retried, "master-a")).toBe(1);
  });

  it("does not let a stale snapshot overwrite a newer locked projection", async () => {
    const matchOne = ledgerRow({ matchId: 1, playerId: 11, batting: batting(11, 10) });
    const matchTwo = ledgerRow({ matchId: 2, playerId: 11, batting: batting(11, 25) });
    let ledger = [matchOne];
    let table: StoredStatisticRow[] = [];

    const projectSnapshot = (snapshot: CanonicalLedgerRow[], current: StoredStatisticRow[]) => {
      const { scoped } = buildCanonicalCricketAggregates({ ledger: snapshot, identities: resolved });
      return applyStatisticPlan(current, planCricketStatisticWrites({ existing: current, scoped }));
    };

    const stale = ledger.slice();
    ledger = [matchOne, matchTwo];
    table = projectSnapshot(ledger, table);
    table = projectSnapshot(stale, table);
    expect(careerMatches(table, "master-a")).toBe(1);

    let tail = Promise.resolve();
    const lock = <T>(fn: () => Promise<T> | T) => {
      const run = tail.then(fn, fn);
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    };

    ledger = [matchOne];
    table = [];
    await lock(async () => {
      ledger = [matchOne, matchTwo];
      table = projectSnapshot(ledger.slice(), table);
    });
    await lock(async () => {
      table = projectSnapshot(ledger.slice(), table);
    });
    expect(careerMatches(table, "master-a")).toBe(2);
    expect(
      buildCanonicalCricketAggregates({ ledger, identities: resolved }).scoped.find(
        (row) => row.tournamentId == null,
      )?.stats.runs,
    ).toBe(35);
  });
});
