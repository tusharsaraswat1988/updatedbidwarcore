import { CricketEventType } from "../events/cricket";
import type { CricketScoreboardState } from "./state";

export type CricketAuthoritativeBroadcastEventType =
  | "FOUR"
  | "SIX"
  | "WIDE"
  | "NO_BALL"
  | "WICKET"
  | "SUPERBALL"
  | "SUPER_BALL_ACTIVATED"
  | "MATCH_WON"
  | "NEW_BATTER"
  | "NEW_BOWLER"
  | "INNINGS_COMPLETE";

export interface CricketAuthoritativeBroadcastEvent {
  /** Deterministic event identity: `${matchId}:${sequence}:${type}` */
  id: string;
  sequence: number;
  type: CricketAuthoritativeBroadcastEventType;
  matchId: number;
  timestamp: number;
  batter?: string;
  bowler?: string;
  runs?: number;
  totalRuns?: number;
  detail?: string;
  activationId?: string;
  innings?: number;
  wickets?: number;
  overs?: string;
  target?: number | null;
  battingTeam?: string;
  bowlingTeam?: string;
  winnerTeamId?: number | null;
  winnerName?: string;
  marginText?: string;
  dismissal?: string;
}

export function buildCricketBroadcastEventId(
  matchId: number,
  sequence: number,
  type: string,
): string {
  return `${matchId}:${sequence}:${type}`;
}

export interface BuildBroadcastEventParams {
  matchId: number;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
  state?: CricketScoreboardState | null;
  batterName?: string;
  bowlerName?: string;
  battingTeamName?: string;
  winnerTeamName?: string;
  timestamp?: number;
}

/**
 * Creates an authoritative broadcast event envelope directly from a persisted cricket scoring event.
 * Eliminates client-side heuristics and guarantees deterministic identity for all consumers.
 */
export function buildAuthoritativeCricketBroadcastEvent(
  params: BuildBroadcastEventParams,
): CricketAuthoritativeBroadcastEvent | null {
  const {
    matchId,
    sequence,
    eventType,
    payload,
    batterName,
    bowlerName,
    battingTeamName,
    winnerTeamName,
    state,
    timestamp = Date.now(),
  } = params;

  if (eventType === CricketEventType.BALL_RECORDED) {
    const ball = payload as {
      runsOffBat?: number;
      extras?: { type?: string | null; runs?: number } | null;
      wicket?: { type?: string; dismissedPlayerId?: number; fielderId?: number } | null;
      isSuperBall?: boolean;
      isLegalDelivery?: boolean;
    };

    // 1. Wicket (highest priority standard event)
    if (ball.wicket) {
      const type: CricketAuthoritativeBroadcastEventType = "WICKET";
      const wType = ball.wicket.type;
      const dismissalText = wType ? wType.toUpperCase().replace(/_/g, " ") : "OUT";
      const detail = batterName
        ? `${batterName} · ${dismissalText}`
        : `WICKET · ${dismissalText}`;
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: ball.runsOffBat ?? 0,
        dismissal: dismissalText,
        detail,
      };
    }

    // 2. Super Ball (when active super ball multiplier delivery)
    if (ball.isSuperBall) {
      const type: CricketAuthoritativeBroadcastEventType = "SUPERBALL";
      const baseRuns = ball.runsOffBat ?? 0;
      const totalRuns = baseRuns * 2;
      const detail = batterName
        ? `${batterName} · 2X RUNS SCORED`
        : "2X RUNS MULTIPLIER";
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: baseRuns,
        totalRuns,
        detail,
      };
    }

    const runsOffBat = ball.runsOffBat ?? 0;
    const extrasType = ball.extras?.type ?? null;
    const isNoBall = extrasType === "no_ball";
    const isWide = extrasType === "wide";

    // 3. Boundaries (FOUR / SIX) - including boundaries scored off no-balls
    if (runsOffBat === 6) {
      const type: CricketAuthoritativeBroadcastEventType = "SIX";
      const detail = isNoBall
        ? (batterName ? `${batterName} · NO BALL + MAXIMUM 6` : "NO BALL + MAXIMUM 6")
        : (batterName ? `${batterName} · MAXIMUM 6` : "MAXIMUM 6");
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: 6,
        detail,
      };
    }

    if (runsOffBat === 4) {
      const type: CricketAuthoritativeBroadcastEventType = "FOUR";
      const detail = isNoBall
        ? (batterName ? `${batterName} · NO BALL + BOUNDARY 4` : "NO BALL + BOUNDARY 4")
        : (batterName ? `${batterName} · BOUNDARY 4` : "BOUNDARY 4");
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: 4,
        detail,
      };
    }

    // 4. Illegal Deliveries (NO_BALL / WIDE)
    if (isNoBall) {
      const type: CricketAuthoritativeBroadcastEventType = "NO_BALL";
      const extrasRuns = ball.extras?.runs ?? 1;
      const detail =
        extrasRuns > 1
          ? `EXTRA ${extrasRuns} RUNS · FREE HIT NEXT BALL`
          : "EXTRA RUN · FREE HIT AWARDED NEXT BALL";
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: runsOffBat,
        detail,
      };
    }

    if (isWide) {
      const type: CricketAuthoritativeBroadcastEventType = "WIDE";
      const extrasRuns = ball.extras?.runs ?? 1;
      const detail =
        extrasRuns > 1
          ? `ILLEGAL DELIVERY · ${extrasRuns} WIDE RUNS`
          : "ILLEGAL DELIVERY · EXTRA RUN CONCEDED";
      return {
        id: buildCricketBroadcastEventId(matchId, sequence, type),
        sequence,
        type,
        matchId,
        timestamp,
        batter: batterName,
        bowler: bowlerName,
        runs: 0,
        detail,
      };
    }

    return null;
  }

  if (eventType === CricketEventType.BATTER_SELECTED) {
    const type: CricketAuthoritativeBroadcastEventType = "NEW_BATTER";
    const detail = batterName
      ? `${batterName} · ARRIVING AT THE CREASE`
      : "NEW BATTER AT CREASE";
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      batter: batterName,
      detail,
    };
  }

  if (eventType === CricketEventType.BOWLER_CHANGED) {
    const type: CricketAuthoritativeBroadcastEventType = "NEW_BOWLER";
    const detail = bowlerName
      ? `${bowlerName} · INTO THE ATTACK`
      : "NEW BOWLER";
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      bowler: bowlerName,
      detail,
    };
  }

  if (eventType === CricketEventType.INNINGS_ENDED) {
    const p = payload as {
      innings: number;
      reason: string;
      runs: number;
      wickets: number;
      overs: string;
    };
    const type: CricketAuthoritativeBroadcastEventType = "INNINGS_COMPLETE";
    const target =
      state?.target ?? (p.innings === 1 ? p.runs + 1 : null);
    const detail = `INNINGS ${p.innings} COMPLETE · ${p.runs}/${p.wickets} (${p.overs} OV)`;
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      innings: p.innings,
      runs: p.runs,
      wickets: p.wickets,
      overs: p.overs,
      target,
      battingTeam: battingTeamName,
      detail,
    };
  }

  if (eventType === CricketEventType.MATCH_COMPLETED) {
    const p = payload as { resultText?: string; winnerTeamId?: number | null; margin?: string };
    const type: CricketAuthoritativeBroadcastEventType = "MATCH_WON";
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      winnerTeamId: p.winnerTeamId,
      winnerName: winnerTeamName,
      marginText: p.resultText || p.margin || "Match Won",
      detail: p.resultText || "MATCH COMPLETED",
    };
  }

  if (eventType === CricketEventType.SUPER_BALL_DECLARED) {
    const type: CricketAuthoritativeBroadcastEventType = "SUPER_BALL_ACTIVATED";
    const p = payload as { activationId?: string };
    const activationId = p?.activationId || `${matchId}:${sequence}:super_ball_${timestamp}`;
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      detail: "SUPER BALL ACTIVATED",
      activationId,
    };
  }

  return null;
}
