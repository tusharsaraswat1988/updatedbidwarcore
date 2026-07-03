import {
  db,
  adminNotificationsTable,
  brandingSettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { brandingService } from "../branding-service.js";
import { logger } from "../logger.js";
import { getPublicOrigin } from "../runtime-env.js";
import { sendEmail } from "../notifications/providers/email-provider.js";
import { broadcastAdminNotificationEvent } from "./admin-notification-broadcast.js";
import { resolveNotificationCategory } from "./categories.js";
import { renderAdminNotificationEmail } from "./email-templates.js";
import {
  getAdminNotificationSettings,
  isValidAdminEmail,
} from "./settings-service.js";
import {
  getAdminUnreadCount,
  rowToAdminNotificationDto,
} from "./notification-helpers.js";
import type {
  AdminNotificationCategory,
  AdminNotificationEventType,
  AdminNotificationPayloadMap,
  AdminNotificationPriority,
} from "./types.js";

type EventDefinition<E extends AdminNotificationEventType> = {
  priority: AdminNotificationPriority;
  category: AdminNotificationCategory;
  title: string;
  buildMessage: (payload: AdminNotificationPayloadMap[E]) => string;
  entityType: string | null;
  entityId: (payload: AdminNotificationPayloadMap[E]) => number | null;
  actionUrl: (payload: AdminNotificationPayloadMap[E], appUrl: string) => string | null;
  metadata: (payload: AdminNotificationPayloadMap[E]) => Record<string, unknown>;
};

const EVENT_DEFINITIONS: {
  [E in AdminNotificationEventType]: EventDefinition<E>;
} = {
  NEW_ORGANISER_REGISTERED: {
    priority: "info",
    category: "Registration",
    title: "New Organiser Registered",
    buildMessage: (p) => `${p.name} registered with ${p.mobile}.`,
    entityType: "organizer",
    entityId: (p) => p.organizerId,
    actionUrl: (p, appUrl) => `${appUrl}/admin/organisers/${p.organizerId}`,
    metadata: (p) => ({
      name: p.name,
      email: p.email,
      mobile: p.mobile,
      company: p.company ?? null,
      registeredAt: p.registeredAt,
    }),
  },
  NEW_TOURNAMENT_CREATED: {
    priority: "info",
    category: "Tournament",
    title: "New Tournament Created",
    buildMessage: (p) => `${p.organizerName ?? "An organiser"} created "${p.tournamentName}".`,
    entityType: "tournament",
    entityId: (p) => p.tournamentId,
    actionUrl: (p, appUrl) => `${appUrl}/admin/tournaments/${p.tournamentId}`,
    metadata: (p) => ({
      tournamentName: p.tournamentName,
      sport: p.sport,
      organizerName: p.organizerName,
      organizerId: p.organizerId,
      city: p.city,
      createdAt: p.createdAt,
    }),
  },
  CONTACT_FORM_SUBMISSION: {
    priority: "info",
    category: "Contact",
    title: "New Contact Form Submission",
    buildMessage: (p) => `${p.name} submitted: ${p.subject}`,
    entityType: "contact_inquiry",
    entityId: (p) => p.inquiryId,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/notifications`,
    metadata: (p) => ({
      referenceId: p.referenceId,
      name: p.name,
      email: p.email,
      mobile: p.mobile,
      subject: p.subject,
      message: p.message,
      inquiryType: p.inquiryType,
      submittedAt: p.submittedAt,
    }),
  },
  EMAIL_SEND_FAILED: {
    priority: "warning",
    category: "System",
    title: "Email Sending Failed",
    buildMessage: (p) => p.error,
    entityType: null,
    entityId: () => null,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/settings/admin-notifications`,
    metadata: (p) => ({ ...p }),
  },
  MISSING_CONFIGURATION: {
    priority: "warning",
    category: "System",
    title: "Missing Required Configuration",
    buildMessage: (p) => p.context,
    entityType: null,
    entityId: () => null,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/settings/admin-notifications`,
    metadata: (p) => ({ ...p }),
  },
  DATABASE_FAILURE: {
    priority: "critical",
    category: "System",
    title: "Database Failure",
    buildMessage: (p) => p.error,
    entityType: null,
    entityId: () => null,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/settings/system/audit-logs`,
    metadata: (p) => ({ ...p }),
  },
  NOTIFICATION_SERVICE_FAILURE: {
    priority: "critical",
    category: "System",
    title: "Notification Service Failure",
    buildMessage: (p) => p.error,
    entityType: null,
    entityId: () => null,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/settings/system/audit-logs`,
    metadata: (p) => ({ ...p }),
  },
  BACKGROUND_JOB_FAILURE: {
    priority: "critical",
    category: "System",
    title: "Background Job Failure",
    buildMessage: (p) => p.error,
    entityType: null,
    entityId: () => null,
    actionUrl: (_p, appUrl) => `${appUrl}/admin/settings/system/audit-logs`,
    metadata: (p) => ({ ...p }),
  },
};

function getAppUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

async function resolveBranding(): Promise<{ logoUrl: string | null; brandName: string }> {
  const [branding] = await db
    .select({ brandName: brandingSettingsTable.brandName })
    .from(brandingSettingsTable)
    .limit(1);
  const logoUrl = await brandingService.resolveEmailLogoAssetUrl();
  return {
    logoUrl,
    brandName: branding?.brandName ?? "BidWar",
  };
}

async function publishNotificationCreated(
  row: typeof adminNotificationsTable.$inferSelect,
): Promise<void> {
  const dto = rowToAdminNotificationDto(row);
  const unreadCount = await getAdminUnreadCount();

  broadcastAdminNotificationEvent({
    type: "ADMIN_NOTIFICATION_CREATED",
    notification: {
      id: dto.id,
      title: dto.title,
      message: dto.message,
      priority: dto.priority,
      type: dto.type,
      category: dto.category,
      actionUrl: dto.actionUrl,
      createdAt: dto.createdAt,
      isRead: dto.isRead,
    },
    unreadCount,
  });
}

async function insertInAppNotification<E extends AdminNotificationEventType>(
  eventType: E,
  payload: AdminNotificationPayloadMap[E],
  options: { publishLive?: boolean } = {},
): Promise<number | null> {
  const definition = EVENT_DEFINITIONS[eventType];
  const appUrl = getAppUrl();
  const category = definition.category ?? resolveNotificationCategory(eventType);

  const [row] = await db
    .insert(adminNotificationsTable)
    .values({
      type: eventType,
      title: definition.title,
      message: definition.buildMessage(payload),
      priority: definition.priority,
      category,
      entityType: definition.entityType,
      entityId: definition.entityId(payload),
      actionUrl: definition.actionUrl(payload, appUrl),
      metadata: definition.metadata(payload),
    })
    .returning();

  if (!row) return null;

  if (options.publishLive !== false) {
    await publishNotificationCreated(row).catch((err) => {
      logger.warn({ err, notificationId: row.id }, "Failed to publish admin notification SSE event");
    });
  }

  return row.id;
}

async function sendAdminEmail<E extends AdminNotificationEventType>(
  eventType: E,
  payload: AdminNotificationPayloadMap[E],
  settings: Awaited<ReturnType<typeof getAdminNotificationSettings>>,
): Promise<void> {
  if (!settings.emailNotificationsEnabled) return;

  if (!isValidAdminEmail(settings.adminEmail)) {
    logger.warn({ eventType }, "Admin notification email skipped — admin email not configured");
    await insertInAppNotification("MISSING_CONFIGURATION", {
      missingKeys: ["adminEmail"],
      context: "Admin notification email is enabled but no valid admin email is configured.",
    });
    return;
  }

  const branding = await resolveBranding();
  const { subject, html } = renderAdminNotificationEmail({
    eventType,
    payload,
    appUrl: getAppUrl(),
    logoUrl: branding.logoUrl,
    brandName: branding.brandName,
  });

  const result = await sendEmail({
    to: settings.adminEmail.trim(),
    subject,
    html,
  });

  if (!result.success) {
    logger.warn({ eventType, error: result.error }, "Admin notification email failed");
    await insertInAppNotification("EMAIL_SEND_FAILED", {
      context: `Admin notification for ${eventType}`,
      recipient: settings.adminEmail,
      error: result.error ?? "Unknown email error",
      originalEventType: eventType,
    });
  }
}

/**
 * Central entry point for all admin notifications.
 * Creates in-app notification and sends email when enabled in settings.
 */
export async function sendAdminNotification<E extends AdminNotificationEventType>(
  eventType: E,
  payload: AdminNotificationPayloadMap[E],
): Promise<{ notificationId: number | null }> {
  try {
    const settings = await getAdminNotificationSettings();
    let notificationId: number | null = null;

    if (settings.inAppNotificationsEnabled) {
      notificationId = await insertInAppNotification(eventType, payload);
    }

    await sendAdminEmail(eventType, payload, settings);

    logger.info({ eventType, notificationId }, "Admin notification dispatched");
    return { notificationId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown admin notification error";
    logger.error({ eventType, err }, "Admin notification service failure");

    try {
      await insertInAppNotification("NOTIFICATION_SERVICE_FAILURE", {
        context: `sendAdminNotification(${eventType})`,
        error: errorMessage,
      });
    } catch {
      // Last resort — already logged
    }

    return { notificationId: null };
  }
}

/** Fire-and-forget wrapper — never throws to callers. */
export function sendAdminNotificationAsync<E extends AdminNotificationEventType>(
  eventType: E,
  payload: AdminNotificationPayloadMap[E],
): void {
  void sendAdminNotification(eventType, payload).catch((err) => {
    logger.error({ eventType, err }, "Async admin notification failed");
  });
}

export const AdminNotificationService = {
  sendAdminNotification,
  sendAdminNotificationAsync,
};
