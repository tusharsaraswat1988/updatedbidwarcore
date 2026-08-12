/**
 * Per-sport capability declarations — Sports platform source of truth.
 *
 * Shared Sports UI, catalogs, and validators must branch on these flags.
 * Never hard-code cricket concepts (Captain, Playing XI, overs, LBW) in
 * generic Sports code. Live Ops deep links stay in the Sports UI host.
 */

export type SportCapabilityFlags = {
  sportId: string;
  sportLabel: string;

  /** Playing squad selection (cricket: Playing XI). */
  hasPlayingXi: boolean;
  /** Bench / substitute slots alongside playing squad. */
  hasBench: boolean;
  /** Overs-limited innings (cricket). */
  hasOvers: boolean;
  /** Captain / vice-captain team roles and tags. */
  hasCaptain: boolean;
  /** Court or lane assignment (badminton, tennis, …). */
  hasCourts: boolean;
  /** Tournament draw / bracket generation. */
  hasDraw: boolean;
  /** Points table / league standings. */
  hasStandings: boolean;
  /** Career or tournament statistics module. */
  hasStatistics: boolean;
  /** Match Command Center for live scoring entry. */
  hasMatchCenter: boolean;
  /** Public fan tournament page. */
  hasPublicTournament: boolean;
  /** Broadcast / OBS director surfaces. */
  hasBroadcast: boolean;

  /** Powerplay phases (cricket). */
  hasPowerplay: boolean;
  /** LBW dismissal type (cricket). */
  hasLBW: boolean;
  /** Retire-at-runs option (cricket). */
  hasRetire: boolean;
  /** Super Over tie-break (cricket). */
  hasSuperOver: boolean;
  /** Match officials roster (umpires, referees). */
  hasOfficials: boolean;
  /** Pre-match coin toss (cricket). */
  hasCoinToss: boolean;
  /** Boundary scoring (4s/6s — cricket). */
  hasBoundaries: boolean;

  /** Set-based scoring (badminton, tennis, volleyball). */
  hasSets: boolean;
  /** Service side tracking (badminton, tennis). */
  hasServiceSide: boolean;

  /**
   * Legacy free-text batting/bowling style fields and CricHero registration
   * (cricket registration fallback).
   */
  hasLegacyCricketSpecs: boolean;

  /** Sport-specific label for the active playing squad. */
  playingSquadLabel: string;
  /** Sport-specific label for bench / substitutes. */
  benchLabel: string;
  /** Short description for the statistics module tile. */
  statisticsDescription: string;
  /** Short description for the public tournament tile. */
  publicTournamentDescription: string;
};

const CRICKET_CAPABILITIES: SportCapabilityFlags = {
  sportId: "cricket",
  sportLabel: "Cricket",
  hasPlayingXi: true,
  hasBench: true,
  hasOvers: true,
  hasCaptain: true,
  hasCourts: false,
  hasDraw: false,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: true,
  hasPublicTournament: true,
  hasBroadcast: true,
  hasPowerplay: true,
  hasLBW: true,
  hasRetire: true,
  hasSuperOver: true,
  hasOfficials: true,
  hasCoinToss: true,
  hasBoundaries: true,
  hasSets: false,
  hasServiceSide: false,
  hasLegacyCricketSpecs: true,
  playingSquadLabel: "Playing XI",
  benchLabel: "Bench",
  statisticsDescription: "Runs, wickets, SR, economy, and more.",
  publicTournamentDescription: "Fan-facing fixtures, standings, and stats.",
};

const BADMINTON_CAPABILITIES: SportCapabilityFlags = {
  sportId: "badminton",
  sportLabel: "Badminton",
  hasPlayingXi: false,
  hasBench: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: true,
  hasDraw: true,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: true,
  hasPowerplay: false,
  hasLBW: false,
  hasRetire: false,
  hasSuperOver: false,
  hasOfficials: true,
  hasCoinToss: false,
  hasBoundaries: false,
  hasSets: true,
  hasServiceSide: true,
  hasLegacyCricketSpecs: false,
  playingSquadLabel: "Lineup",
  benchLabel: "Reserves",
  statisticsDescription: "Match results, head-to-head, and player form.",
  publicTournamentDescription: "Fan-facing draws and results.",
};

const UNKNOWN_CAPABILITIES_BASE: Omit<SportCapabilityFlags, "sportId"> = {
  sportLabel: "Sports",
  hasPlayingXi: false,
  hasBench: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: false,
  hasDraw: false,
  hasStandings: false,
  hasStatistics: false,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: false,
  hasPowerplay: false,
  hasLBW: false,
  hasRetire: false,
  hasSuperOver: false,
  hasOfficials: false,
  hasCoinToss: false,
  hasBoundaries: false,
  hasSets: false,
  hasServiceSide: false,
  hasLegacyCricketSpecs: false,
  playingSquadLabel: "Lineup",
  benchLabel: "Reserves",
  statisticsDescription: "Tournament statistics.",
  publicTournamentDescription: "Public tournament page.",
};

/**
 * Resolve capability flags for a sport.
 * Missing / unknown sports get safe defaults — never cricket.
 */
export function getSportCapabilities(
  sport: string | null | undefined,
): SportCapabilityFlags {
  const key = (sport ?? "").trim().toLowerCase();
  if (key === "cricket") return CRICKET_CAPABILITIES;
  if (key === "badminton") return BADMINTON_CAPABILITIES;
  return {
    ...UNKNOWN_CAPABILITIES_BASE,
    sportId: key || "unknown",
  };
}

/** Team role ids that require hasCaptain. */
const CAPTAIN_TEAM_ROLE_IDS = new Set(["captain", "vice_captain"]);

/** Player tag values that require hasCaptain. */
const CAPTAIN_TAG_VALUES = new Set(["captain", "vice_captain"]);

/** Team formation strategies that require hasCaptain. */
const CAPTAIN_FORMATION_IDS = new Set(["captain_pick"]);

export function isTeamRoleSupportedByCapabilities(
  roleId: string,
  caps: Pick<SportCapabilityFlags, "hasCaptain">,
): boolean {
  if (CAPTAIN_TEAM_ROLE_IDS.has(roleId)) return caps.hasCaptain;
  return true;
}

export function isTeamFormationSupportedByCapabilities(
  formationId: string,
  caps: Pick<SportCapabilityFlags, "hasCaptain">,
): boolean {
  if (CAPTAIN_FORMATION_IDS.has(formationId)) return caps.hasCaptain;
  return true;
}

/** Filter player tag options to those supported by the sport. */
export function filterPlayerTagOptions<T extends { value: string }>(
  caps: Pick<SportCapabilityFlags, "hasCaptain">,
  options: readonly T[],
): T[] {
  return options.filter((opt) => {
    if (CAPTAIN_TAG_VALUES.has(opt.value)) return caps.hasCaptain;
    return true;
  });
}

/** Playing membership roles used for squad size checks. */
export function playingTeamRoleIds(
  caps: Pick<SportCapabilityFlags, "hasCaptain">,
): ReadonlySet<string> {
  if (caps.hasCaptain) {
    return new Set(["player", "captain", "vice_captain"]);
  }
  return new Set(["player"]);
}
