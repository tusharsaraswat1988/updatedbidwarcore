export const MIN_AUCTION_TIMER_SECONDS = 5;
export const MAX_AUCTION_TIMER_SECONDS = 300;

export type AuctionTimerLabel = "Opening Timer" | "Bid Timer";

export function parseAuctionTimerSeconds(
  raw: string | number | null | undefined,
): number | null {
  if (raw === "" || raw == null) return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateAuctionTimerSeconds(
  seconds: number | null,
  label: AuctionTimerLabel,
): string | null {
  if (seconds == null) {
    return `${label} is required`;
  }
  if (seconds < MIN_AUCTION_TIMER_SECONDS) {
    return `${label} must be at least ${MIN_AUCTION_TIMER_SECONDS} seconds (0 is not supported)`;
  }
  if (seconds > MAX_AUCTION_TIMER_SECONDS) {
    return `${label} cannot exceed ${MAX_AUCTION_TIMER_SECONDS} seconds`;
  }
  return null;
}

export function parseOperatorTimerSeconds(
  raw: string,
  fallback: number,
): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < MIN_AUCTION_TIMER_SECONDS) return fallback;
  return Math.min(n, MAX_AUCTION_TIMER_SECONDS);
}
