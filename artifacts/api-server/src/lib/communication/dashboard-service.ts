import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import {
  db,
  communicationJobsTable,
  communicationLogsTable,
  communicationSettingsTable,
  communicationTemplatesTable,
  playersTable,
  teamsTable,
  organizersTable,
  tournamentsTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { DashboardStats, BulkRecipientFilter } from "./types.js";
import { createCommunicationJob, queueJob } from "./job-service.js";
import { buildMergeDataForRecipient } from "./merge-data-builder.js";

export async function getDashboardStats(tournamentId?: number): Promise<DashboardStats> {
  const countsResult = await pool.query<{
    total: string;
    sent_today: string;
    pending: string;
    failed: string;
    delivered: string;
    opened: string;
    clicked: string;
    bounced: string;
    ready_to_send: string;
  }>(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE sent_at >= date_trunc('day', NOW()))::int AS sent_today,
      count(*) FILTER (WHERE status IN ('pending', 'draft'))::int AS pending,
      count(*) FILTER (WHERE status = 'failed')::int AS failed,
      count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE status = 'opened')::int AS opened,
      count(*) FILTER (WHERE status = 'clicked')::int AS clicked,
      count(*) FILTER (WHERE status IN ('soft_bounce', 'hard_bounce'))::int AS bounced,
      count(*) FILTER (WHERE status = 'ready_to_send')::int AS ready_to_send
    FROM communication_jobs
    WHERE channel = 'email' ${tournamentId ? `AND tournament_id = ${tournamentId}` : ""}
  `);

  const c = countsResult.rows[0];

  const topTemplates = await db
    .select({
      templateKey: communicationJobsTable.templateInternalKey,
      count: sql<number>`count(*)::int`,
    })
    .from(communicationJobsTable)
    .where(
      tournamentId
        ? and(
            eq(communicationJobsTable.channel, "email"),
            eq(communicationJobsTable.tournamentId, tournamentId),
            sql`${communicationJobsTable.templateInternalKey} IS NOT NULL`,
          )
        : and(
            eq(communicationJobsTable.channel, "email"),
            sql`${communicationJobsTable.templateInternalKey} IS NOT NULL`,
          ),
    )
    .groupBy(communicationJobsTable.templateInternalKey)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const templateNames = await db.select().from(communicationTemplatesTable);
  const nameByKey = new Map(templateNames.map((t) => [t.internalKey, t.name]));

  const recentLogs = await db
    .select()
    .from(communicationLogsTable)
    .orderBy(desc(communicationLogsTable.createdAt))
    .limit(10);

  const graphResult = await pool.query<{ date: string; sent: string; failed: string; pending: string }>(`
    SELECT
      to_char(d, 'YYYY-MM-DD') AS date,
      coalesce(s.sent, 0)::int AS sent,
      coalesce(s.failed, 0)::int AS failed,
      coalesce(s.pending, 0)::int AS pending
    FROM generate_series(date_trunc('day', NOW()) - interval '13 days', date_trunc('day', NOW()), interval '1 day') AS d
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')) AS sent,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        count(*) FILTER (WHERE status IN ('pending', 'ready_to_send', 'queued')) AS pending
      FROM communication_jobs
      WHERE channel = 'email'
        AND created_at >= d
        AND created_at < d + interval '1 day'
        ${tournamentId ? `AND tournament_id = ${tournamentId}` : ""}
    ) s ON true
    ORDER BY d
  `);

  const graphRows = graphResult.rows;

  return {
    totalEmails: Number(c?.total ?? 0),
    sentToday: Number(c?.sent_today ?? 0),
    pending: Number(c?.pending ?? 0),
    failed: Number(c?.failed ?? 0),
    delivered: Number(c?.delivered ?? 0),
    opened: Number(c?.opened ?? 0),
    clicked: Number(c?.clicked ?? 0),
    bounced: Number(c?.bounced ?? 0),
    readyToSend: Number(c?.ready_to_send ?? 0),
    topTemplates: topTemplates.map((t) => ({
      templateKey: t.templateKey ?? "unknown",
      templateName: nameByKey.get(t.templateKey ?? "") ?? t.templateKey ?? "Unknown",
      count: t.count,
    })),
    recentActivity: recentLogs.map((l) => ({
      id: String(l.id),
      action: l.action,
      recipientEmail: l.recipientEmail,
      recipientName: l.recipientName,
      status: l.newStatus,
      createdAt: l.createdAt.toISOString(),
    })),
    graphData: graphRows.map((g) => ({
      date: g.date,
      sent: Number(g.sent),
      failed: Number(g.failed),
      pending: Number(g.pending),
    })),
  };
}

export async function resolveBulkRecipients(
  filter: BulkRecipientFilter,
): Promise<Array<{ name: string | null; email: string; role: string; entityType?: string; entityId?: number; tournamentId?: number }>> {
  const results: Array<{ name: string | null; email: string; role: string; entityType?: string; entityId?: number; tournamentId?: number }> = [];

  const isValidEmail = (email: string | null | undefined) =>
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (filter.type === "custom_emails" && filter.emails?.length) {
    for (const email of filter.emails) {
      if (isValidEmail(email)) results.push({ name: null, email: email.trim(), role: "custom" });
    }
    return results;
  }

  if (filter.type === "csv" && filter.csvEmails?.length) {
    for (const email of filter.csvEmails) {
      if (isValidEmail(email)) results.push({ name: null, email: email.trim(), role: "custom" });
    }
    return results;
  }

  if (filter.type === "player" && filter.playerId) {
    const [player] = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        email: playersTable.email,
        tournamentId: playersTable.tournamentId,
      })
      .from(playersTable)
      .where(eq(playersTable.id, filter.playerId))
      .limit(1);

    if (player && isValidEmail(player.email)) {
      results.push({
        name: player.name,
        email: player.email!.trim(),
        role: "player",
        entityType: "player",
        entityId: player.id,
        tournamentId: player.tournamentId,
      });
    }
    return results;
  }

  if (filter.type === "team" && filter.teamId) {
    const [team] = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
        tournamentId: teamsTable.tournamentId,
      })
      .from(teamsTable)
      .where(eq(teamsTable.id, filter.teamId))
      .limit(1);

    if (team && isValidEmail(team.ownerEmail)) {
      results.push({
        name: team.ownerName,
        email: team.ownerEmail!.trim(),
        role: "team_owner",
        entityType: "team",
        entityId: team.id,
        tournamentId: team.tournamentId,
      });
    }
    return results;
  }

  if (!filter.tournamentId && filter.type !== "organisers") return results;

  if (filter.type === "players" || filter.type === "selected_players" || filter.type === "unsold_players" || filter.type === "men" || filter.type === "women") {
    const conditions = [eq(playersTable.tournamentId, filter.tournamentId!)];
    if (filter.type === "selected_players") conditions.push(eq(playersTable.status, "sold"));
    if (filter.type === "unsold_players") conditions.push(eq(playersTable.status, "unsold"));
    if (filter.type === "men") conditions.push(eq(playersTable.gender, "male"));
    if (filter.type === "women") conditions.push(eq(playersTable.gender, "female"));

    const players = await db
      .select({ id: playersTable.id, name: playersTable.name, email: playersTable.email })
      .from(playersTable)
      .where(and(...conditions));

    for (const p of players) {
      if (isValidEmail(p.email)) {
        results.push({
          name: p.name,
          email: p.email!.trim(),
          role: "player",
          entityType: "player",
          entityId: p.id,
          tournamentId: filter.tournamentId,
        });
      }
    }
  }

  if (filter.type === "team_owners" || filter.type === "team") {
    const conditions = filter.type === "team" && filter.teamId
      ? [eq(teamsTable.id, filter.teamId)]
      : [eq(teamsTable.tournamentId, filter.tournamentId!)];

    const teams = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerName: teamsTable.ownerName,
        ownerEmail: teamsTable.ownerEmail,
        tournamentId: teamsTable.tournamentId,
      })
      .from(teamsTable)
      .where(and(...conditions));

    for (const t of teams) {
      if (isValidEmail(t.ownerEmail)) {
        results.push({
          name: t.ownerName,
          email: t.ownerEmail!.trim(),
          role: "team_owner",
          entityType: "team",
          entityId: t.id,
          tournamentId: t.tournamentId,
        });
      }
    }
  }

  if (filter.type === "organisers") {
    const orgs = await db
      .select({ id: organizersTable.id, name: organizersTable.name, email: organizersTable.email })
      .from(organizersTable);

    for (const o of orgs) {
      if (isValidEmail(o.email)) {
        results.push({
          name: o.name,
          email: o.email!.trim(),
          role: "organiser",
          entityType: "organizer",
          entityId: o.id,
        });
      }
    }
  }

  if (filter.type === "tournament" && filter.tournamentId) {
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, filter.tournamentId))
      .limit(1);

    if (tournament && isValidEmail(tournament.organizerEmail)) {
      results.push({
        name: tournament.organizerName,
        email: tournament.organizerEmail!.trim(),
        role: "organiser",
        entityType: "organizer",
        entityId: tournament.organizerId,
        tournamentId: tournament.id,
      });
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function queueBulkCommunication(params: {
  templateId: string;
  recipients: Array<{ name: string | null; email: string; role: string; entityType?: string; entityId?: number; tournamentId?: number }>;
  mergeData?: Record<string, unknown>;
  createdByAdmin?: string;
  sendImmediately?: boolean;
}): Promise<{ campaignId: string; jobIds: string[]; queued: number }> {
  const campaignId = randomUUID();
  const jobIds: string[] = [];

  for (const recipient of params.recipients) {
    const mergeData = await buildMergeDataForRecipient({
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      entityType: recipient.entityType,
      entityId: recipient.entityId,
      tournamentId: recipient.tournamentId,
    });

    const jobId = await createCommunicationJob({
      channel: "email",
      templateId: params.templateId,
      tournamentId: recipient.tournamentId ?? null,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      recipientRole: recipient.role,
      entityType: recipient.entityType ?? null,
      entityId: recipient.entityId ?? null,
      mergeData: { ...mergeData, ...params.mergeData },
      idempotencyKey: `bulk:${campaignId}:${recipient.email}`,
      sentBy: "bulk",
      createdByAdmin: params.createdByAdmin ?? null,
      bulkCampaignId: campaignId,
      skipAutoQueue: !params.sendImmediately,
    });

    if (jobId) {
      jobIds.push(jobId);
      if (params.sendImmediately) await queueJob(jobId);
    }
  }

  return { campaignId, jobIds, queued: jobIds.length };
}

/** Teams and players for bulk targeting dropdowns (Super Admin). */
export async function getBulkTargets(tournamentId: number) {
  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      ownerName: teamsTable.ownerName,
      ownerEmail: teamsTable.ownerEmail,
    })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(teamsTable.name);

  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      email: playersTable.email,
      status: playersTable.status,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId))
    .orderBy(playersTable.name);

  const isValidEmail = (email: string | null | undefined) =>
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return {
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      ownerName: t.ownerName,
      ownerEmail: t.ownerEmail,
      hasEmail: isValidEmail(t.ownerEmail),
    })),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status,
      hasEmail: isValidEmail(p.email),
    })),
  };
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(communicationSettingsTable);
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updateSetting(
  key: string,
  value: Record<string, unknown>,
  updatedBy?: string,
): Promise<void> {
  await db
    .insert(communicationSettingsTable)
    .values({ key, value, updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: communicationSettingsTable.key,
      set: { value, updatedBy: updatedBy ?? null, updatedAt: new Date() },
    });
}
