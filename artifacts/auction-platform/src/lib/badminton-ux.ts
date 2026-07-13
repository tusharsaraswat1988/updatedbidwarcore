/**
 * Sprint A UX helpers — friendly errors + toast wrappers + RC1 status vocabulary.
 * No API / schema / scoring changes.
 */

import { toast } from "@/hooks/use-toast";

/** Minimum touch target for organizer tablet UI (10"). */
export const TOUCH_TARGET_CLASS = "min-h-11 min-w-11";

/**
 * Canonical organizer status labels (RC1).
 * Never invent synonyms on screens — map raw API values here.
 */
export type BadmintonStatusLabel =
  | "Ready"
  | "Live"
  | "Paused"
  | "Delayed"
  | "Completed"
  | "Walkover"
  | "Retired"
  | "Cancelled"
  | "Scheduled"
  | "Unscheduled";

/** Match / scoring status → display label. */
export function formatMatchStatusLabel(status: string | null | undefined): BadmintonStatusLabel {
  switch ((status ?? "").toLowerCase()) {
    case "live":
    case "in_progress":
      return "Live";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "walkover":
      return "Walkover";
    case "retired":
    case "retirement":
      return "Retired";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "scheduled":
      return "Scheduled";
    case "ready":
      return "Ready";
    default:
      return "Scheduled";
  }
}

/** Fixture / planning status → display label. */
export function formatFixtureStatusLabel(status: string | null | undefined): BadmintonStatusLabel {
  switch ((status ?? "").toLowerCase()) {
    case "live":
    case "in_progress":
      return "Live";
    case "completed":
      return "Completed";
    case "walkover":
      return "Walkover";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "ready":
      return "Ready";
    case "scheduled":
      return "Scheduled";
    case "unscheduled":
      return "Unscheduled";
    case "delayed":
      return "Delayed";
    default:
      return formatMatchStatusLabel(status);
  }
}

/** Court ops board status → display label (internal enums stay FINISHED/EMPTY). */
export function formatCourtOpsStatusLabel(
  status: "EMPTY" | "READY" | "LIVE" | "FINISHED" | "DELAYED" | string,
): BadmintonStatusLabel | "Idle" {
  switch (status) {
    case "LIVE":
      return "Live";
    case "READY":
      return "Ready";
    case "DELAYED":
      return "Delayed";
    case "FINISHED":
      return "Completed";
    case "EMPTY":
      return "Idle";
    default:
      return "Ready";
  }
}

/** Category phase → display label. */
export function formatCategoryPhaseLabel(phase: string | null | undefined): string {
  switch ((phase ?? "").toLowerCase()) {
    case "live":
      return "Live";
    case "completed":
      return "Completed";
    case "draw_generated":
    case "setup":
      return "Ready";
    default:
      return phase?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Ready";
  }
}

/** Court entity status → display label. */
export function formatCourtEntityStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "in_use":
    case "live":
      return "Live";
    case "available":
    case "ready":
      return "Ready";
    case "maintenance":
      return "Paused";
    default:
      return status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Ready";
  }
}

/** Map raw API / Error messages to organizer-facing copy. */
export function friendlyBadmintonError(error: unknown, fallback = "Something went wrong"): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;

  const msg = raw.trim() || fallback;
  const lower = msg.toLowerCase();

  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("403")) {
    return "You don’t have permission for this action. Sign in again as the organizer.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "That item was not found. It may have been removed — refresh and try again.";
  }
  if (lower.includes("conflict") || lower.includes("409") || lower.includes("already started")) {
    return "This match has already started. Open Match Control or Live Scoring instead.";
  }
  if (lower.includes("court") && lower.includes("required")) {
    return "Assign a court in Scheduling before continuing.";
  }
  if (lower.includes("scheduled") && (lower.includes("required") || lower.includes("time"))) {
    return "Set a date and time in Scheduling before continuing.";
  }
  if (lower.includes("pin")) {
    return "Scorer PIN must be at least 4 digits.";
  }
  if (lower.includes("fixture") && lower.includes("match")) {
    return "Clear linked matches before changing this fixture collection.";
  }

  // Avoid dumping JSON / zod noise
  if (msg.startsWith("[") || msg.startsWith("{") || msg.includes("ZodError")) {
    return `${fallback}. Check the form fields and try again.`;
  }

  return msg.length > 160 ? `${fallback}. ${msg.slice(0, 120)}…` : msg;
}

export function toastSuccess(title: string, description?: string) {
  toast({ title, description });
}

export function toastError(error: unknown, title = "Action failed") {
  toast({
    title,
    description: friendlyBadmintonError(error),
    variant: "destructive",
  });
}
