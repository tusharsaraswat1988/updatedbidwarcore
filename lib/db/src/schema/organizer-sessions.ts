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
import { organizersTable } from "./organizers";
import { membersTable } from "./members";
import { tournamentsTable } from "./tournaments";

/**
 * Generate a collision-resistant Organizer Session ID.
 * Format: orgsess_<32-hex-characters>
 */
export function generateOrganizerSessionId(): string {
  return `orgsess_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Server-side session store and revocation bridge for Organizer authentication.
 * Bridges legacy organizer account IDs (integer) and optional canonical Member IDs (text).
 */
export const organizerSessionsTable = pgTable(
  "organizer_sessions",
  {
    id: text("id").primaryKey(),
    organizerAccountId: integer("organizer_account_id").references(
      () => organizersTable.id,
      { onDelete: "cascade" },
    ),
    memberId: text("member_id").references(() => membersTable.id, {
      onDelete: "set null",
    }),
    tournamentId: integer("tournament_id").references(() => tournamentsTable.id, {
      onDelete: "cascade",
    }),
    /** Scope: 'account' | 'tournament_password' */
    sessionScope: text("session_scope").notNull().default("account"),
    tokenHash: text("token_hash").notNull(),
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_orgsess_account_id").on(t.organizerAccountId),
    index("ix_orgsess_member_id").on(t.memberId),
    index("ix_orgsess_tournament_id").on(t.tournamentId),
    index("ix_orgsess_lookup").on(t.id, t.revokedAt, t.expiresAt),
    index("ix_orgsess_token_hash").on(t.tokenHash),
  ],
);

export const insertOrganizerSessionSchema = createInsertSchema(organizerSessionsTable).omit({
  createdAt: true,
});
export const selectOrganizerSessionSchema = createSelectSchema(organizerSessionsTable);

export type OrganizerSession = typeof organizerSessionsTable.$inferSelect;
export type InsertOrganizerSession = z.infer<typeof insertOrganizerSessionSchema>;
