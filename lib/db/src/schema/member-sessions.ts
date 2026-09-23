import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { membersTable } from "./members";
import { memberAuthIdentitiesTable } from "./member-auth-identities";

/**
 * Generate a collision-resistant Member Session ID.
 * Format: memsess_<32-hex-characters>
 */
export function generateMemberSessionId(): string {
  return `memsess_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Active and historical member authentication sessions.
 * Independent of legacy sessions (scorer_sessions, owner_sessions).
 */
export const memberSessionsTable = pgTable(
  "member_sessions",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    authIdentityId: integer("auth_identity_id").references(
      () => memberAuthIdentitiesTable.id,
      { onDelete: "cascade" },
    ),
    tokenHash: text("token_hash"),
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_ms_member_id").on(t.memberId),
    index("ix_ms_expires_at").on(t.expiresAt),
    index("ix_ms_revoked_at").on(t.revokedAt),
  ],
);

export const insertMemberSessionSchema = createInsertSchema(memberSessionsTable).omit({
  createdAt: true,
});
export const selectMemberSessionSchema = createSelectSchema(memberSessionsTable);

export type MemberSession = typeof memberSessionsTable.$inferSelect;
export type InsertMemberSession = z.infer<typeof insertMemberSessionSchema>;
