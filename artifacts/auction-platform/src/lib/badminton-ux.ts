/**
 * Sprint A UX helpers — friendly errors + toast wrappers.
 * No API / schema / scoring changes.
 */

import { toast } from "@/hooks/use-toast";

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
