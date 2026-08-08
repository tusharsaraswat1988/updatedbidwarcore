import type { CricketScoreboardState } from "@workspace/scoring-core";
import { deriveCricketMatchResult } from "@workspace/scoring-core";
import {
  calculateDlsChaseTarget,
  calculateDlsMidChasePar,
  type DlsChaseTargetResult,
} from "@workspace/scoring-core";
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

/** Client preview — server overwrites MATCH_COMPLETED with the same derivation. */
export function buildMatchResult(state: CricketScoreboardState) {
  return deriveCricketMatchResult(state);
}

/** Compute DLS par score and revised target for rain-affected overs. */
export function computeDlsApplication(
  state: CricketScoreboardState,
  revisedOvers: number,
): DlsChaseTargetResult & { innings: number } {
  const scheduled = state.oversLimit;
  const first = state.innings.find((i) => i.innings === 1);
  if (!first) {
    throw new Error("First innings required for DLS");
  }

  const firstOvers = oversText(first.over, first.ball);
  const second = state.innings.find((i) => i.innings === 2);
  const current = getActiveInnings(state);

  if (!second || second.phase === "completed") {
    const result = calculateDlsChaseTarget({
      scheduledOvers: scheduled,
      firstInningsRuns: first.runs,
      firstInningsOvers: firstOvers,
      firstInningsWickets: first.wickets,
      revisedOvers,
    });
    return { ...result, innings: second?.innings ?? 2 };
  }

  if (!current || current.innings < 2) {
    const result = calculateDlsChaseTarget({
      scheduledOvers: scheduled,
      firstInningsRuns: first.runs,
      firstInningsOvers: firstOvers,
      firstInningsWickets: first.wickets,
      revisedOvers,
    });
    return { ...result, innings: 2 };
  }

  const result = calculateDlsMidChasePar({
    scheduledOvers: scheduled,
    firstInningsRuns: first.runs,
    firstInningsOvers: firstOvers,
    firstInningsWickets: first.wickets,
    revisedOvers,
    secondInningsRuns: current.runs,
    secondInningsOvers: oversText(current.over, current.ball),
    secondInningsWickets: current.wickets,
  });
  return { ...result, innings: current.innings };
}
