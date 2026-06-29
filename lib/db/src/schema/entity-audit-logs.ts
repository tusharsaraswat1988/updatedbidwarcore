import {
  pgTable,
  text,
  integer,
  bigserial,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Generic field-level audit trail for entity mutations.
 * Complements platform_audit_events with granular rollback support.
 */
export const entityAuditLogsTable = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    action: text("action").notNull(), // bulk_import | rollback | manual_update
    performedBy: text("performed_by").notNull(),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    jobId: integer("job_id"),
    tournamentId: integer("tournament_id"),
  },
  (t) => [
    index("ix_audit_logs_entity").on(t.entityType, t.entityId, t.performedAt),
    index("ix_audit_logs_job").on(t.jobId),
    index("ix_audit_logs_tournament").on(t.tournamentId, t.performedAt),
  ],
);

export type EntityAuditLog = typeof entityAuditLogsTable.$inferSelect;
