import { Router } from "express";
import { db } from "@workspace/db";
import { platformAuditEventsTable } from "@workspace/db";
import { and, desc, eq, gte, lte, sql, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { CRITICAL_TAG_LABELS } from "../lib/audit-critical-tags";
import { getSuspicionRulesCatalog } from "../lib/audit-suspicion";

const router = Router();

function isAnyAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser?.isAdmin;
}

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser?.isAdmin && req.jwtUser?.adminLevel === "master";
}

function eventToJson(e: typeof platformAuditEventsTable.$inferSelect) {
  return {
    id: e.id,
    occurredAt: e.occurredAt.toISOString(),
    eventCategory: e.eventCategory,
    eventAction: e.eventAction,
    eventSeverity: e.eventSeverity,
    outcome: e.outcome,
    actorType: e.actorType,
    actorId: e.actorId,
    actorLabel: e.actorLabel,
    actorIp: e.actorIp,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    tournamentId: e.tournamentId,
    teamId: e.teamId,
    playerId: e.playerId,
    summary: e.summary,
    reason: e.reason,
    metadata: e.metadataJson,
    before: e.beforeJson,
    after: e.afterJson,
    changes: e.changesJson,
    relatedTable: e.relatedTable,
    relatedId: e.relatedId,
    requestMethod: e.requestMethod,
    requestPath: e.requestPath,
    source: e.source,
    alertKey: e.alertKey,
    criticalTags: e.criticalTagsJson ?? [],
    monitoringFlags: e.monitoringFlagsJson,
    exportable: e.exportable,
  };
}

// GET /auth/admin/audit/events — paginated timeline (read-only, append-only store)
router.get("/auth/admin/audit/events", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }

  const query = z
    .object({
      tournamentId: z.coerce.number().int().optional(),
      teamId: z.coerce.number().int().optional(),
      playerId: z.coerce.number().int().optional(),
      category: z.string().optional(),
      action: z.string().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      actorType: z.string().optional(),
      alertKey: z.string().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .safeParse(req.query);

  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const q = query.data;
  const conditions = [];

  if (q.tournamentId !== undefined) conditions.push(eq(platformAuditEventsTable.tournamentId, q.tournamentId));
  if (q.teamId !== undefined) conditions.push(eq(platformAuditEventsTable.teamId, q.teamId));
  if (q.playerId !== undefined) conditions.push(eq(platformAuditEventsTable.playerId, q.playerId));
  if (q.category) conditions.push(eq(platformAuditEventsTable.eventCategory, q.category));
  if (q.action) conditions.push(eq(platformAuditEventsTable.eventAction, q.action));
  if (q.severity) conditions.push(eq(platformAuditEventsTable.eventSeverity, q.severity));
  if (q.actorType) conditions.push(eq(platformAuditEventsTable.actorType, q.actorType));
  if (q.alertKey) conditions.push(eq(platformAuditEventsTable.alertKey, q.alertKey));
  if (q.from) conditions.push(gte(platformAuditEventsTable.occurredAt, new Date(q.from)));
  if (q.to) conditions.push(lte(platformAuditEventsTable.occurredAt, new Date(q.to)));
  if (q.search) {
    const term = `%${q.search}%`;
    conditions.push(
      or(
        ilike(platformAuditEventsTable.summary, term),
        ilike(platformAuditEventsTable.reason, term),
        ilike(platformAuditEventsTable.actorLabel, term),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [events, countRow] = await Promise.all([
    db
      .select()
      .from(platformAuditEventsTable)
      .where(where)
      .orderBy(desc(platformAuditEventsTable.occurredAt))
      .limit(q.limit)
      .offset(q.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformAuditEventsTable)
      .where(where),
  ]);

  res.json({
    events: events.map(eventToJson),
    total: countRow[0]?.count ?? 0,
    limit: q.limit,
    offset: q.offset,
  });
});

// GET /auth/admin/audit/events/:id — single event detail
router.get("/auth/admin/audit/events/:id", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [event] = await db.select().from(platformAuditEventsTable).where(eq(platformAuditEventsTable.id, id));
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(eventToJson(event));
});

// GET /auth/admin/audit/alerts — recent critical / alert events (global feed seed)
router.get("/auth/admin/audit/alerts", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }
  const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 100);
  const events = await db
    .select()
    .from(platformAuditEventsTable)
    .where(
      or(
        eq(platformAuditEventsTable.eventSeverity, "critical"),
        eq(platformAuditEventsTable.eventSeverity, "warning"),
        sql`${platformAuditEventsTable.alertKey} IS NOT NULL`,
      ),
    )
    .orderBy(desc(platformAuditEventsTable.occurredAt))
    .limit(limit);
  res.json({ events: events.map(eventToJson) });
});

// GET /auth/admin/audit/export — CSV export (master admin only)
router.get("/auth/admin/audit/export", async (req, res) => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ error: "Master admin access required" });
    return;
  }

  const query = z
    .object({
      tournamentId: z.coerce.number().int().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(10000).default(5000),
    })
    .safeParse(req.query);

  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const q = query.data;
  const conditions = [eq(platformAuditEventsTable.exportable, true)];
  if (q.tournamentId !== undefined) conditions.push(eq(platformAuditEventsTable.tournamentId, q.tournamentId));
  if (q.from) conditions.push(gte(platformAuditEventsTable.occurredAt, new Date(q.from)));
  if (q.to) conditions.push(lte(platformAuditEventsTable.occurredAt, new Date(q.to)));

  const events = await db
    .select()
    .from(platformAuditEventsTable)
    .where(and(...conditions))
    .orderBy(desc(platformAuditEventsTable.occurredAt))
    .limit(q.limit);

  const header = [
    "id",
    "occurred_at",
    "category",
    "action",
    "severity",
    "outcome",
    "actor_type",
    "actor_label",
    "tournament_id",
    "team_id",
    "player_id",
    "summary",
    "reason",
    "alert_key",
    "source",
  ].join(",");

  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = events.map((e) =>
    [
      e.id,
      e.occurredAt.toISOString(),
      e.eventCategory,
      e.eventAction,
      e.eventSeverity,
      e.outcome,
      e.actorType,
      e.actorLabel,
      e.tournamentId,
      e.teamId,
      e.playerId,
      e.summary,
      e.reason,
      e.alertKey,
      e.source,
    ]
      .map(escape)
      .join(","),
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bidwar-audit-export-${Date.now()}.csv"`);
  res.send([header, ...rows].join("\n"));
});

// GET /auth/admin/audit/feed — operational dashboard feed (Super Admin monitoring)
router.get("/auth/admin/audit/feed", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentActivity, criticalHighlights, suspiciousActivity, statsRows, tagRows] = await Promise.all([
    db
      .select()
      .from(platformAuditEventsTable)
      .orderBy(desc(platformAuditEventsTable.occurredAt))
      .limit(20),
    db
      .select()
      .from(platformAuditEventsTable)
      .where(
        or(
          eq(platformAuditEventsTable.eventSeverity, "critical"),
          sql`${platformAuditEventsTable.alertKey} IS NOT NULL`,
        ),
      )
      .orderBy(desc(platformAuditEventsTable.occurredAt))
      .limit(12),
    db
      .select()
      .from(platformAuditEventsTable)
      .where(
        and(
          gte(platformAuditEventsTable.occurredAt, since24h),
          sql`${platformAuditEventsTable.monitoringFlagsJson} IS NOT NULL`,
          sql`(${platformAuditEventsTable.monitoringFlagsJson}->>'score')::int >= 3`,
        ),
      )
      .orderBy(desc(platformAuditEventsTable.occurredAt))
      .limit(15),
    db
      .select({
        critical24h: sql<number>`count(*) filter (where ${platformAuditEventsTable.eventSeverity} = 'critical' and ${platformAuditEventsTable.occurredAt} >= ${since24h})::int`,
        denied24h: sql<number>`count(*) filter (where ${platformAuditEventsTable.outcome} = 'denied' and ${platformAuditEventsTable.occurredAt} >= ${since24h})::int`,
        suspicious24h: sql<number>`count(*) filter (where ${platformAuditEventsTable.monitoringFlagsJson} is not null and (${platformAuditEventsTable.monitoringFlagsJson}->>'score')::int >= 3 and ${platformAuditEventsTable.occurredAt} >= ${since24h})::int`,
        withReason24h: sql<number>`count(*) filter (where ${platformAuditEventsTable.reason} is not null and ${platformAuditEventsTable.occurredAt} >= ${since24h})::int`,
      })
      .from(platformAuditEventsTable),
    db
      .select({
        tag: sql<string>`jsonb_array_elements_text(${platformAuditEventsTable.criticalTagsJson})`,
        count: sql<number>`count(*)::int`,
      })
      .from(platformAuditEventsTable)
      .where(gte(platformAuditEventsTable.occurredAt, since24h))
      .groupBy(sql`jsonb_array_elements_text(${platformAuditEventsTable.criticalTagsJson})`)
      .orderBy(sql`count(*) desc`)
      .limit(8),
  ]);

  const stats = statsRows[0] ?? { critical24h: 0, denied24h: 0, suspicious24h: 0, withReason24h: 0 };

  res.json({
    recentActivity: recentActivity.map(eventToJson),
    criticalHighlights: criticalHighlights.map(eventToJson),
    suspiciousActivity: suspiciousActivity.map(eventToJson),
    stats: {
      critical24h: stats.critical24h ?? 0,
      denied24h: stats.denied24h ?? 0,
      suspicious24h: stats.suspicious24h ?? 0,
      withReason24h: stats.withReason24h ?? 0,
    },
    tagBreakdown: tagRows.map((r) => ({
      tag: r.tag,
      label: CRITICAL_TAG_LABELS[r.tag as keyof typeof CRITICAL_TAG_LABELS] ?? r.tag,
      count: r.count,
    })),
    generatedAt: new Date().toISOString(),
  });
});

// GET /auth/admin/audit/monitoring — suspicion rule catalog (config hook for later)
router.get("/auth/admin/audit/monitoring", async (req, res) => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ error: "Master admin access required" });
    return;
  }
  res.json(getSuspicionRulesCatalog());
});

// GET /auth/admin/audit/meta — categories and actions for filter UI
router.get("/auth/admin/audit/meta", async (req, res) => {
  if (!isAnyAdmin(req)) {
    res.status(401).json({ error: "Not authorised" });
    return;
  }
  const categories = await db
    .selectDistinct({ category: platformAuditEventsTable.eventCategory })
    .from(platformAuditEventsTable)
    .orderBy(platformAuditEventsTable.eventCategory);
  const actions = await db
    .selectDistinct({ action: platformAuditEventsTable.eventAction })
    .from(platformAuditEventsTable)
    .orderBy(platformAuditEventsTable.eventAction);
  res.json({
    categories: categories.map((c) => c.category),
    actions: actions.map((a) => a.action),
  });
});

export default router;
