/** Which side of the court — left/right as shown on scoreboard. */
export type BadmintonSide = "left" | "right";

/** Type of match play. */
export type BadmintonMatchKind = "singles" | "doubles" | "mixed_doubles";

/** Match format configuration. */
export type BadmintonMatchFormat = {
  /** Total number of games (must be odd). */
  totalGames: number;
  /** Points needed to win a game (typically 21). */
  pointsPerGame: number;
  /** Deuce threshold — play to this minus 1 triggers deuce (typically 20). */
  deuceAt: number;
  /** Maximum points per game (hard cap, e.g. 30). */
  maxPoints: number;
  /** Whether sides switch courts in the final game at halfway. */
  midGameSideChange: boolean;
};

export const STANDARD_FORMAT: BadmintonMatchFormat = {
  totalGames: 3,
  pointsPerGame: 21,
  deuceAt: 20,
  maxPoints: 30,
  midGameSideChange: true,
};

export const BEST_OF_5_FORMAT: BadmintonMatchFormat = {
  totalGames: 5,
  pointsPerGame: 21,
  deuceAt: 20,
  maxPoints: 30,
  midGameSideChange: true,
};

/** One athlete slot on a side (singles = 1, doubles = 2). */
export type BadmintonPlayerSlot = {
  label: string;
  shortLabel: string;
  countryCode?: string;
  countryName?: string;
  photoUrl?: string;
  flagUrl?: string;
  teamColor?: string;
  /** Auction franchise name — informational only; does not define pairing. */
  franchiseName?: string;
  /** Auction franchise logo. */
  franchiseLogoUrl?: string;
  /** @deprecated use franchiseName */
  teamName?: string;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  masterPlayerId?: string;
};

/** Player/pair info for one side. */
export type BadmintonSideInfo = {
  /** Display label (name or pair names). */
  label: string;
  /** Short label (surname or abbreviated pair). */
  shortLabel: string;
  /** Country/team code (up to 3 chars). */
  countryCode?: string;
  /** Country/team full name. */
  countryName?: string;
  /** Photo URL for display. */
  photoUrl?: string;
  /** Flag URL. */
  flagUrl?: string;
  /** National team color (hex). */
  teamColor?: string;
  /** Auction franchise name — informational only; does not define pairing. */
  franchiseName?: string;
  /** Auction franchise logo. */
  franchiseLogoUrl?: string;
  /** @deprecated use franchiseName */
  teamName?: string;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string;
  /** Sponsor name. */
  sponsorName?: string;
  /** Sponsor logo URL. */
  sponsorLogoUrl?: string;
  /** Master player ID (global_players.id). */
  masterPlayerId?: string;
  /** Internal player IDs (1 for singles, 2 for doubles). */
  playerIds: number[];
  /** Individual players for doubles / mixed doubles display. */
  players?: BadmintonPlayerSlot[];
};

export type BadmintonGameState = {
  gameNumber: number;
  /** Score for left side. */
  leftScore: number;
  /** Score for right side. */
  rightScore: number;
  /** Which side is serving at this moment. */
  servingSide: BadmintonSide;
  /** Has the 11-point interval been reached in the deciding game? */
  intervalReached: boolean;
  /** Phase: in_progress | completed. */
  phase: "in_progress" | "completed";
  /** Winning side (set when phase = completed). */
  winner?: BadmintonSide;
  /** ISO timestamp when game started. */
  startedAt?: string;
  /** ISO timestamp when game completed. */
  endedAt?: string;
};

export type BadmintonTimeoutInfo = {
  side: BadmintonSide;
  takenAt: string;
};

export type BadmintonMatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "walkover"
  | "retired"
  | "disqualified"
  | "abandoned";

export type BadmintonResultReason =
  | "normal"
  | "walkover"
  | "retirement"
  | "disqualification"
  | "abandoned";

/** Full match state reconstructed by replaying events. */
export type BadmintonMatchState = {
  matchId: number;
  tournamentId: number;
  matchKind: BadmintonMatchKind;
  format: BadmintonMatchFormat;

  matchStatus: BadmintonMatchStatus;

  /** Left side info (injected at match start). */
  leftSide: BadmintonSideInfo;
  /** Right side info. */
  rightSide: BadmintonSideInfo;

  /** Number of games won by left side. */
  gamesLeft: number;
  /** Number of games won by right side. */
  gamesRight: number;

  /** 1-indexed current game. */
  currentGame: number;

  /** Current game's scores (convenience alias). */
  leftScore: number;
  rightScore: number;

  /** All games (including current). */
  games: BadmintonGameState[];

  /** Which side is currently serving (pair side in doubles). */
  servingSide: BadmintonSide;

  /**
   * Doubles / mixed doubles only — player-level service, receiver, and court positions.
   * Singles matches leave this undefined.
   */
  doublesServe?: import("./scoring/types").DoublesServeState;

  /** Is the match in the 11-point interval break of the deciding game? */
  inInterval: boolean;

  /** Timeout currently in progress. */
  activeTimeout: BadmintonTimeoutInfo | null;

  /** Side that won the match. */
  winnerSide?: BadmintonSide;

  /** How match ended. */
  resultReason?: BadmintonResultReason;

  /** Last processed event sequence number. */
  lastSequence: number;

  /** Milliseconds since match started (set by summary layer). */
  elapsedMs?: number;

  /** Running total of rallies. */
  totalRallies: number;
};

/** Minimal input to create initial state. */
export type BadmintonMatchMeta = {
  matchId: number;
  tournamentId: number;
  matchKind: BadmintonMatchKind;
  format?: BadmintonMatchFormat;
};

export type ScoringActorType = "organizer" | "admin" | "scorer_pin" | "system";

/** Generic event envelope used by the reducer. */
export type BadmintonEventEnvelope<TPayload = Record<string, unknown>> = {
  id?: number;
  matchId: number;
  tournamentId: number;
  sportSlug: "badminton";
  eventType: string;
  eventVersion: number;
  sequence: number;
  occurredAt?: Date | string;
  actorType: ScoringActorType;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: number | null;
  payload: TPayload;
};
