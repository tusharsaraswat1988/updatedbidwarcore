import { describe, expect, it } from "vitest";
import type { CricketFullScorecard } from "@workspace/scoring-core";
import {
  broadcastMatchSummary,
  dismissalLabel,
  knockoutBoardRows,
  knockoutResultLine,
  plateMatchId,
  resolveCricketBroadcastSponsors,
  scoreboardSponsorLogo,
  sponsorsExceptLocked,
  tossLine,
  upcomingFixture,
} from "@/lib/cricket-broadcast-plates";

function card(): CricketFullScorecard {
  return {
    matchId: 9,
    innings: [
      {
        innings: 1,
        battingTeamId: 1,
        bowlingTeamId: 2,
        totalRuns: 140,
        totalWickets: 8,
        overs: "20.0",
        extras: { byes: 1, legByes: 0, wides: 4, noBalls: 1, penalties: 0, total: 6 },
        fallOfWickets: [],
        partnerships: [],
        currentPartnership: null,
        batting: [
          {
            playerId: 11,
            runs: 62,
            balls: 40,
            fours: 6,
            sixes: 2,
            strikeRate: 155,
            notOut: false,
            dismissalType: "caught",
            dismissedByPlayerId: 21,
            fielderId: 22,
          },
          {
            playerId: 12,
            runs: 18,
            balls: 22,
            fours: 1,
            sixes: 0,
            strikeRate: 81.8,
            notOut: true,
            dismissalType: null,
            dismissedByPlayerId: null,
            fielderId: null,
          },
        ],
        bowling: [
          {
            playerId: 21,
            overs: "4.0",
            maidens: 0,
            runs: 28,
            wickets: 2,
            wides: 1,
            noBalls: 0,
            economy: 7,
          },
          {
            playerId: 23,
            overs: "4.0",
            maidens: 0,
            runs: 40,
            wickets: 1,
            wides: 0,
            noBalls: 0,
            economy: 10,
          },
        ],
      },
      {
        innings: 2,
        battingTeamId: 2,
        bowlingTeamId: 1,
        totalRuns: 90,
        totalWickets: 3,
        overs: "12.2",
        extras: { byes: 0, legByes: 0, wides: 2, noBalls: 0, penalties: 0, total: 2 },
        fallOfWickets: [],
        partnerships: [],
        currentPartnership: null,
        batting: [
          {
            playerId: 21,
            runs: 44,
            balls: 30,
            fours: 4,
            sixes: 1,
            strikeRate: 146.6,
            notOut: true,
            dismissalType: null,
            dismissedByPlayerId: null,
            fielderId: null,
          },
        ],
        bowling: [
          {
            playerId: 11,
            overs: "3.0",
            maidens: 0,
            runs: 22,
            wickets: 2,
            wides: 0,
            noBalls: 0,
            economy: 7.33,
          },
        ],
      },
    ],
  };
}

describe("broadcast match summary", () => {
  it("keeps each innings on the team that batted it", () => {
    const summary = broadcastMatchSummary({
      scorecard: card(),
      players: { "11": "Aman", "12": "Dev", "21": "Ravi", "22": "Neil", "23": "Omar" },
      homeTeamId: 1,
      awayTeamId: 2,
      winnerTeamId: 1,
      resultSummary: "won by 7 wickets",
      winnerName: "Kings",
    });
    expect(summary.home.score).toBe("140/8");
    expect(summary.home.overs).toBe("20.0");
    expect(summary.away.score).toBe("90/3");
    expect(summary.away.overs).toBe("12.2");
    expect(summary.home.topBatter).toEqual({ name: "Aman", runs: 62, balls: 40 });
    expect(summary.away.topBatter).toEqual({ name: "Ravi", runs: 44, balls: 30 });
    expect(summary.home.topBowler).toEqual({ name: "Aman", wickets: 2, runsConceded: 22 });
    expect(summary.away.topBowler?.name).toBe("Ravi");
    expect(summary.resultText).toBe("Kings won by 7 wickets");
  });

  it("leaves an unbatted side blank instead of borrowing the chase equation", () => {
    const full = card();
    full.innings = full.innings.slice(0, 1);
    const summary = broadcastMatchSummary({
      scorecard: full,
      players: { "11": "Aman" },
      homeTeamId: 1,
      awayTeamId: 2,
      winnerTeamId: null,
      resultSummary: null,
      winnerName: null,
    });
    expect(summary.home.score).toBe("140/8");
    expect(summary.away.score).toBeNull();
    expect(summary.away.overs).toBeNull();
    expect(summary.away.topBatter).toBeNull();
    expect(summary.resultText).toBe("Result pending");
  });
});

describe("plate identity", () => {
  it("does not invent an intro match from the live match", () => {
    expect(plateMatchId({
      overlay: "intro",
      liveMatchId: 4,
      liveStatus: "live",
    })).toBeNull();
  });

  it("uses the live match for a scorecard only while that match is live", () => {
    expect(plateMatchId({
      overlay: "scorecard",
      liveMatchId: 4,
      liveStatus: "live",
    })).toBe(4);
    expect(plateMatchId({
      overlay: "scorecard",
      overlayMatchId: 8,
      liveMatchId: 4,
      liveStatus: "live",
    })).toBe(8);
  });

  it("reads the toss from the selected match", () => {
    expect(tossLine({ tossWinnerTeamId: 2, electedTo: "bowl" }, "Riders")).toBe(
      "RIDERS WON THE TOSS AND CHOSE TO BOWL",
    );
    expect(tossLine({ tossWinnerTeamId: 2, electedTo: null }, "Riders")).toBeNull();
  });

  it("keeps upcoming fixtures free of live and finished matches", () => {
    const picked = upcomingFixture(
      [
        { id: 1, status: "completed" },
        { id: 2, status: "live" },
        { id: 3, status: "scheduled" },
      ],
      2,
    );
    expect(picked).toBeNull();
    expect(upcomingFixture([
      { id: 1, status: "completed" },
      { id: 3, status: "upcoming" },
    ])?.id).toBe(3);
  });
});

describe("knockout and sponsors", () => {
  it("paints a knockout result when the match has one", () => {
    const rows = knockoutBoardRows(
      [{ id: 50, homeTeamId: 1, awayTeamId: 2, resultSummary: null, status: "scheduled" }],
      [{ id: 9, fixtureId: 50, homeTeamId: 1, awayTeamId: 2, resultSummary: "Kings won by 4 wickets", status: "completed" }],
    );
    expect(knockoutResultLine(rows[0]!)).toBe("Kings won by 4 wickets");
  });

  it("uses cricket branding logos and leaves a locked sponsor in place", () => {
    expect(resolveCricketBroadcastSponsors(null)).toEqual([]);
    expect(resolveCricketBroadcastSponsors("[]")).toEqual([]);
    const locked = scoreboardSponsorLogo({
      name: "Boundary Co",
      logoUrl: "https://cdn.example/b.png",
      title: "Boundary Sponsor",
    });
    expect(locked?.isTitleSponsor).toBe(false);
    const rotating = sponsorsExceptLocked(
      [{ url: "https://cdn.example/b.png", name: "Boundary Co" }, { url: "https://cdn.example/c.png", name: "Cafe" }],
      locked,
    );
    expect(rotating.map((sponsor) => sponsor.name)).toEqual(["Cafe"]);
  });

  it("writes a caught dismissal from the scorecard ids", () => {
    expect(dismissalLabel({
      playerId: 11,
      runs: 1,
      balls: 2,
      fours: 0,
      sixes: 0,
      strikeRate: 50,
      notOut: false,
      dismissalType: "caught",
      dismissedByPlayerId: 21,
      fielderId: 22,
    }, (id) => (id === 21 ? "Ravi" : "Neil"))).toBe("c Neil b Ravi");
  });
});
