const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const AUCTION_DATE_PAST_ERROR =
  "Auction date must be today or a future date.";

/** Current calendar date in IST as YYYY-MM-DD (matches stored auctionDate values). */
export function getIstTodayDateString(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10);
}

export type AuctionDateValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Optional auction date: empty is allowed; otherwise must be today or later (IST). */
export function validateAuctionDate(
  dateStr: string | undefined | null,
): AuctionDateValidationResult {
  const trimmed = dateStr?.trim();
  if (!trimmed) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid auction date." };
  }
  if (trimmed < getIstTodayDateString()) {
    return { ok: false, error: AUCTION_DATE_PAST_ERROR };
  }
  return { ok: true };
}

/** Parse YYYY-MM-DD into a local Date at midnight (for calendar widgets). */
export function parseAuctionDateString(dateStr: string): Date | undefined {
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}
