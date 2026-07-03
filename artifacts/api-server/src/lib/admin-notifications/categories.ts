import type { AdminNotificationEventType } from "./types.js";

export const ADMIN_NOTIFICATION_CATEGORIES = [
  "Registration",
  "Tournament",
  "Contact",
  "Auction",
  "Payment",
  "Support",
  "Printer",
  "System",
] as const;

export type AdminNotificationCategory = (typeof ADMIN_NOTIFICATION_CATEGORIES)[number];

const EVENT_CATEGORY_MAP: Record<AdminNotificationEventType, AdminNotificationCategory> = {
  NEW_ORGANISER_REGISTERED: "Registration",
  NEW_TOURNAMENT_CREATED: "Tournament",
  CONTACT_FORM_SUBMISSION: "Contact",
  EMAIL_SEND_FAILED: "System",
  MISSING_CONFIGURATION: "System",
  DATABASE_FAILURE: "System",
  NOTIFICATION_SERVICE_FAILURE: "System",
  BACKGROUND_JOB_FAILURE: "System",
};

export function resolveNotificationCategory(
  eventType: AdminNotificationEventType,
): AdminNotificationCategory {
  return EVENT_CATEGORY_MAP[eventType] ?? "System";
}
