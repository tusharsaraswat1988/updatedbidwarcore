import {
  pgTable,
  bigserial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Platform-wide append-only audit trail.
 * Rows are INSERT-only — no UPDATE or DELETE from application code.
 * Supports timeline, global feed, alert engine, and CSV export.
 */
export const platformAuditEventsTable = pgTable(
  "platform_audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),

    eventCategory: text("event_category").notNull(),
    eventAction: text("event_action").notNull(),
    eventSeverity: text("event_severity").notNull().default("info"),
    outcome: text("outcome").notNull().default("success"),

    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    actorLabel: text("actor_label"),
    actorIp: text("actor_ip"),
    actorUserAgent: text("actor_user_agent"),
    sessionId: text("session_id"),

    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    tournamentId: integer("tournament_id"),
    teamId: integer("team_id"),
    playerId: integer("player_id"),

    summary: text("summary").notNull(),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    changesJson: jsonb("changes_json"),

    relatedTable: text("related_table"),
    relatedId: text("related_id"),

    requestId: text("request_id"),
    requestMethod: text("request_method"),
    requestPath: text("request_path"),
    source: text("source").notNull().default("api"),

    alertKey: text("alert_key"),
    criticalTagsJson: jsonb("critical_tags_json").$type<string[]>().default([]),
    monitoringFlagsJson: jsonb("monitoring_flags_json").$type<{
      flags: Array<{ ruleId: string; label: string; severity: "low" | "medium" | "high" }>;
      score: number;
    } | null>(),
    exportable: boolean("exportable").notNull().default(true),
  },
  (t) => [
    index("ix_audit_tournament_time").on(t.tournamentId, t.occurredAt),
    index("ix_audit_actor_time").on(t.actorType, t.actorId, t.occurredAt),
    index("ix_audit_resource").on(t.resourceType, t.resourceId, t.occurredAt),
    index("ix_audit_category_action_time").on(t.eventCategory, t.eventAction, t.occurredAt),
    index("ix_audit_occurred_at").on(t.occurredAt),
    index("ix_audit_alert_key").on(t.alertKey, t.occurredAt),
    index("ix_audit_severity").on(t.eventSeverity, t.occurredAt),
  ],
);

export type PlatformAuditEvent = typeof platformAuditEventsTable.$inferSelect;
export type InsertPlatformAuditEvent = typeof platformAuditEventsTable.$inferInsert;
