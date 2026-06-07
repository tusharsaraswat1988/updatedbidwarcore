/**
 * Platform Audit Service — append-only investigation trail.
 * Fire-and-forget writes; failures are swallowed so hot paths never block.
 */

import type { Request } from "express";
import { db } from "@workspace/db";
import { platformAuditEventsTable } from "@workspace/db";
import { computeFieldChanges } from "./audit-snapshots";
import { resolveCriticalTags } from "./audit-critical-tags";
import { evaluateStaticSuspicion, type MonitoringFlags } from "./audit-suspicion";
import { enrichMonitoringFlagsAsync } from "./audit-enrichment";

type AuditRowDraft = {
  eventCategory: string;
  eventAction: string;
  eventSeverity: string;
  outcome: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  actorIp: string | null;
  actorUserAgent: string | null;
  sessionId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  tournamentId: number | null;
  teamId: number | null;
  playerId: number | null;
  summary: string;
  reason: string | null;
  metadataJson: Record<string, unknown> | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  changesJson: Array<{ field: string; old: unknown; new: unknown }> | null;
  relatedTable: string | null;
  relatedId: string | null;
  requestId: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  source: string;
  alertKey: string | null;
  criticalTagsJson: string[];
  monitoringFlagsJson: MonitoringFlags | null;
  exportable: boolean;
};

export type AuditCategory =
  | "auth"
  | "tournament"
  | "team"
  | "player"
  | "auction"
  | "finance"
  | "admin"
  | "comm"
  | "sync"
  | "security"
  | "category";

export type AuditSeverity = "info" | "warning" | "critical";
export type AuditOutcome = "success" | "failure" | "denied" | "partial";
export type AuditSource = "api" | "local" | "webhook" | "scheduler" | "mirror";

export type ActorType =
  | "master_admin"
  | "data_entry_admin"
  | "organizer_account"
  | "tournament_organizer"
  | "team_owner"
  | "system"
  | "export_token"
  | "public"
  | "seed_key";

export interface AuditEventInput {
  category: AuditCategory;
  action: string;
  summary: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  reason?: string | null;
  resource?: { type: string; id: string | number };
  tournamentId?: number | null;
  teamId?: number | null;
  playerId?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  alertKey?: string | null;
  related?: { table: string; id: string | number } | null;
  source?: AuditSource;
  actor?: {
    type: ActorType;
    id?: string | null;
    label?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
  };
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? null;
  if (Array.isArray(forwarded)) return forwarded[0] ?? null;
  return req.socket?.remoteAddress ?? null;
}

export function resolveActor(req: Request, tournamentId?: number): AuditEventInput["actor"] {
  const u = req.jwtUser;
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  if (u?.isAdmin) {
    return {
      type: u.adminLevel === "data_entry" ? "data_entry_admin" : "master_admin",
      id: u.adminLevel ?? "master",
      label: u.adminLevel === "data_entry" ? "Data Entry Admin" : "Master Admin",
      ip,
      userAgent,
    };
  }

  if (u?.organizerAccountId) {
    return {
      type: "organizer_account",
      id: String(u.organizerAccountId),
      label: `Organizer #${u.organizerAccountId}`,
      ip,
      userAgent,
    };
  }

  if (tournamentId !== undefined && u?.organizer?.[String(tournamentId)]) {
    return {
      type: "tournament_organizer",
      id: String(tournamentId),
      label: `Tournament ${tournamentId} Organizer`,
      ip,
      userAgent,
    };
  }

  if (req.headers["x-export-token"]) {
    return { type: "export_token", id: tournamentId != null ? String(tournamentId) : null, label: "Export Token", ip, userAgent };
  }

  if (req.headers["x-seed-key"]) {
    return { type: "seed_key", label: "Seed Key", ip, userAgent };
  }

  return { type: "public", label: "Public", ip, userAgent };
}

function buildRow(req: Request | null, input: AuditEventInput): AuditRowDraft {
  const actor = input.actor
    ?? (req ? resolveActor(req, input.tournamentId ?? undefined) : null)
    ?? { type: "system" as const, id: null, label: "System", ip: null, userAgent: null, sessionId: null };
  const changes =
    input.before && input.after ? computeFieldChanges(input.before, input.after) : null;

  const requestId = req && "id" in req ? String((req as Request & { id?: string }).id ?? "") : null;

  return {
    eventCategory: input.category,
    eventAction: input.action,
    eventSeverity: input.severity ?? (input.alertKey ? "warning" : "info"),
    outcome: input.outcome ?? "success",
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorLabel: actor.label ?? null,
    actorIp: actor.ip ?? null,
    actorUserAgent: actor.userAgent ?? null,
    sessionId: actor.sessionId ?? null,
    resourceType: input.resource?.type ?? null,
    resourceId: input.resource?.id != null ? String(input.resource.id) : null,
    tournamentId: input.tournamentId ?? null,
    teamId: input.teamId ?? null,
    playerId: input.playerId ?? null,
    summary: input.summary,
    reason: input.reason ?? null,
    metadataJson: input.metadata ?? null,
    beforeJson: input.before ?? null,
    afterJson: input.after ?? null,
    changesJson: changes && changes.length > 0 ? changes : null,
    relatedTable: input.related?.table ?? null,
    relatedId: input.related?.id != null ? String(input.related.id) : null,
    requestId: requestId || null,
    requestMethod: req?.method ?? null,
    requestPath: req?.originalUrl ?? req?.path ?? null,
    source: input.source ?? "api",
    alertKey: input.alertKey ?? null,
    criticalTagsJson: [],
    monitoringFlagsJson: null,
    exportable: true,
  };
}

function persist(req: Request | null, input: AuditEventInput, row: AuditRowDraft): void {
  void Promise.resolve().then(async () => {
    try {
      const tags = resolveCriticalTags(input);
      const staticFlags = evaluateStaticSuspicion({
        input,
        tags,
        actorType: row.actorType,
        actorIp: row.actorIp,
        occurredAt: new Date(),
      });
      const monitoringFlags = await enrichMonitoringFlagsAsync(
        staticFlags,
        row.actorIp,
        row.tournamentId,
      );
      await db.insert(platformAuditEventsTable).values({
        ...row,
        criticalTagsJson: tags,
        monitoringFlagsJson: monitoringFlags.flags.length > 0 ? monitoringFlags : null,
      });
    } catch {
      // Audit must never break the request path
    }
  });
}

export function auditLog(req: Request, input: AuditEventInput): void {
  persist(req, input, buildRow(req, input));
}

export function auditLogSystem(input: AuditEventInput): void {
  const normalized = { ...input, actor: input.actor ?? { type: "system" as const, label: "System" } };
  persist(null, normalized, buildRow(null, normalized));
}

export function auditDenied(req: Request, input: Omit<AuditEventInput, "outcome">): void {
  auditLog(req, { ...input, outcome: "denied", severity: input.severity ?? "warning" });
}
