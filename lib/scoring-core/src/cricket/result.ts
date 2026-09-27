import type { CricketScoreboardState } from "./state";
import { isOversComplete } from "./ball";

export type CricketDerivedMatchResult = {
  winnerTeamId: number | null;
  margin: string;
  resultText: string;
  isTie: boolean;
};

/**
 * Calculates the 1-based Super Over pair index for a given innings number.
 * Innings 3 & 4 -> Pair 1
 * Innings 5 & 6 -> Pair 2
 * Innings 7 & 8 -> Pair 3
 * Returns null if innings < 3.
 */
export function getSuperOverPairNumber(innings: number): number | null {
  if (innings < 3) return null;
  return Math.floor((innings - 3) / 2) + 1;
}

/**
 * Checks whether an innings number belongs to a Super Over (innings >= 3).
 */
export function isSuperOverInnings(innings: number): boolean {
  return innings >= 3;
}

/**
 * Derive match result from authoritative scoreboard state.
 * Prefers chase `target` (incl. DLS) over raw first-innings total when set.
 */
export function deriveCricketMatchResult(
  state: CricketScoreboardState,
): CricketDerivedMatchResult {
  const superOvers = state.innings.filter((i) => i.kind === "super_over");
  if (superOvers.length > 0) {
    if (superOvers.length % 2 !== 0) {
      return {
        winnerTeamId: null,
        margin: "",
        resultText: "Super Over in progress",
        isTie: false,
      };
    }
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

export type CricketTerminalStateValidation =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validates if the cricket scoreboard is in an authoritative terminal state
 * eligible for MATCH_COMPLETED.
 */
export function isCricketMatchTerminalState(
  state: CricketScoreboardState,
): CricketTerminalStateValidation {
  if (state.matchStatus !== "live") {
    return {
      valid: false,
      reason: `Match is not in progress (current status: ${state.matchStatus})`,
    };
  }

  const first = state.innings.find((i) => i.innings === 1);
  if (!first) {
    return {
      valid: false,
      reason: "Match cannot be completed: first innings has not started",
    };
  }

  if (first.phase !== "completed") {
    return {
      valid: false,
      reason: "Match cannot be completed: first innings is still in progress",
    };
  }

  const superOvers = state.innings.filter((i) => i.kind === "super_over");
  if (superOvers.length > 0) {
    if (superOvers.length % 2 !== 0) {
      return {
        valid: false,
        reason: "Match cannot be completed: Super Over is in progress",
      };
    }
    const firstSuper = superOvers[superOvers.length - 2]!;
    const secondSuper = superOvers[superOvers.length - 1]!;

    if (firstSuper.phase !== "completed") {
      return {
        valid: false,
        reason:
          "Match cannot be completed: first Super Over innings is still in progress",
      };
    }

    const secondSuperLimit = secondSuper.oversLimit || state.superOverOvers || 1;
    const secondSuperTerminal =
      secondSuper.phase === "completed" ||
      secondSuper.runs > firstSuper.runs ||
      secondSuper.wickets >= state.superOverWickets ||
      isOversComplete(secondSuper, secondSuperLimit);

    if (!secondSuperTerminal) {
      return {
        valid: false,
        reason:
          "Match cannot be completed: second Super Over innings is still in progress",
      };
    }

    if (firstSuper.runs === secondSuper.runs) {
      return {
        valid: false,
        reason:
          "Match cannot be completed: Super Over is tied, another Super Over is required",
      };
    }

    return { valid: true };
  }

  const second = state.innings.find((i) => i.innings === 2);
  if (!second) {
    return {
      valid: false,
      reason: "Match cannot be completed: second innings has not started",
    };
  }

  const secondOversLimit = second.oversLimit || state.oversLimit;
  const secondTerminal =
    second.phase === "completed" ||
    (state.target != null && second.runs >= state.target) ||
    second.wickets >= state.maxWickets ||
    isOversComplete(second, secondOversLimit);

  if (!secondTerminal) {
    return {
      valid: false,
      reason: "Match cannot be completed: second innings is still in progress",
    };
  }

  return { valid: true };
}

