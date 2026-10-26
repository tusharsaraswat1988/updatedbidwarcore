import { pgTable, text, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";

/**
 * Generate a canonical, collision-resistant Member ID.
 * Format: mem_<32-hex-characters>
 */
export function generateMemberId(): string {
  return `mem_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Canonical future platform-level human identity.
 * Represents ONE physical human being or accountable person entity.
 *
 * Distinct from capabilities, roles (Organizer, Scorer, Player, Team Owner),
 * tournament participations, auction economics, and sport statistics.
 */
export const membersTable = pgTable(
  "members",
  {
    /** Canonical immutable identifier (e.g. mem_0194e3...) */
    id: text("id").primaryKey(),
    /** Chosen display name */
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    primaryMobile: text("primary_mobile"),
    primaryEmail: text("primary_email"),
    isMobileVerified: boolean("is_mobile_verified").notNull().default(false),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    /** ISO date format YYYY-MM-DD */
    dob: text("dob"),
    /** M | F | Other */
    gender: text("gender"),
    /** ISO 3166-1 alpha-3 code (e.g. IND, USA) */
    country: text("country"),
    state: text("state"),
    city: text("city"),
    avatarUrl: text("avatar_url"),
    avatarPublicId: text("avatar_public_id"),
    /** Account lifecycle status: active | suspended | pending_verification | deactivated */
    accountStatus: text("account_status").notNull().default("active"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_members_display_name").on(t.displayName),
    index("ix_members_primary_mobile").on(t.primaryMobile),
    index("ix_members_primary_email").on(t.primaryEmail),
    index("ix_members_account_status").on(t.accountStatus),
  ],
);

export const insertMemberSchema = createInsertSchema(membersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectMemberSchema = createSelectSchema(membersTable);

export type Member = typeof membersTable.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
