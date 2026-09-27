import { CricketEventType } from "../events/cricket";
import type { CricketScoreboardState } from "./state";

export type CricketAuthoritativeBroadcastEventType =
  | "FOUR"
  | "SIX"
  | "WIDE"
  | "NO_BALL"
  | "WICKET"
  | "SUPERBALL"
  | "MATCH_WON";

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
  detail?: string;
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
        detail,
      };
    }

    // 2. Super Ball (when active super ball multiplier delivery)
    if (ball.isSuperBall) {
      const type: CricketAuthoritativeBroadcastEventType = "SUPERBALL";
      const runs = ball.runsOffBat ?? 0;
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
        runs,
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

  if (eventType === CricketEventType.MATCH_COMPLETED) {
    const p = payload as { resultText?: string; winnerTeamId?: number | null };
    const type: CricketAuthoritativeBroadcastEventType = "MATCH_WON";
    return {
      id: buildCricketBroadcastEventId(matchId, sequence, type),
      sequence,
      type,
      matchId,
      timestamp,
      detail: p.resultText || "MATCH COMPLETED",
    };
  }

  return null;
}
