import { count, eq } from "drizzle-orm";
import { db, adminNotificationsTable } from "@workspace/db";
import { resolveNotificationCategory } from "./categories.js";
import type {
  AdminNotificationDto,
  AdminNotificationEventType,
  AdminNotificationPriority,
} from "./types.js";

export async function getAdminUnreadCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(adminNotificationsTable)
    .where(eq(adminNotificationsTable.isRead, false));
  return row?.count ?? 0;
}

export function rowToAdminNotificationDto(
  row: typeof adminNotificationsTable.$inferSelect,
): AdminNotificationDto {
  const eventType = row.type as AdminNotificationEventType;
  return {
    id: row.id,
    type: eventType,
    title: row.title,
    message: row.message,
    priority: row.priority as AdminNotificationPriority,
    category: (row.category as AdminNotificationDto["category"]) ?? resolveNotificationCategory(eventType),
    entityType: row.entityType,
    entityId: row.entityId,
    actionUrl: row.actionUrl,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}
