/** Format a date-only ISO value (YYYY-MM-DD) as DD-MM-YYYY without timezone shifting. */
export function formatIsoDateDdMmYyyy(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Format 24h HH:mm (or H:mm) as 12h "h:mm AM/PM". */
export function formatAuctionTime12h(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return trimmed;
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (
    !Number.isInteger(hour24) ||
    hour24 < 0 ||
    hour24 > 23 ||
    Number(minute) < 0 ||
    Number(minute) > 59
  ) {
    return trimmed;
  }
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

/** Auction date + optional time for player-facing display. */
export function formatAuctionDateTimeDisplay(
  auctionDate: string | null | undefined,
  auctionTime: string | null | undefined,
): string {
  const datePart = formatIsoDateDdMmYyyy(auctionDate);
  const timePart = formatAuctionTime12h(auctionTime);
  if (datePart && timePart) return `${datePart} at ${timePart}`;
  return datePart || timePart;
}

/**
 * Parse comma-separated matchDates (ISO date-only) into DD-MM-YYYY list.
 * Does not use Date parsing to avoid timezone day shifts.
 */
export function formatMatchDatesDdMmYyyy(
  matchDates: string | null | undefined,
): string {
  if (!matchDates?.trim()) return "";
  return matchDates
    .split(",")
    .map((part) => formatIsoDateDdMmYyyy(part))
    .filter(Boolean)
    .join(", ");
}

export function formatRegistrationDateDdMmYyyy(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") {
    const isoDay = formatIsoDateDdMmYyyy(value);
    if (/^\d{2}-\d{2}-\d{4}$/.test(isoDay)) return isoDay;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.trim();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${d}-${m}-${y}`;
  }
  if (Number.isNaN(value.getTime())) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${d}-${m}-${y}`;
}
