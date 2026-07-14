import type { LucideIcon } from "lucide-react";

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
};

/** Labeled group of nav items (Setup, Operations, …). */
export type SportNavSection = {
  id: string;
  label: string;
  items: SportNavItem[];
};

/**
 * Sport-specific navigation plugged into SportsShell.
 * Auction keeps AppLayout; new sports provide a config like this.
 */
export type SportNavConfig = {
  sportId: string;
  /** Shown in collapsed/expanded section headers when useful. */
  sportLabel: string;
  sections: SportNavSection[];
};
