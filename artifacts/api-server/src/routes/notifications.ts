import { Router } from "express";
import { db, notificationLogsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { resendNotification, NOTIFICATION_EVENT_TYPES } from "../lib/notifications";

const router = Router();

function isAnyAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser?.isAdmin;
}

function logToJson(row: typeof notificationLogsTable.$inferSelect) {
  return {
    id: row.id,
    eventType: row.eventType,
    channel: row.channel,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    recipientMobile: row.recipientMobile,
    tournamentId: row.tournamentId,
    organizerId: row.organizerId,
    status: row.status,
    subject: row.subject,
    providerResponse: row.providerResponse,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET /api/auth/admin/notifications — list notification logs with filters */
router.get("/auth/admin/notifications", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }

  const querySchema = z.object({
    eventType: z.enum(NOTIFICATION_EVENT_TYPES).optional(),
    channel: z.enum(["email", "sms", "whatsapp"]).optional(),
    status: z.enum(["pending", "sent", "failed", "skipped"]).optional(),
    tournamentId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { eventType, channel, status, tournamentId, limit, offset } = parsed.data;

  const conditions = [];
  if (eventType) conditions.push(eq(notificationLogsTable.eventType, eventType));
  if (channel) conditions.push(eq(notificationLogsTable.channel, channel));
  if (status) conditions.push(eq(notificationLogsTable.status, status));
  if (tournamentId) conditions.push(eq(notificationLogsTable.tournamentId, tournamentId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(notificationLogsTable)
      .where(whereClause)
      .orderBy(desc(notificationLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLogsTable)
      .where(whereClause),
  ]);

  res.json({
    items: rows.map(logToJson),
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  });
});

/** GET /api/auth/admin/notifications/meta — filter options for admin UI */
router.get("/auth/admin/notifications/meta", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }

  res.json({
    eventTypes: NOTIFICATION_EVENT_TYPES,
    channels: ["email", "sms", "whatsapp"],
    statuses: ["pending", "sent", "failed", "skipped"],
  });
});

/** POST /api/auth/admin/notifications/:id/resend — resend a failed or sent notification */
router.post("/auth/admin/notifications/:id/resend", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }

  const logId = parseInt(req.params.id, 10);
  if (isNaN(logId)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  const result = await resendNotification(logId);
  if (!result.success) {
    res.status(400).json({ error: result.error ?? "Resend failed" });
    return;
  }

  res.json({ success: true });
});

export default router;
