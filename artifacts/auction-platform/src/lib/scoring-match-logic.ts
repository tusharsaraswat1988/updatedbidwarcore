import type { CricketScoreboardState } from "@workspace/scoring-core";
import { getActiveInnings, oversText } from "@/lib/scoring-ball";

export function battingTeamId(state: CricketScoreboardState): number | null {
  return getActiveInnings(state)?.battingTeamId ?? null;
}

export function bowlingTeamId(state: CricketScoreboardState): number | null {
  return getActiveInnings(state)?.bowlingTeamId ?? null;
}

export function inningsOversLabel(state: CricketScoreboardState): string {
  const inn = getActiveInnings(state);
  if (!inn) return "0.0";
  return oversText(inn.over, inn.ball);
}

export function canEndInnings(state: CricketScoreboardState): boolean {
  const inn = getActiveInnings(state);
  if (!inn || inn.phase !== "in_progress") return false;
  return true;
}

export function suggestInningsEndReason(
  state: CricketScoreboardState,
): "all_out" | "overs_complete" | "target_reached" {
  const inn = getActiveInnings(state);
  if (!inn) return "overs_complete";
  if (state.target != null && inn.runs >= state.target) return "target_reached";
  if (inn.wickets >= state.maxWickets) return "all_out";
  if (inn.over >= state.oversLimit && inn.ball >= 6) return "overs_complete";
  if (inn.over >= state.oversLimit) return "overs_complete";
  return "overs_complete";
}

export function buildMatchResult(state: CricketScoreboardState): {
  winnerTeamId: number | null;
  margin: string;
  resultText: string;
  isTie: boolean;
} {
  const first = state.innings.find((i) => i.innings === 1);
  const second = state.innings.find((i) => i.innings === 2);

  if (!first) {
    return { winnerTeamId: null, margin: "", resultText: "Match abandoned", isTie: false };
  }

  if (!second || second.phase !== "completed") {
    const winner = first.runs > 0 ? first.battingTeamId : null;
    return {
      winnerTeamId: winner,
      margin: `${first.wickets} wkts`,
      resultText: winner ? `Innings complete — ${first.runs}/${first.wickets}` : "No result",
      isTie: false,
    };
  }

  if (second.runs > first.runs) {
    const wicketsLeft = state.maxWickets - second.wickets;
    return {
      winnerTeamId: second.battingTeamId,
      margin: `${wicketsLeft} wkts`,
      resultText: `Won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`,
      isTie: false,
    };
  }

  if (second.runs < first.runs) {
    const diff = first.runs - second.runs;
    return {
      winnerTeamId: first.battingTeamId,
      margin: `${diff} runs`,
      resultText: `Won by ${diff} run${diff === 1 ? "" : "s"}`,
      isTie: false,
    };
  }

  return {
    winnerTeamId: null,
    margin: "tie",
    resultText: "Match tied",
    isTie: true,
  };
}
