import { describe, expect, it } from "vitest";
import { createInitialCricketState } from "@workspace/scoring-core";
import {
  buildTossResultCopy,
  isTossResultHold,
} from "@/lib/cricket-toss-result";

const teams = [
  { id: 10, name: "Titans", shortCode: "TIT", logoUrl: null },
  { id: 20, name: "Kings", shortCode: "KNG", logoUrl: null },
];

function started(electedTo: "bat" | "bowl" = "bat", winner = 10) {
  const state = createInitialCricketState({
    matchId: 1,
    tournamentId: 2,
    homeTeamId: 10,
    awayTeamId: 20,
    oversLimit: 20,
  });
  return {
    ...state,
    matchStatus: "live" as const,
    tossWinnerTeamId: winner,
    electedTo,
    currentInnings: 1,
    innings: [
      {
        innings: 1,
        battingTeamId: electedTo === "bat" ? winner : winner === 10 ? 20 : 10,
        bowlingTeamId: electedTo === "bat" ? (winner === 10 ? 20 : 10) : winner,
        runs: 0,
        wickets: 0,
        over: 0,
        ball: 0,
        phase: "in_progress" as const,
        kind: "normal" as const,
        oversLimit: 20,
      },
    ],
  };
}

describe("toss result hold", () => {
  it("stays hidden before the toss is recorded", () => {
    const state = createInitialCricketState({
      matchId: 1,
      tournamentId: 2,
      homeTeamId: 10,
      awayTeamId: 20,
      oversLimit: 20,
    });
    expect(isTossResultHold(state)).toBe(false);
  });

  it("holds after toss until the first ball", () => {
    const state = started("bowl", 20);
    expect(isTossResultHold(state)).toBe(true);
    const copy = buildTossResultCopy(state, teams, 10, 20);
    expect(copy?.winnerName).toBe("Kings");
    expect(copy?.decisionLabel).toBe("BOWL");
    expect(copy?.battingName).toBe("Titans");
    expect(copy?.bowlingName).toBe("Kings");
    expect(copy?.sentence).toBe("Kings won the toss and elected to bowl first");
  });

  it("clears once a delivery is on the board", () => {
    const state = started();
    state.innings[0]!.ball = 1;
    expect(isTossResultHold(state)).toBe(false);
  });
});
