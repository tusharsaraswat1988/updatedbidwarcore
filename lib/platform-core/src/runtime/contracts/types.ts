import type { ResolvedRuleSnapshot } from "../../catalog/resolve/types.ts";

/** Badminton runtime DTO matching today's Match Format shape. */
export type BadmintonMatchFormatDto = {
  presetId: string;
  format: {
    totalGames: number;
    pointsPerGame: number;
    deuceAt: number;
    maxPoints: number;
    midGameSideChange: boolean;
  };
};

/** Cricket runtime DTO documenting current create defaults — not wired into scoring. */
export type CricketPlatformDefaultsDto = {
  oversLimit: number;
  maxWickets: number;
  playingSquadSize: number;
  playingXiEnforced: boolean;
  benchSize: number;
  ballsPerOver: number;
  ballType: string;
  lbwEnabled: boolean;
  legByeEnabled: boolean;
  freeHitEnabled: boolean;
  retireAtRuns: number | null;
  powerplayEnabled: boolean;
  superOverEnabled: boolean;
  superBallEnabled: boolean;
  superOverOvers: number;
  superOverWickets: number;
  superOverTrigger: string;
};

export type FootballPlatformDefaultsDto = {
  durationMinutes: number;
};

export type RuntimeAdapterResult<T> =
  | { ok: true; dto: T }
  | { ok: false; error: string };

/**
 * Sport-specific, stateless translator.
 * May read snapshots; must never modify them.
 */
export type RuntimeAdapter<TDto> = {
  readonly sportId: string;
  translate(snapshot: ResolvedRuleSnapshot): RuntimeAdapterResult<TDto>;
};
