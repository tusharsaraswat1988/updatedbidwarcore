/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Broadcast Event Graphics Contracts & Priority Hierarchy
 *
 * Supported Event Types:
 * - FOUR: Boundary hit along the ground (+4 runs)
 * - SIX: Maximum hit over the boundary (+6 runs)
 * - WICKET: Batter dismissed (highest priority standard event)
 * - NO_BALL: Illegal delivery + extra run + Free Hit next ball
 * - WIDE: Illegal delivery + extra run
 * - FREE_HIT: Delivery where batter cannot be out bowled/caught
 * - MILESTONE: Individual batter scoring milestone (50 or 100 runs)
 * - SUPERBALL: Active 2x multiplier ball
 * - SUPER_OVER: Tie-breaker eliminator over
 * - TOSS_WIN: Pre-match toss decision
 * - MATCH_WON: Terminal match victory announcement
 */

import { OBS_V2 } from "./obs-v2-tokens.ts";

export type ObsV2EventType =
  | "FOUR"
  | "SIX"
  | "WICKET"
  | "NO_BALL"
  | "WIDE"
  | "FREE_HIT"
  | "MILESTONE"
  | "SUPERBALL"
  | "SUPER_OVER"
  | "TOSS_WIN"
  | "MATCH_WON"
  | "NEW_BATSMAN"
  | "NEW_BATTER"
  | "NEW_BOWLER"
  | "INNINGS_COMPLETE";

export interface ObsV2BroadcastEvent {
  /** Unique deterministic identifier for deduplication (e.g. "matchId-seq-type") */
  id: string;
  /** Categorical event type */
  type: ObsV2EventType;
  /** Match identifier to ensure event belongs to active match */
  matchId: number | null;
  /** Timestamp when event was generated / recorded */
  timestamp: number;
  /** Dominant broadcast title (e.g. "BOUNDARY 4", "MAXIMUM 6", "WICKET", "HALF CENTURY") */
  title: string;
  /** Explanatory subtitle or cricket context */
  subtitle: string;
  /** Primary semantic accent color from OBS_V2 tokens */
  accentColor: string;
  /** Secondary highlight border color */
  borderColor: string;
  /** Numeric event priority for collision resolution (higher numbers supersede lower) */
  priority: number;
  /** Optional batter name */
  batter?: string;
  /** Optional bowler name */
  bowler?: string;
  /** Optional runs scored on delivery */
  runs?: number;
  /** Optional milestone value (e.g. 50 or 100) */
  milestoneValue?: number;
  /** Optional detailed context (e.g. dismissal method, strike rate) */
  detail?: string;
  /** Optional innings complete fields */
  innings?: number;
  wickets?: number;
  overs?: string;
  target?: number | null;
  battingTeam?: string;
  /** Optional match won / completion fields */
  winnerName?: string;
  marginText?: string;
}

/**
 * Deterministic Event Priority Model
 *
 * Collision Handling Strategy:
 * When multiple events arrive close together:
 * 1. An incoming event with higher or equal priority immediately replaces the active event.
 * 2. An incoming event with lower priority is suppressed while a higher-priority event is active.
 */
export const OBS_V2_EVENT_PRIORITY: Record<ObsV2EventType, number> = {
  MATCH_WON: 100, // Terminal victory announcement
  INNINGS_COMPLETE: 95, // Innings conclusion
  WICKET: 90, // Major breakthrough / dismissal
  MILESTONE: 80, // Individual 50 / 100 achievement
  SIX: 70, // Maximum boundary
  NEW_BATTER: 65, // New batter arrival at the crease
  NEW_BATSMAN: 65, // Legacy alias for new batter
  NEW_BOWLER: 64, // New bowler introduced into attack
  FOUR: 60, // Standard boundary
  SUPERBALL: 55, // Active 2x multiplier delivery
  SUPER_OVER: 50, // Tie-break decider
  FREE_HIT: 40, // Free hit activation
  NO_BALL: 35, // Illegal delivery
  WIDE: 30, // Wide extra delivery
  TOSS_WIN: 20, // Pre-match decision
};

/**
 * Base styling and copy configuration mapped to the V2 token system.
 */
export interface ObsV2EventConfig {
  title: string;
  subtitle: string;
  accentColor: string;
  borderColor: string;
  priority: number;
}

export const OBS_V2_EVENT_CONFIGS: Record<ObsV2EventType, ObsV2EventConfig> = {
  FOUR: {
    title: "BOUNDARY 4",
    subtitle: "FOUR RUNS OFF THE BAT",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.FOUR,
  },
  SIX: {
    title: "MAXIMUM 6",
    subtitle: "MASSIVE HIT INTO THE STANDS",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.SIX,
  },
  WICKET: {
    title: "WICKET",
    subtitle: "BATTER DISMISSED · MAJOR BREAKTHROUGH",
    accentColor: OBS_V2.color.danger,
    borderColor: OBS_V2.color.dangerBorder,
    priority: OBS_V2_EVENT_PRIORITY.WICKET,
  },
  MILESTONE: {
    title: "MILESTONE",
    subtitle: "OUTSTANDING BATTING ACHIEVEMENT",
    accentColor: OBS_V2.color.success,
    borderColor: OBS_V2.color.successBorder,
    priority: OBS_V2_EVENT_PRIORITY.MILESTONE,
  },
  NO_BALL: {
    title: "NO BALL",
    subtitle: "EXTRA RUN · FREE HIT AWARDED NEXT BALL",
    accentColor: OBS_V2.color.warning,
    borderColor: OBS_V2.color.warningBorder,
    priority: OBS_V2_EVENT_PRIORITY.NO_BALL,
  },
  WIDE: {
    title: "WIDE BALL",
    subtitle: "ILLEGAL DELIVERY · EXTRA RUN CONCEDED",
    accentColor: OBS_V2.color.neutral,
    borderColor: OBS_V2.color.neutralBorder,
    priority: OBS_V2_EVENT_PRIORITY.WIDE,
  },
  FREE_HIT: {
    title: "FREE HIT",
    subtitle: "NO DISMISSAL ON NEXT LEGAL BALL",
    accentColor: OBS_V2.color.info,
    borderColor: OBS_V2.color.infoBorder,
    priority: OBS_V2_EVENT_PRIORITY.FREE_HIT,
  },
  SUPERBALL: {
    title: "SUPERBALL",
    subtitle: "2X RUNS MULTIPLIER ACTIVE",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.SUPERBALL,
  },
  SUPER_OVER: {
    title: "SUPER OVER",
    subtitle: "MATCH TIED · ONE OVER ELIMINATOR",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.SUPER_OVER,
  },
  TOSS_WIN: {
    title: "TOSS UPDATE",
    subtitle: "OFFICIAL DECISION ANNOUNCED",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.TOSS_WIN,
  },
  MATCH_WON: {
    title: "MATCH WON",
    subtitle: "VICTORY ACHIEVED",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.MATCH_WON,
  },
  INNINGS_COMPLETE: {
    title: "INNINGS COMPLETE",
    subtitle: "INNINGS CONCLUDED",
    accentColor: OBS_V2.color.brand,
    borderColor: OBS_V2.color.brandBorder,
    priority: OBS_V2_EVENT_PRIORITY.INNINGS_COMPLETE,
  },
  NEW_BATSMAN: {
    title: "NEW BATTER",
    subtitle: "NEXT BATTER ARRIVES AT THE CREASE",
    accentColor: OBS_V2.color.info,
    borderColor: OBS_V2.color.infoBorder,
    priority: OBS_V2_EVENT_PRIORITY.NEW_BATSMAN,
  },
  NEW_BATTER: {
    title: "NEW BATTER",
    subtitle: "NEXT BATTER ARRIVES AT THE CREASE",
    accentColor: OBS_V2.color.info,
    borderColor: OBS_V2.color.infoBorder,
    priority: OBS_V2_EVENT_PRIORITY.NEW_BATTER,
  },
  NEW_BOWLER: {
    title: "NEW BOWLER",
    subtitle: "INTO THE BOWLING ATTACK",
    accentColor: OBS_V2.color.success,
    borderColor: OBS_V2.color.successBorder,
    priority: OBS_V2_EVENT_PRIORITY.NEW_BOWLER,
  },
};
