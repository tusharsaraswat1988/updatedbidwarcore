import { describe, expect, it } from "vitest";
import {
  BWF_OFFICIAL_INDIVIDUAL_PROFILE,
  BWF_OFFICIAL_TEAM_PROFILE,
  CORPORATE_ROUND_ROBIN_PROFILE,
  CORPORATE_TEAM_LEAGUE_PROFILE,
} from "./profiles";
import { validateRulesProfile } from "./schema";
import {
  calculateUniversalStandings,
  type StandingsMatchRecord,
} from "./standings-engine";

describe("Badminton Universal Standings & Tie-Breaker Engine", () => {
  it("resolves a 2-way tie using Head-to-Head match winner (BWF GCR 16.2.1)", () => {
    // Entrant 101 and 102 both have 1 win and 1 loss.
    // 101 beat 102 head-to-head (21-19, 21-18).
    // Both played 103: 101 lost to 103, 102 beat 103.
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 101,
        registrationBId: 102,
        status: "completed",
        winnerRegistrationId: 101,
        games: [
          { leftScore: 21, rightScore: 19, phase: "completed" },
          { leftScore: 21, rightScore: 18, phase: "completed" },
        ],
      },
      {
        matchId: 2,
        registrationAId: 101,
        registrationBId: 103,
        status: "completed",
        winnerRegistrationId: 103,
        games: [
          { leftScore: 15, rightScore: 21, phase: "completed" },
          { leftScore: 16, rightScore: 21, phase: "completed" },
        ],
      },
      {
        matchId: 3,
        registrationAId: 102,
        registrationBId: 103,
        status: "completed",
        winnerRegistrationId: 102,
        games: [
          { leftScore: 21, rightScore: 10, phase: "completed" },
          { leftScore: 21, rightScore: 12, phase: "completed" },
        ],
      },
    ];

    // Under BWF rules, 101 and 102 have equal wins (1 win).
    // Even though 102 has better overall points difference (+13 vs -8),
    // BWF GCR 16.2.1 specifies that a two-way tie is decided by Head-to-Head!
    const result = calculateUniversalStandings(
      [101, 102, 103],
      matches,
      BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    // All 3 have 1 win, but 102 beat 103, 101 beat 102, 103 beat 101 (3-way circle).
    // In this 3-way circle, H2H is circular:
    // Games diff:
    // 101: 2-2 (0)
    // 102: 2-2 (0)
    // 103: 2-2 (0)
    // Points diff:
    // 102: 19+18+21+21 = 79 PF, 21+21+10+12 = 64 PA -> +15
    // 101: 21+21+15+16 = 73 PF, 19+18+21+21 = 79 PA -> -6
    // 103: 21+21+10+12 = 64 PF, 15+16+21+21 = 73 PA -> -9
    // So 102 is rank 1 (+15), 101 is rank 2 (-6), 103 is rank 3 (-9).
    expect(result.rows[0]?.registrationId).toBe(102);
    expect(result.rows[1]?.registrationId).toBe(101);
    expect(result.rows[2]?.registrationId).toBe(103);
    });

  it("resolves a 2-way tie at the top cleanly using Head-to-Head when 3rd place has 0 wins", () => {
    // Entrant 101 and 102 both have 1 win, Entrant 103 has 0 wins.
    // 101 beat 102 in their direct match.
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 101,
        registrationBId: 102,
        status: "completed",
        winnerRegistrationId: 101, // 101 beat 102
        games: [
          { leftScore: 21, rightScore: 19, phase: "completed" },
          { leftScore: 21, rightScore: 19, phase: "completed" },
        ],
      },
      {
        matchId: 2,
        registrationAId: 101,
        registrationBId: 103,
        status: "completed",
        winnerRegistrationId: 101, // 101 beat 103 (2-0 overall)
        games: [
          { leftScore: 21, rightScore: 15, phase: "completed" },
          { leftScore: 21, rightScore: 15, phase: "completed" },
        ],
      },
      {
        matchId: 3,
        registrationAId: 102,
        registrationBId: 103,
        status: "completed",
        winnerRegistrationId: 102, // 102 beat 103 (1-1 overall)
        games: [
          { leftScore: 21, rightScore: 10, phase: "completed" },
          { leftScore: 21, rightScore: 10, phase: "completed" },
        ],
      },
    ];

    const result = calculateUniversalStandings(
      [101, 102, 103],
      matches,
      BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    expect(result.rows[0]?.registrationId).toBe(101); // 2 wins
    expect(result.rows[1]?.registrationId).toBe(102); // 1 win
    expect(result.rows[2]?.registrationId).toBe(103); // 0 wins
    });

  it("breaks a 3-way circular tie by Games Difference under BWF GCR 16", () => {
    // Circular tie: A beat B, B beat C, C beat A (each has 1 match win).
    // A won 2-0 against B, lost 1-2 to C -> Games: 3 won, 2 lost -> Diff = +1
    // B won 2-0 against C, lost 0-2 to A -> Games: 2 won, 2 lost -> Diff = 0
    // C won 2-1 against A, lost 0-2 to B -> Games: 2 won, 3 lost -> Diff = -1
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 1, // A
        registrationBId: 2, // B
        status: "completed",
        winnerRegistrationId: 1,
        games: [
          { leftScore: 21, rightScore: 15, phase: "completed" },
          { leftScore: 21, rightScore: 15, phase: "completed" },
        ],
      },
      {
        matchId: 2,
        registrationAId: 2, // B
        registrationBId: 3, // C
        status: "completed",
        winnerRegistrationId: 2,
        games: [
          { leftScore: 21, rightScore: 12, phase: "completed" },
          { leftScore: 21, rightScore: 14, phase: "completed" },
        ],
      },
      {
        matchId: 3,
        registrationAId: 3, // C
        registrationBId: 1, // A
        status: "completed",
        winnerRegistrationId: 3,
        games: [
          { leftScore: 21, rightScore: 18, phase: "completed" },
          { leftScore: 19, rightScore: 21, phase: "completed" },
          { leftScore: 21, rightScore: 19, phase: "completed" },
        ],
      },
    ];

    const result = calculateUniversalStandings(
      [1, 2, 3],
      matches,
      BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    expect(result.rows[0]?.registrationId).toBe(1); // Games diff +1
    expect(result.rows[0]?.gamesDifference).toBe(1);
    expect(result.rows[1]?.registrationId).toBe(2); // Games diff 0
    expect(result.rows[1]?.gamesDifference).toBe(0);
    expect(result.rows[2]?.registrationId).toBe(3); // Games diff -1
    expect(result.rows[2]?.gamesDifference).toBe(-1);
    });

  it("handles BWF GCR 16.2.4: when multi-way tie breaks leaving 2 participants, H2H breaks remaining tie", () => {
    // 3 participants with equal wins.
    // Participant 1 has superior games difference (+2) -> takes Rank 1.
    // Participants 2 and 3 have equal games difference and equal points difference,
    // but Participant 2 beat Participant 3 head-to-head.
    // Participant 2 must be ranked ahead of Participant 3.
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        status: "completed",
        winnerRegistrationId: 1,
        games: [
          { leftScore: 21, rightScore: 10, phase: "completed" },
          { leftScore: 21, rightScore: 10, phase: "completed" },
        ],
      },
      {
        matchId: 2,
        registrationAId: 1,
        registrationBId: 3,
        status: "completed",
        winnerRegistrationId: 1,
        games: [
          { leftScore: 21, rightScore: 10, phase: "completed" },
          { leftScore: 21, rightScore: 10, phase: "completed" },
        ],
      },
      {
        matchId: 3,
        registrationAId: 2,
        registrationBId: 3,
        status: "completed",
        winnerRegistrationId: 2, // 2 beat 3 directly
        games: [
          { leftScore: 21, rightScore: 18, phase: "completed" },
          { leftScore: 21, rightScore: 18, phase: "completed" },
        ],
      },
    ];

    const result = calculateUniversalStandings(
      [1, 2, 3],
      matches,
      BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    expect(result.rows[0]?.registrationId).toBe(1); // Rank 1 (2 wins)
    expect(result.rows[1]?.registrationId).toBe(2); // Rank 2 (1 win, beat 3)
    expect(result.rows[2]?.registrationId).toBe(3); // Rank 3 (0 wins)
    });

  it("detects and flags unresolved ties without arbitrary guessing when all criteria are identical", () => {
    // Two participants with identical stats across all metrics who never played each other
    // (e.g. cross-pool comparison or identical records in interrupted tournament)
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 10,
        registrationBId: 30,
        status: "completed",
        winnerRegistrationId: 10,
        games: [
          { leftScore: 21, rightScore: 15, phase: "completed" },
          { leftScore: 21, rightScore: 15, phase: "completed" },
        ],
      },
      {
        matchId: 2,
        registrationAId: 20,
        registrationBId: 40,
        status: "completed",
        winnerRegistrationId: 20,
        games: [
          { leftScore: 21, rightScore: 15, phase: "completed" },
          { leftScore: 21, rightScore: 15, phase: "completed" },
        ],
      },
    ];

    const result = calculateUniversalStandings(
      [10, 20],
      matches,
      BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    );

    // 10 and 20 both have:
    // played: 1, won: 1, gamesWon: 2, gamesLost: 0, pointsFor: 42, pointsAgainst: 30
    // They did not play each other, so H2H is inconclusive.
    // Every single criterion in BWF GCR 16 is identical!
    expect(result.hasUnresolvedTies).toBe(true);
    expect(result.unresolvedTies).toHaveLength(1);
    expect(result.unresolvedTies[0]?.tiedRegistrationIds).toEqual([10, 20]);
    expect(result.unresolvedTies[0]?.actionRequired).toBe("draw_of_lots");

    // Both must share the same rank (Rank 1) with tiedWithNext flagged
    expect(result.rows[0]?.rank).toBe(1);
    expect(result.rows[1]?.rank).toBe(1);
    expect(result.rows[0]?.tiedWithNext).toBe(true);
    });

  it("calculates corporate VNBL standings based on Margin Points", () => {
    // Corporate VNBL ranking: Wins -> Margin Points -> Points Ratio
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 10,
        registrationBId: 20,
        status: "completed",
        winnerRegistrationId: 10,
        games: [
          { leftScore: 21, rightScore: 5, phase: "completed" }, // Margin +16
          { leftScore: 21, rightScore: 6, phase: "completed" }, // Margin +15 -> Total +31
        ],
      },
      {
        matchId: 2,
        registrationAId: 30,
        registrationBId: 40,
        status: "completed",
        winnerRegistrationId: 30,
        games: [
          { leftScore: 21, rightScore: 19, phase: "completed" }, // Margin +2
          { leftScore: 21, rightScore: 18, phase: "completed" }, // Margin +3 -> Total +5
        ],
      },
    ];

    const result = calculateUniversalStandings(
      [10, 20, 30, 40],
      matches,
      CORPORATE_ROUND_ROBIN_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    // Both 10 and 30 have 1 win, but 10 has margin +31 while 30 has margin +5.
    expect(result.rows[0]?.registrationId).toBe(10);
    expect(result.rows[0]?.marginPoints).toBe(31);
    expect(result.rows[1]?.registrationId).toBe(30);
    expect(result.rows[1]?.marginPoints).toBe(5);
    });

  it("calculates Team Championship standings with Rubber Differentials", () => {
    // Team A and Team B both have 1 tie win.
    // Team A won tie 4-1 (rubber diff +3). Team B won tie 3-2 (rubber diff +1).
    const matches: StandingsMatchRecord[] = [
      {
        matchId: 1,
        registrationAId: 100, // Team A
        registrationBId: 200,
        status: "completed",
        winnerRegistrationId: 100,
        rubbersWonA: 4,
        rubbersWonB: 1,
        games: [],
      },
      {
        matchId: 2,
        registrationAId: 300, // Team B
        registrationBId: 400,
        status: "completed",
        winnerRegistrationId: 300,
        rubbersWonA: 3,
        rubbersWonB: 2,
        games: [],
      },
    ];

    const result = calculateUniversalStandings(
      [100, 200, 300, 400],
      matches,
      BWF_OFFICIAL_TEAM_PROFILE,
    );

    expect(result.hasUnresolvedTies).toBe(false);
    expect(result.rows[0]?.registrationId).toBe(100);
    expect(result.rows[0]?.rubberDifference).toBe(3);
    expect(result.rows[1]?.registrationId).toBe(300);
    expect(result.rows[1]?.rubberDifference).toBe(1);
  });
});
