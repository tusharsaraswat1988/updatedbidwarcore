/**
 * Buzz Studio — Gradient System
 *
 * Minimal set of gradient constants used by the frame and badge design system.
 * These are component-level UI gradients (player rings, monogram surfaces, price
 * blocks) — NOT background generators.
 *
 * Canvas-level backgrounds are admin-uploaded full-bleed images managed by the
 * Creative Assets Manager and resolved at render time. Templates never generate
 * poster backgrounds.
 */

import { defaultBuzzTheme } from "../theme/buzz-theme";

const t = defaultBuzzTheme;

export const Gradients = {
  /**
   * Dark premium surface — monogram fallback backgrounds for PlayerFrame and
   * AvatarFrame when no player image is available.
   */
  DarkPremium: `linear-gradient(160deg, #1a1a1a 0%, ${t.cardBackground} 100%)`,

  /**
   * Auction gold ring — the gold gradient ring wrapping player avatar frames.
   */
  AuctionGlow: `linear-gradient(135deg, ${t.primaryGold}, ${t.secondaryGold} 60%, ${t.primaryGold})`,

  /**
   * Monogram surface — small dark circle for team logos and avatar initials.
   */
  MonogramSurface: `linear-gradient(135deg, #1e1e1e, #141414)`,

} as const;
