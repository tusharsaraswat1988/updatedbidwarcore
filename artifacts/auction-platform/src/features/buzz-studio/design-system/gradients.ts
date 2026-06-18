/**
 * Buzz Studio — Gradient System
 *
 * Reusable CSS gradient string constants for all templates.
 * Import and use directly in style objects or background properties.
 *
 * All gradients are derived from defaultBuzzTheme tokens.
 * No arbitrary color values.
 *
 * Usage:
 *   import { Gradients } from "../design-system/gradients";
 *   <div style={{ background: Gradients.AuctionGlow }} />
 */

import { defaultBuzzTheme } from "../theme/buzz-theme";

const t = defaultBuzzTheme;

export const Gradients = {
  /**
   * Radial gold glow — used as the ambient halo behind player/avatar frames.
   * Applied to a slightly oversized absolutely-positioned div behind the ring.
   */
  GoldGlow: `radial-gradient(circle, ${t.primaryGold}22 0%, transparent 70%)`,

  /**
   * Dark premium surface gradient — monogram fallback backgrounds,
   * card inner surfaces, anywhere a deep dark-to-near-black gradient is needed.
   */
  DarkPremium: `linear-gradient(160deg, #1a1a1a 0%, ${t.cardBackground} 100%)`,

  /**
   * Victory/winner green glow — champion cards, winner reveal, match winner.
   */
  VictoryGlow: `radial-gradient(circle, ${t.success}22 0%, transparent 70%)`,

  /**
   * Auction gold ring gradient — the gold border ring on player frames,
   * sold badges, bid price highlights.
   */
  AuctionGlow: `linear-gradient(135deg, ${t.primaryGold}, ${t.secondaryGold} 60%, ${t.primaryGold})`,

  /**
   * Center spotlight — subtle elliptical glow radiating from the center.
   * Used on card backgrounds to add depth without heavy animation.
   */
  SpotlightGlow: `radial-gradient(ellipse at center, ${t.primaryGold}15 0%, transparent 65%)`,

  /**
   * Gold divider — horizontal line that fades in from the center.
   * Used to visually separate name area from team area.
   */
  GoldDivider: `linear-gradient(90deg, transparent, ${t.primaryGold}40, transparent)`,

  /**
   * Dark surface for small monogram circles (team logos, avatar fallbacks).
   * Slightly lighter than cardBackground for contrast against the card surface.
   */
  MonogramSurface: `linear-gradient(135deg, #1e1e1e, #141414)`,

  /**
   * Subtle inner card gradient — BidwarCanvas card surface.
   */
  CardSurface: `linear-gradient(180deg, ${t.cardBackground} 0%, #080808 100%)`,

  /**
   * Danger/error glow — unsold or flagged player cards.
   */
  DangerGlow: `radial-gradient(circle, ${t.danger}1A 0%, transparent 70%)`,
} as const;
