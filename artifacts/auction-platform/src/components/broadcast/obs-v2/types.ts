/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Data Contracts and Composition Models for Master Stage
 */

export interface ObsV2TeamInfo {
  name: string;
  shortCode: string;
  color?: string;
  logoUrl?: string | null;
}

export interface ObsV2HeaderData {
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  matchContext?: string; // e.g. "Qualifier 01", "Match 14", "Final"
  live?: boolean;
  statusLabel?: string; // e.g. "LIVE", "CHASE", "INNINGS BREAK", "COMPLETED", "STANDBY", "SYNCING"
}

export interface ObsV2ScorebugData {
  battingTeam?: ObsV2TeamInfo | null;
  bowlingTeam?: ObsV2TeamInfo | null;
  runs?: number | null;
  wickets?: number | null;
  overs?: string | number | null; // e.g. "17.3"
  maxOvers?: number | null; // e.g. 20
  target?: number | null;
  needRuns?: number | null;
  ballsRemaining?: number | null;
  crr?: string | number | null;
  rrr?: string | number | null;
  statusText?: string | null; // e.g. "NEED 44 RUNS IN 15 BALLS" or "TITANS WON BY 4 WKTS"
  phase?: string;
  isLoading?: boolean;
}

export interface ObsV2StageData {
  header: ObsV2HeaderData;
  scorebug: ObsV2ScorebugData;
  phase?: string;
  isLoading?: boolean;
  connectionStatus?: "connected" | "reconnecting" | "disconnected";
}

/**
 * Deterministic mock data for development, unit testing, and preview calibration.
 */
export const MOCK_OBS_V2_STAGE_DATA: ObsV2StageData = {
  header: {
    tournamentName: "BidWar Premier League",
    matchContext: "Qualifier 01",
    live: true,
    statusLabel: "LIVE",
  },
  scorebug: {
    battingTeam: {
      name: "Titans Cricket Club",
      shortCode: "TIT",
      color: "#3B82F6",
    },
    bowlingTeam: {
      name: "Royal Strikers",
      shortCode: "RS",
      color: "#EF4444",
    },
    runs: 124,
    wickets: 4,
    overs: "17.3",
    maxOvers: 20,
    target: 168,
    needRuns: 44,
    ballsRemaining: 15,
    crr: "7.08",
    rrr: "17.60",
    statusText: "NEED 44 RUNS IN 15 BALLS",
    phase: "chase",
    isLoading: false,
  },
  phase: "chase",
  isLoading: false,
  connectionStatus: "connected",
};

export interface ObsV2BroadcastMessageData {
  /** Category or context tag (e.g. "MATCH UPDATE", "WEATHER DELAY", "OFFICIAL NOTICE") */
  eyebrow?: string;
  /** Primary broadcast headline (e.g. "POWERPLAY 1 COMPLETE") */
  message: string;
  /** Secondary narrative or contextual detail (e.g. "Riverside CC 52/1 after 6 overs") */
  supportingText?: string;
}

/**
 * Deterministic mock broadcast message for visual prototype review
 */
export const MOCK_OBS_V2_BROADCAST_MESSAGE: ObsV2BroadcastMessageData = {
  eyebrow: "MATCH UPDATE",
  message: "POWERPLAY 1 COMPLETE",
  supportingText: "Riverside CC 52/1 after 6 overs",
};

