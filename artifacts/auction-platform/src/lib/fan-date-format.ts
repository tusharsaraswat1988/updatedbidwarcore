/**
 * Shared timezone-safe date and time formatting utilities for BidWar spectator surfaces.
 * Standard format:
 *   Date: "29 Nov 2026"
 *   Time: "6:30 PM IST"
 *
 * Platform default timezone: "Asia/Kolkata" (IST)
 */

export const DEFAULT_PLATFORM_TIMEZONE = "Asia/Kolkata";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatTournamentDate(
  rawDate?: string | Date | null,
  timeZone: string = DEFAULT_PLATFORM_TIMEZONE
): string | null {
  if (!rawDate) return null;

  try {
    let d: Date;
    if (rawDate instanceof Date) {
      d = rawDate;
    } else {
      const str = String(rawDate).trim();
      if (!str) return null;
      // Handle simple YYYY-MM-DD strings directly without time shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [year, month, day] = str.split("-").map(Number);
        if (month >= 1 && month <= 12) {
          return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
        }
      }
      d = new Date(str);
    }

    if (isNaN(d.getTime())) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    });
    return formatter.format(d);
  } catch {
    return null;
  }
}

export function formatTournamentTime(
  rawTime?: string | null,
  timeZone: string = DEFAULT_PLATFORM_TIMEZONE
): string | null {
  if (!rawTime) return null;
  const str = String(rawTime).trim();
  if (!str) return null;

  try {
    // If it's HH:mm or HH:mm:ss format
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm} IST`;
    }

    // Try full Date parse
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone,
      });
      return `${formatter.format(d)} IST`;
    }

    return str;
  } catch {
    return str;
  }
}

export function formatTournamentDateTime(
  rawDate?: string | Date | null,
  rawTime?: string | null,
  timeZone: string = DEFAULT_PLATFORM_TIMEZONE
): string | null {
  const dateStr = formatTournamentDate(rawDate, timeZone);
  const timeStr = formatTournamentTime(rawTime, timeZone);

  if (dateStr && timeStr) return `${dateStr} • ${timeStr}`;
  if (dateStr) return dateStr;
  if (timeStr) return timeStr;
  return null;
}
