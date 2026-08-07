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

/**
 * Declared capabilities for a sport module.
 * Shared SportsShell / Mission Control chrome must branch on these —
 * never assume cricket concepts in generic Sports UI.
 */
export type SportCapabilities = {
  sportId: string;
  sportLabel: string;
  hasPlayingXi?: boolean;
  hasOvers?: boolean;
  hasCaptain?: boolean;
  hasCourts?: boolean;
  hasDraw?: boolean;
  hasStandings?: boolean;
  hasStatistics?: boolean;
  hasMatchCenter?: boolean;
  hasPublicTournament?: boolean;
  hasBroadcast?: boolean;
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
