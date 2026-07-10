/**
 * Buzz Studio — Common Contract Types
 *
 * Shared building blocks composed into every template contract.
 * These interfaces represent the stable data shapes that:
 *   - Templates consume (never raw DB models)
 *   - Mappers produce (from any upstream data source)
 *   - The renderer reads (for PNG generation)
 *
 * No business logic. No rendering. No imports from application code.
 * Only SportType is imported — it is an isolated enum with no DB dependency.
 */

import { SportType } from "../types/sport-types";

/* ─── Metadata ───────────────────────────────────────────────────────────── */

/**
 * Optional diagnostic envelope attached to every contract.
 * Useful for cache-busting, audit trails, and renderer logs.
 */
export interface ContractMetadata {
  /** ISO 8601 timestamp when this contract was generated. */
  generatedAt?: string;
  /** Identifier of the system or user that produced the contract. */
  generatedBy?: string;
  /** Arbitrary key-value tags for debugging or telemetry. */
  tags?: Record<string, string>;
}

/* ─── Sport ──────────────────────────────────────────────────────────────── */

/**
 * Carries the sport context used to select the correct sport badge,
 * color accent, or template variant.
 */
export interface ContractSportInfo {
  sport: SportType;
}

/* ─── Player ─────────────────────────────────────────────────────────────── */

/**
 * Minimal player identity block.
 * All image fields are optional — the design system handles monogram fallbacks.
 */
export interface ContractPlayerInfo {
  /** Source system player ID. Optional — used for cache-key or analytics only. */
  playerId?: string;
  /** Display name. Required for monogram generation and template rendering. */
  playerName: string;
  /** Resolved image URL. Absent → monogram avatar rendered by the design system. */
  playerImageUrl?: string;
}

/* ─── Team ───────────────────────────────────────────────────────────────── */

/**
 * Minimal team identity block.
 * All fields are optional — teams are not always known at spotlight time.
 */
export interface ContractTeamInfo {
  /** Source system team ID. Optional — used for analytics only. */
  teamId?: string;
  /** Display name. Used by TeamSlot for monogram fallback. */
  teamName?: string;
  /** Resolved team logo URL. Absent → monogram rendered by the design system. */
  teamLogoUrl?: string;
}

/* ─── Price / Currency ───────────────────────────────────────────────────── */

/**
 * Monetary value with optional auction unit / currency code.
 * Used in sold cards, top-buy lists, and auction summaries.
 */
export interface ContractPriceInfo {
  /** Numeric value in the smallest logical unit (e.g. full rupees or points). */
  amount: number;
  /**
   * Tournament auction unit — "rupee" | "points".
   * Prefer this over `currency` for display formatting.
   * @default "rupee"
   */
  auctionUnit?: string;
  /**
   * Legacy currency code ("INR" | "points"). Prefer `auctionUnit`.
   * @default "INR"
   */
  currency?: string;
  /**
   * Pre-formatted display string.
   * When provided, templates use this directly instead of formatting `amount`.
   * e.g. "₹42,00,000" or "1,65,000 Pt."
   */
  displayValue?: string;
}
