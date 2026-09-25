/**
 * BidWar broadcast — PRESENTATION CONTRACTS
 *
 * These are the design-side shapes the overlay components render.
 * They intentionally mirror the existing BidWar production concepts so an
 * engineer can map them 1:1 (or with a thin adapter) without touching visuals.
 *
 * Production counterpart is noted on every type. Do NOT treat this file as a
 * second source of truth — in production, replace these with (or adapt from)
 * the real BidWar types.
 */

/** Production: BroadcastSceneId */
export type BroadcastSceneId =
  | "WAITING"
  | "AUCTION"
  | "SOLD"
  | "UNSOLD"
  | "BREAK"
  | "SUMMARY"
  | "TOP5"
  | "TEAM"
  | "CRICKET";

/** Production: SponsorLogo (sponsor service) */
export interface SponsorLogo {
  id: string;
  name: string;
  logoUrl?: string;
  tier: "title" | "associate";
  /** Optional tagline shown above title sponsor, e.g. "Official Partner" */
  label?: string;
}

/** Production: branding service output */
export interface BroadcastBranding {
  /** Primary word, rendered white italic: "BIDWAR" */
  tournamentName: string;
  /** Accent words, rendered gold: "PREMIER LEAGUE" */
  tournamentAccent: string;
  /** Crest fallback text: "BPL" */
  tournamentShort: string;
  tournamentLogoUrl?: string;
  /** Optional venue / location subline for header display */
  venue?: string;
}

/** Production: TeamPurse */
export interface TeamPurse {
  teamId: string;
  name: string;
  short: string;
  logoUrl?: string;
  purseRemaining: number;
  playersBought: number;
  slotsRemaining: number;
}

/** Production: player entity used by AuctionState */
export interface AuctionPlayer {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  basePrice: number;
  category?: string;
}

/** Production: AuctionSceneModel */
export interface AuctionSceneModel {
  player: AuctionPlayer;
  currentBid: number;
  leadingTeam?: TeamPurse;
  bidCount: number;
  /** Seconds remaining on the hammer timer, if BidWar exposes one */
  timerSeconds?: number;
}

/** Production: SoldSceneModel */
export interface SoldSceneModel {
  player: AuctionPlayer;
  soldPrice: number;
  team: TeamPurse;
}

/** Production: UnsoldSceneModel */
export interface UnsoldSceneModel {
  player: AuctionPlayer;
}

/** Production: WAITING scene payload (AuctionState idle) */
export interface WaitingSceneModel {
  headline: string;
  subline?: string;
}

/** Production: BREAK scene payload */
export interface BreakSceneModel {
  headline: string;
  subline?: string;
}

/** Production: Summary */
export interface SummaryModel {
  totalSold: number;
  totalUnsold: number;
  totalSpent: number;
  highest?: { playerName: string; price: number; teamShort: string };
}

/** Production: Top5 */
export interface Top5Model {
  title: string;
  entries: { rank: number; playerName: string; role: string; teamShort: string; price: number }[];
}

/** Production: Team */
export interface TeamModel {
  team: TeamPurse;
  squad: { name: string; role: string; price: number }[];
}

/* ------------------------------ Cricket ------------------------------ */

/** Production: existing cricket scoring state — ball token */
export type BallKind = "dot" | "run" | "four" | "six" | "wicket" | "wide" | "noball" | "bye";
export interface BallEvent {
  kind: BallKind;
  /** Display label, e.g. "2", "Wd", "W", "4" */
  label: string;
}

export interface BatterLine {
  name: string;
  runs: number;
  balls: number;
  onStrike: boolean;
}

export interface BowlerLine {
  name: string;
  wickets: number;
  runs: number;
  overs: string;
}

/** Production: existing cricket scoring state */
export interface CricketScoreModel {
  battingTeam: { short: string; name: string; logoUrl?: string };
  bowlingTeamShort: string;
  runs: number;
  wickets: number;
  /** "1.3" */
  overs: string;
  maxOvers: number;
  crr: number;
  striker: BatterLine;
  nonStriker: BatterLine;
  bowler: BowlerLine;
  thisOver: BallEvent[];
  /** Right-hand panel. Omit during live play to show match-state text. */
  result?: { kicker: string; headline: string; detail?: string };
  /** Footer status chip + text, e.g. { chip: "FINAL", text: "WON BY WALKOVER" } */
  status: { chip: string; text: string };

  // ── Optional Extended Live Fields (Phase 9 scorebug enhancement) ──
  /** Required Run Rate — only defined during chase */
  rrr?: number | null;
  /** Runs still needed to win — only during chase */
  needRuns?: number | null;
  /** Balls remaining in chase innings */
  ballsRemaining?: number | null;
  /** Current partnership as "X(Y)" or text */
  partnership?: string | null;
  /** Whether Free Hit is active for the next delivery */
  freeHitActive?: boolean;
  /** Whether Superball (2x multiplier) is active */
  superBallActive?: boolean;
  /** Powerplay text, e.g. "POWERPLAY 1 · OVERS 1–6" */
  powerplayText?: string | null;
  /** First innings score line for chase display, e.g. "RYD 142/6 (20 ov)" */
  firstInningsScore?: string | null;
  /** Match phase for conditional rendering decisions */
  phase?: "live" | "chase" | "pre_match" | "innings_break" | "completed" | "no_live";
}

/* ------------------------------ Frame ------------------------------- */

/** Production: BroadcastSettings */
export interface BroadcastSettings {
  /** OBS performance mode — disables glows, sweeps and non-essential motion */
  performanceMode: boolean;
  showTicker: boolean;
}

export type FeedStatus = "live" | "stale" | "disconnected";

export type ScenePayload =
  | { scene: "WAITING"; model: WaitingSceneModel }
  | { scene: "AUCTION"; model: AuctionSceneModel }
  | { scene: "SOLD"; model: SoldSceneModel }
  | { scene: "UNSOLD"; model: UnsoldSceneModel }
  | { scene: "BREAK"; model: BreakSceneModel }
  | { scene: "SUMMARY"; model: SummaryModel }
  | { scene: "TOP5"; model: Top5Model }
  | { scene: "TEAM"; model: TeamModel }
  | { scene: "CRICKET"; model: CricketScoreModel };

/** Production: BroadcastFrame (output of useBroadcastDirector) */
export type BroadcastFrame = {
  branding: BroadcastBranding;
  sponsors: SponsorLogo[];
  teams: TeamPurse[];
  settings: BroadcastSettings;
  feed: { status: FeedStatus; secondsSinceUpdate?: number };
} & ScenePayload;
