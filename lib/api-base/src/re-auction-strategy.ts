/**
 * Re-auction opening bid strategy — session-scoped, never mutates player.basePrice.
 *
 * During a bulk "Bring Unsold Players" round, the operator chooses how opening
 * bids are initialized when each player is nominated. The strategy lives on
 * auction_sessions.reAuctionStrategyJson until reset/conclude/next bulk round.
 */

export type ReAuctionStrategyMode = "keep_existing" | "reset_defaults" | "fixed";

export interface ReAuctionStrategy {
  mode: ReAuctionStrategyMode;
  /** Required when mode is "fixed". */
  fixedAmount?: number;
}

export interface OpeningBidInput {
  /** Active re-auction strategy; null means normal auction (keep_existing semantics). */
  strategy: ReAuctionStrategy | null;
  playerBasePrice: number;
  categoryMinBid: number | null;
  tournamentMinBid: number;
}

/** Parse session JSON; returns null when unset or invalid. */
export function parseReAuctionStrategy(raw: string | null | undefined): ReAuctionStrategy | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const mode = (parsed as { mode?: unknown }).mode;
    if (mode !== "keep_existing" && mode !== "reset_defaults" && mode !== "fixed") return null;
    const fixedAmount = (parsed as { fixedAmount?: unknown }).fixedAmount;
    if (mode === "fixed") {
      if (typeof fixedAmount !== "number" || !Number.isFinite(fixedAmount)) return null;
      return { mode, fixedAmount: Math.trunc(fixedAmount) };
    }
    return { mode };
  } catch {
    return null;
  }
}

export function serializeReAuctionStrategy(strategy: ReAuctionStrategy): string {
  if (strategy.mode === "fixed") {
    return JSON.stringify({ mode: "fixed", fixedAmount: strategy.fixedAmount });
  }
  return JSON.stringify({ mode: strategy.mode });
}

/**
 * Effective opening bid for a nominated player.
 * Mirrors normal auction for keep_existing; reset_defaults ignores player-selected base.
 */
export function resolveOpeningBid(input: OpeningBidInput): number {
  const categoryBase =
    input.categoryMinBid != null && input.categoryMinBid > 0 ? input.categoryMinBid : null;
  const mode = input.strategy?.mode ?? "keep_existing";

  if (mode === "fixed" && input.strategy?.fixedAmount != null) {
    return input.strategy.fixedAmount;
  }

  if (mode === "reset_defaults") {
    return categoryBase ?? input.tournamentMinBid;
  }

  // keep_existing — same as normal next-player: category overrides player base
  return categoryBase ?? input.playerBasePrice;
}

export function validateFixedReAuctionAmount(
  amount: number,
  tournamentMinBid: number,
): { ok: true; amount: number } | { ok: false; error: string } {
  const normalized = Math.trunc(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return { ok: false, error: "Fixed starting bid must be greater than ₹0." };
  }
  const floor = tournamentMinBid > 0 ? tournamentMinBid : 1;
  if (normalized < floor) {
    return {
      ok: false,
      error: `Fixed starting bid must be at least ₹${floor.toLocaleString("en-IN")} (tournament minimum).`,
    };
  }
  return { ok: true, amount: normalized };
}

export function parseReAuctionStrategyFromRequest(body: {
  strategy?: unknown;
  fixedAmount?: unknown;
}): { ok: true; strategy: ReAuctionStrategy } | { ok: false; error: string } {
  const mode = body.strategy;
  if (mode === undefined || mode === "keep_existing") {
    return { ok: true, strategy: { mode: "keep_existing" } };
  }
  if (mode === "reset_defaults") {
    return { ok: true, strategy: { mode: "reset_defaults" } };
  }
  if (mode === "fixed") {
    if (typeof body.fixedAmount !== "number" || !Number.isFinite(body.fixedAmount)) {
      return { ok: false, error: "Fixed starting bid amount is required." };
    }
    return { ok: true, strategy: { mode: "fixed", fixedAmount: Math.trunc(body.fixedAmount) } };
  }
  return { ok: false, error: "Invalid re-auction strategy." };
}
