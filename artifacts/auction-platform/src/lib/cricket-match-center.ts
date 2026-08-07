/**
 * Match Center helpers — derive timeline + per-match stats from existing
 * match state / scorecard projections. No new engines.
 */

import type { CricketScoreboardState } from "@workspace/scoring-core";
import type {
  PublicScorecardResponse,
  ScoringMatchJson,
} from "@/lib/scoring-api";

export type MatchTimelineItem = {
  id: string;
  label: string;
  detail?: string;
  at?: string | null;
};

export type MatchStatSnapshot = {
  label: string;
  playerName: string;
  value: string;
};

function oversToBalls(over: number, ball: number): number {
  return over * 6 + ball;
}

/** Current innings run rate from live state (display only). */
export function currentRunRate(state: CricketScoreboardState): number | null {
  const inn = state.innings.find((i) => i.innings === state.currentInnings);
  if (!inn || inn.phase === "not_started") return null;
  const balls = oversToBalls(inn.over, inn.ball);
  if (balls <= 0) return null;
  return Math.round((inn.runs / balls) * 6 * 100) / 100;
}

export function formatInningsScore(
  state: CricketScoreboardState,
  teamId: number,
): { runs: number; wickets: number; overs: string } | null {
  const inn = [...state.innings]
    .reverse()
    .find((i) => i.battingTeamId === teamId);
  if (!inn) return null;
  return {
    runs: inn.runs,
    wickets: inn.wickets,
    overs: `${inn.over}.${inn.ball}`,
  };
}

/** Build match timeline from existing match row + state + scorecard. */
export function buildMatchTimeline(input: {
  match: ScoringMatchJson;
  state: CricketScoreboardState;
  scorecard: PublicScorecardResponse | null;
  teamName: (id: number) => string;
  playerName: (id: number) => string;
}): MatchTimelineItem[] {
  const { match, state, scorecard, teamName, playerName } = input;
  const items: MatchTimelineItem[] = [];

  if (match.scheduledAt) {
    items.push({
      id: "scheduled",
      label: "Scheduled",
      detail: match.venue ? match.venue : undefined,
      at: match.scheduledAt,
    });
  }

  if (state.tossWinnerTeamId != null && state.electedTo) {
    items.push({
      id: "toss",
      label: "Toss",
      detail: `${teamName(state.tossWinnerTeamId)} elected to ${state.electedTo}`,
      at: match.startedAt,
    });
  }

  const lineupCount = Object.values(state.lineups ?? {}).reduce(
    (n, ids) => n + (ids?.length ?? 0),
    0,
  );
  if (lineupCount > 0) {
    items.push({
      id: "xi",
      label: "Playing XI confirmed",
      detail: `${lineupCount} players named`,
    });
  }

  if (match.startedAt || state.matchStatus === "live" || state.matchStatus === "completed") {
    items.push({
      id: "started",
      label: "Match started",
      at: match.startedAt,
    });
  }

  if (scorecard) {
    for (const inn of scorecard.scorecard.innings) {
      for (const b of inn.batting) {
        if (b.dismissalType && b.dismissalType !== "not_out") {
          items.push({
            id: `wkt-${inn.innings}-${b.playerId}`,
            label: "Wicket",
            detail: `${playerName(b.playerId)} — ${b.dismissalType.replace(/_/g, " ")} (${b.runs})`,
          });
        }
        if (b.runs >= 100) {
          items.push({
            id: `mile-100-${inn.innings}-${b.playerId}`,
            label: "Milestone",
            detail: `${playerName(b.playerId)} — century (${b.runs})`,
          });
        } else if (b.runs >= 50) {
          items.push({
            id: `mile-50-${inn.innings}-${b.playerId}`,
            label: "Milestone",
            detail: `${playerName(b.playerId)} — fifty (${b.runs})`,
          });
        }
      }
    }
  }

  for (const inn of state.innings) {
    if (inn.phase === "completed") {
      items.push({
        id: `inn-end-${inn.innings}`,
        label: `Innings ${inn.innings} ended`,
        detail: `${teamName(inn.battingTeamId)} ${inn.runs}/${inn.wickets} (${inn.over}.${inn.ball})`,
      });
    }
  }

  if (state.matchStatus === "completed" || state.matchStatus === "abandoned") {
    items.push({
      id: "result",
      label: state.matchStatus === "abandoned" ? "Match abandoned" : "Result",
      detail: state.resultText ?? match.resultSummary ?? undefined,
      at: match.completedAt,
    });
  }

  if (scorecard?.manOfTheMatch) {
    items.push({
      id: "mom",
      label: "Player of the Match",
      detail: scorecard.manOfTheMatch.playerName,
      at: match.completedAt,
    });
  }

  return items;
}

/** Per-match stats snapshot from scorecard — no tournament leaderboard call. */
export function buildMatchStatSnapshots(
  scorecard: PublicScorecardResponse | null,
): MatchStatSnapshot[] {
  if (!scorecard) return [];
  const players = scorecard.players;
  const name = (id: number) => players[String(id)] ?? `Player ${id}`;

  type Bat = { playerId: number; runs: number; balls: number; fours: number; sixes: number; sr: number };
  type Bowl = { playerId: number; wickets: number; runs: number; overs: number; economy: number };

  const batters: Bat[] = [];
  const bowlers: Bowl[] = [];

  for (const inn of scorecard.scorecard.innings) {
    for (const b of inn.batting) {
      batters.push({
        playerId: b.playerId,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        sr: b.strikeRate,
      });
    }
    for (const b of inn.bowling) {
      bowlers.push({
        playerId: b.playerId,
        wickets: b.wickets,
        runs: b.runs,
        overs: typeof b.overs === "number" ? b.overs : parseFloat(String(b.overs)) || 0,
        economy: b.economy,
      });
    }
  }

  const snaps: MatchStatSnapshot[] = [];

  const topBat = batters.reduce<Bat | null>(
    (best, b) => (!best || b.runs > best.runs ? b : best),
    null,
  );
  if (topBat && topBat.runs > 0) {
    snaps.push({
      label: "Top batter",
      playerName: name(topBat.playerId),
      value: `${topBat.runs} (${topBat.balls})`,
    });
  }

  const topBowl = bowlers.reduce<Bowl | null>((best, b) => {
    if (!best) return b;
    if (b.wickets !== best.wickets) return b.wickets > best.wickets ? b : best;
    return b.runs < best.runs ? b : best;
  }, null);
  if (topBowl && topBowl.wickets > 0) {
    snaps.push({
      label: "Top bowler",
      playerName: name(topBowl.playerId),
      value: `${topBowl.wickets}/${topBowl.runs}`,
    });
  }

  const mostSix = batters.reduce<Bat | null>(
    (best, b) => (!best || b.sixes > best.sixes ? b : best),
    null,
  );
  if (mostSix && mostSix.sixes > 0) {
    snaps.push({
      label: "Most sixes",
      playerName: name(mostSix.playerId),
      value: String(mostSix.sixes),
    });
  }

  const mostFour = batters.reduce<Bat | null>(
    (best, b) => (!best || b.fours > best.fours ? b : best),
    null,
  );
  if (mostFour && mostFour.fours > 0) {
    snaps.push({
      label: "Most fours",
      playerName: name(mostFour.playerId),
      value: String(mostFour.fours),
    });
  }

  const bestSr = batters
    .filter((b) => b.balls >= 6)
    .reduce<Bat | null>((best, b) => (!best || b.sr > best.sr ? b : best), null);
  if (bestSr) {
    snaps.push({
      label: "Strike rate",
      playerName: name(bestSr.playerId),
      value: String(bestSr.sr),
    });
  }

  const bestEcon = bowlers
    .filter((b) => b.overs >= 1)
    .reduce<Bowl | null>(
      (best, b) => (!best || b.economy < best.economy ? b : best),
      null,
    );
  if (bestEcon) {
    snaps.push({
      label: "Economy",
      playerName: name(bestEcon.playerId),
      value: String(bestEcon.economy),
    });
  }

  return snaps;
}

export function matchDurationLabel(
  startedAt: string | null,
  completedAt: string | null,
): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
