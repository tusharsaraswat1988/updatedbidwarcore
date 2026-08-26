import type { CricketScoreboardState } from "./state";

export type CricketDerivedMatchResult = {
  winnerTeamId: number | null;
  margin: string;
  resultText: string;
  isTie: boolean;
};

/**
 * Derive match result from authoritative scoreboard state.
 * Prefers chase `target` (incl. DLS) over raw first-innings total when set.
 */
export function deriveCricketMatchResult(
  state: CricketScoreboardState,
): CricketDerivedMatchResult {
  const superOvers = state.innings.filter((i) => i.kind === "super_over");
  if (superOvers.length >= 2) {
    const firstSuper = superOvers[superOvers.length - 2]!;
    const secondSuper = superOvers[superOvers.length - 1]!;
    if (secondSuper.runs > firstSuper.runs) {
      return {
        winnerTeamId: secondSuper.battingTeamId,
        margin: "Super Over",
        resultText: "Won in Super Over",
        isTie: false,
      };
    }
    if (firstSuper.runs > secondSuper.runs) {
      return {
        winnerTeamId: firstSuper.battingTeamId,
        margin: "Super Over",
        resultText: "Won in Super Over",
        isTie: false,
      };
    }
    return {
      winnerTeamId: null,
      margin: "tie",
      resultText: "Super Over tied",
      isTie: true,
    };
  }

  const first = state.innings.find((i) => i.innings === 1);
  const second = state.innings.find((i) => i.innings === 2);

  if (!first) {
    return {
      winnerTeamId: null,
      margin: "",
      resultText: "Match abandoned",
      isTie: false,
    };
  }

  if (!second) {
    // Incomplete chase / single innings — do not invent a winner from partial state.
    return {
      winnerTeamId: null,
      margin: "",
      resultText: `Innings in progress — ${first.runs}/${first.wickets}`,
      isTie: false,
    };
  }

  // Prefer chase target (standard or DLS). Accept in-progress 2nd innings on End Match.
  if (state.target != null) {
    if (second.runs >= state.target) {
      const wicketsLeft = Math.max(0, state.maxWickets - second.wickets);
      return {
        winnerTeamId: second.battingTeamId,
        margin: `${wicketsLeft} wkts`,
        resultText: `Won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`,
        isTie: false,
      };
    }
    // Finished without reaching target: tie if equal to target-1 (i.e. matched first total).
    if (second.runs === state.target - 1) {
      return {
        winnerTeamId: null,
        margin: "tie",
        resultText: "Match tied",
        isTie: true,
      };
    }
    const diff = state.target - 1 - second.runs;
    return {
      winnerTeamId: first.battingTeamId,
      margin: `${diff} runs`,
      resultText: `Won by ${diff} run${diff === 1 ? "" : "s"}`,
      isTie: false,
    };
  }

  if (second.runs > first.runs) {
    const wicketsLeft = Math.max(0, state.maxWickets - second.wickets);
    return {
      winnerTeamId: second.battingTeamId,
      margin: `${wicketsLeft} wkts`,
      resultText: `Won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`,
      isTie: false,
    };
  }

  if (second.runs === first.runs) {
    return {
      winnerTeamId: null,
      margin: "tie",
      resultText: "Match tied",
      isTie: true,
    };
  }

  const diff = first.runs - second.runs;
  return {
    winnerTeamId: first.battingTeamId,
    margin: `${diff} runs`,
    resultText: `Won by ${diff} run${diff === 1 ? "" : "s"}`,
    isTie: false,
  };
}
