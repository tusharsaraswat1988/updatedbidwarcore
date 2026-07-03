import { Router } from "express";
import { z } from "zod";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import { db, adminNotificationsTable } from "@workspace/db";
import { requireAdmin, requireMasterAdmin } from "../middleware/require-admin.js";
import { logger } from "../lib/logger.js";
import {
  addAdminNotificationSseClient,
  removeAdminNotificationSseClient,
} from "../lib/admin-notifications/admin-notification-broadcast.js";
import {
  getAdminUnreadCount,
  rowToAdminNotificationDto,
} from "../lib/admin-notifications/notification-helpers.js";
import {
  getAdminNotificationSettings,
  upsertAdminNotificationSettings,
  isValidAdminEmail,
} from "../lib/admin-notifications/settings-service.js";
import type { AdminNotificationDto } from "../lib/admin-notifications/types.js";

const router = Router();

function toDto(row: typeof adminNotificationsTable.$inferSelect): AdminNotificationDto {
  return rowToAdminNotificationDto(row);
}

const updateSettingsSchema = z.object({
  adminName: z.string().trim().min(1).max(120).optional(),
  adminEmail: z.string().trim().email().max(160).optional(),
  adminMobile: z.string().trim().max(32).nullable().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  inAppNotificationsEnabled: z.boolean().optional(),
  liveNotificationsEnabled: z.boolean().optional(),
  notificationSoundEnabled: z.boolean().optional(),
});

router.get("/auth/admin/settings/admin-notifications", requireAdmin, async (_req, res) => {
  res.json(await getAdminNotificationSettings());
});

router.patch("/auth/admin/settings/admin-notifications", requireMasterAdmin, async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;
  if (
    data.emailNotificationsEnabled === true &&
    data.adminEmail !== undefined &&
    !isValidAdminEmail(data.adminEmail)
  ) {
    res.status(400).json({ error: "A valid admin email is required when email notifications are enabled" });
    return;
  }

  const current = await getAdminNotificationSettings();
  const nextEmail = data.adminEmail ?? current.adminEmail;
  const nextEmailEnabled = data.emailNotificationsEnabled ?? current.emailNotificationsEnabled;

  if (nextEmailEnabled && !isValidAdminEmail(nextEmail)) {
    res.status(400).json({ error: "Configure a valid admin email before enabling email notifications" });
    return;
  }

  const updated = await upsertAdminNotificationSettings({
    ...(data.adminName !== undefined ? { adminName: data.adminName } : {}),
    ...(data.adminEmail !== undefined ? { adminEmail: data.adminEmail } : {}),
    ...(data.adminMobile !== undefined ? { adminMobile: data.adminMobile } : {}),
    ...(data.emailNotificationsEnabled !== undefined
      ? { emailNotificationsEnabled: data.emailNotificationsEnabled }
      : {}),
    ...(data.inAppNotificationsEnabled !== undefined
      ? { inAppNotificationsEnabled: data.inAppNotificationsEnabled }
      : {}),
    ...(data.liveNotificationsEnabled !== undefined
      ? { liveNotificationsEnabled: data.liveNotificationsEnabled }
      : {}),
    ...(data.notificationSoundEnabled !== undefined
      ? { notificationSoundEnabled: data.notificationSoundEnabled }
      : {}),
  });

  res.json(updated);
});

router.get("/auth/admin/admin-notifications/unread-count", requireAdmin, async (_req, res) => {
  res.json({ count: await getAdminUnreadCount() });
});

/** Live SSE stream — admin sessions only. */
router.get("/auth/admin/admin-notifications/events", requireAdmin, async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client = addAdminNotificationSseClient(res);
  logger.info({ adminLevel: req.jwtUser.adminLevel }, "Admin notification SSE client connected");

  try {
    const unreadCount = await getAdminUnreadCount();
    res.write(`data: ${JSON.stringify({ type: "ADMIN_NOTIFICATION_SYNC", unreadCount })}\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ type: "ADMIN_NOTIFICATION_SYNC", unreadCount: 0 })}\n\n`);
  }

  const cleanup = () => {
    clearInterval(heartbeat);
    removeAdminNotificationSseClient(client);
    req.off("close", cleanup);
    res.off("close", cleanup);
    logger.info("Admin notification SSE client disconnected");
  };

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      cleanup();
    }
  }, 20000);

  req.on("close", cleanup);
  res.on("close", cleanup);
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  priority: z.enum(["info", "warning", "critical", "all"]).default("all"),
  read: z.enum(["all", "read", "unread"]).default("all"),
  search: z.string().trim().max(120).optional(),
});

router.get("/auth/admin/admin-notifications", requireAdmin, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { page, limit, priority, read, search } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (priority !== "all") {
    conditions.push(eq(adminNotificationsTable.priority, priority));
  }
  if (read === "read") {
    conditions.push(eq(adminNotificationsTable.isRead, true));
  } else if (read === "unread") {
    conditions.push(eq(adminNotificationsTable.isRead, false));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(adminNotificationsTable.title, pattern),
        ilike(adminNotificationsTable.message, pattern),
        ilike(adminNotificationsTable.type, pattern),
      ),
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(adminNotificationsTable)
    .where(whereClause);

  const rows = await db
    .select()
    .from(adminNotificationsTable)
    .where(whereClause)
    .orderBy(desc(adminNotificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    items: rows.map(toDto),
    total: totalRow?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((totalRow?.count ?? 0) / limit),
  });
});

/** Latest notifications for header dropdown. */
router.get("/auth/admin/admin-notifications/recent", requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const rows = await db
    .select()
    .from(adminNotificationsTable)
    .orderBy(desc(adminNotificationsTable.createdAt))
    .limit(limit);

  const [unreadRow] = await db
    .select({ count: count() })
    .from(adminNotificationsTable)
    .where(eq(adminNotificationsTable.isRead, false));

  res.json({
    items: rows.map(toDto),
    unreadCount: unreadRow?.count ?? 0,
  });
});

router.patch("/auth/admin/admin-notifications/:id/read", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  const [updated] = await db
    .update(adminNotificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(adminNotificationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(toDto(updated));
});

router.patch("/auth/admin/admin-notifications/mark-all-read", requireAdmin, async (_req, res) => {
  const result = await db
    .update(adminNotificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(adminNotificationsTable.isRead, false))
    .returning({ id: adminNotificationsTable.id });

  res.json({ updated: result.length });
});

const bulkReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
});

router.post("/auth/admin/admin-notifications/bulk-read", requireAdmin, async (req, res) => {
  const parsed = bulkReadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }

  const result = await db
    .update(adminNotificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(inArray(adminNotificationsTable.id, parsed.data.ids))
    .returning({ id: adminNotificationsTable.id });

  res.json({ updated: result.length });
});

router.delete("/auth/admin/admin-notifications/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  const [deleted] = await db
    .delete(adminNotificationsTable)
    .where(eq(adminNotificationsTable.id, id))
    .returning({ id: adminNotificationsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
