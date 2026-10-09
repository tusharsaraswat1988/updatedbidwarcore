import type { CricketScoreboardState } from "@workspace/scoring-core";

export type TossTeamRef = {
  id: number;
  name: string;
  shortCode?: string | null;
  logoUrl?: string | null;
};

export type TossResultCopy = {
  winnerName: string;
  winnerShort: string;
  winnerLogoUrl: string | null;
  electedTo: "bat" | "bowl";
  decisionLabel: "BAT" | "BOWL";
  battingName: string;
  bowlingName: string;
  sentence: string;
};

export function deliveriesBowled(state: CricketScoreboardState): number {
  return (state.innings ?? []).reduce(
    (sum, inn) => sum + (inn.over ?? 0) * 6 + (inn.ball ?? 0),
    0,
  );
}

/**
 * Toss is on the board and no ball has been bowled yet.
 * LED, scoreboard, and fan page hold the toss result through lineup setup.
 */
export function isTossResultHold(
  state: CricketScoreboardState | null | undefined,
): boolean {
  if (!state) return false;
  if (state.tossWinnerTeamId == null || state.electedTo == null) return false;
  if (state.matchStatus !== "live") return false;
  if ((state.currentInnings ?? 0) > 1) return false;
  return deliveriesBowled(state) === 0;
}

export function buildTossResultCopy(
  state: CricketScoreboardState,
  teams: TossTeamRef[],
  homeTeamId: number,
  awayTeamId: number,
): TossResultCopy | null {
  if (state.tossWinnerTeamId == null || !state.electedTo) return null;
  const byId = (id: number) => teams.find((t) => t.id === id);
  const winner = byId(state.tossWinnerTeamId);
  const otherId =
    state.tossWinnerTeamId === homeTeamId ? awayTeamId : homeTeamId;
  const battingId = state.electedTo === "bat" ? state.tossWinnerTeamId : otherId;
  const bowlingId = state.electedTo === "bat" ? otherId : state.tossWinnerTeamId;
  const winnerName = winner?.name ?? "Toss winner";
  const decisionLabel = state.electedTo === "bat" ? "BAT" : "BOWL";
  return {
    winnerName,
    winnerShort: winner?.shortCode || winnerName.slice(0, 3).toUpperCase(),
    winnerLogoUrl: winner?.logoUrl ?? null,
    electedTo: state.electedTo,
    decisionLabel,
    battingName: byId(battingId)?.name ?? "Batting side",
    bowlingName: byId(bowlingId)?.name ?? "Bowling side",
    sentence: `${winnerName} won the toss and elected to ${state.electedTo} first`,
  };
}
