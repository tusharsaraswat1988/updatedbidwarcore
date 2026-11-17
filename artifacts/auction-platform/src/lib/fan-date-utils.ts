/**
 * Shared date, time, and status formatting utilities for the BIDWAR Fan Arena.
 * Ensures consistent spectator presentation, respecting tournament timezone (default Asia/Kolkata),
 * and eliminating raw ISO date displays.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Formats an ISO date string into standard Fan display format (e.g., "29 Nov 2026").
 */
export function formatFanDate(
  dateInput?: string | Date | null,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput.includes("T") ? dateInput : `${dateInput}T00:00:00`) : dateInput;
  if (Number.isNaN(d.getTime())) return String(dateInput);

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  }
}

/**
 * Formats a time string (e.g. "18:30", "18:30:00", or ISO) into standard Fan display format (e.g., "6:30 PM IST").
 */
export function formatFanTime(
  timeInput?: string | null,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!timeInput?.trim()) return "";
  const clean = timeInput.trim();

  // If input is "HH:mm" or "HH:mm:ss"
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(clean)) {
    const [hStr, mStr] = clean.split(":");
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const tzSuffix = timeZone === "Asia/Kolkata" ? "IST" : timeZone.split("/").pop() || "";
    return `${displayHours}:${displayMinutes} ${ampm} ${tzSuffix}`.trim();
  }

  // If input is an ISO string
  const d = new Date(clean);
  if (!Number.isNaN(d.getTime())) {
    try {
      const formatted = new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        timeZone,
        timeZoneName: "short",
      }).format(d);
      return formatted;
    } catch {
      return clean;
    }
  }

  return clean;
}

/**
 * Combines date and time into a single clean spectator string (e.g., "29 Nov 2026, 6:30 PM IST").
 */
export function formatFanDateTime(
  dateInput?: string | Date | null,
  timeInput?: string | null,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const dateFormatted = formatFanDate(dateInput, timeZone);
  const timeFormatted = formatFanTime(timeInput, timeZone);

  if (dateFormatted && timeFormatted) {
    return `${dateFormatted}, ${timeFormatted}`;
  }
  return dateFormatted || timeFormatted || "";
}

/**
 * Formats a comma-separated list of match dates into a clean range (e.g., "29 Nov 2026 – 02 Dec 2026").
 */
export function formatFanDateRange(
  matchDates?: string | null,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!matchDates?.trim()) return null;
  const parts = matchDates
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const formatted = parts.map((iso) => formatFanDate(iso, timeZone));
  if (formatted.length === 1) return formatted[0];
  return `${formatted[0]} – ${formatted[formatted.length - 1]}`;
}

/**
 * Standardizes tournament and match status labels and visual tones.
 */
export function formatFanStatus(
  status?: string | null,
  isLive?: boolean,
): { label: string; tone: "live" | "upcoming" | "completed" | "default" } {
  if (isLive) {
    return { label: "LIVE", tone: "live" };
  }

  const s = (status ?? "").toLowerCase().trim();
  if (s === "live" || s === "in_progress" || s === "active") {
    return { label: "LIVE", tone: "live" };
  }
  if (s === "scheduled" || s === "upcoming" || s === "setup" || s === "ready") {
    return { label: "Upcoming", tone: "upcoming" };
  }
  if (s === "completed" || s === "finished" || s === "ended" || s === "concluded") {
    return { label: "Completed", tone: "completed" };
  }
  if (s === "archived") {
    return { label: "Archived", tone: "default" };
  }
  if (s === "cancelled") {
    return { label: "Cancelled", tone: "default" };
  }

  if (!s) return { label: "Upcoming", tone: "upcoming" };
  return {
    label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "default",
  };
}
