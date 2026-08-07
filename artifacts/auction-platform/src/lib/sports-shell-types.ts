import type { LucideIcon } from "lucide-react";

/** Leaf destination under a parent module (sidebar sub-nav). */
export type SportNavChild = {
  id: string;
  label: string;
  href: (tournamentId: number) => string;
  isActive: (pathname: string, tournamentId: number) => boolean;
  /** Prefetch route chunk on hover/focus. */
  preload?: () => void;
};

/** Single sidebar destination for a sport module. */
export type SportNavItem = {
  id: string;
  label: string;
  href: (tournamentId: number) => string;
  isActive: (pathname: string, tournamentId: number) => boolean;
  icon?: LucideIcon;
  /** Open in a new browser tab (e.g. public display URLs). */
  external?: boolean;
  /** Optional short hint under the label when expanded. */
  hint?: string;
  /** Prefetch route chunk on hover/focus (sidebar perceived speed). */
  preload?: () => void;
  /**
   * Optional child pages shown when the parent is expanded.
   * Parent click toggles the submenu; child click navigates.
   */
  children?: SportNavChild[];
};

/** Labeled group of nav items (Setup, Operations, …). */
export type SportNavSection = {
  id: string;
  label: string;
  items: SportNavItem[];
};

/** Deep-link surfaced in Live Operations (Mission Control). */
export type SportLiveOpsLink = {
  id: string;
  title: string;
  description: string;
  buildHref: (ctx: { tournamentId: number; encodedReturnTo: string }) => string;
  external?: boolean;
};

/**
 * Declared capabilities for a sport module.
 * Shared SportsShell / Mission Control chrome must branch on these —
 * never assume cricket concepts in generic Sports UI.
 */
export type SportCapabilities = {
  sportId: string;
  sportLabel: string;

  /** Playing squad selection (cricket: Playing XI). */
  hasPlayingXi: boolean;
  /** Bench / substitute slots alongside playing squad. */
  hasBench: boolean;
  /** Overs-limited innings (cricket). */
  hasOvers: boolean;
  /** Captain / vice-captain team roles. */
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

  /** Legacy free-text batting/bowling style fields (cricket registration fallback). */
  hasLegacyCricketSpecs: boolean;

  /** Sport-specific label for the active playing squad. */
  playingSquadLabel: string;
  /** Sport-specific label for bench / substitutes. */
  benchLabel: string;
  /** Short description for the statistics module tile. */
  statisticsDescription: string;
  /** Short description for the public tournament tile. */
  publicTournamentDescription: string;

  /** Capability-gated Live Operations deep links for this sport. */
  liveOpsLinks: SportLiveOpsLink[];
  /** Summary lines for Live Operations quick-peek when sports is active. */
  liveOpsPeekLines: string[];
};

/**
 * Sport-specific navigation plugged into SportsShell.
 * Auction keeps AppLayout; sports provide a config like this.
 */
export type SportNavConfig = {
  sportId: string;
  /** Shown in collapsed/expanded section headers when useful. */
  sportLabel: string;
  sections: SportNavSection[];
  /** Optional capability map for capability-driven chrome. */
  capabilities?: SportCapabilities;
};
