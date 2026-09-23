import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

/**
 * Authentication methods linked to a canonical Member.
 * A single Member can have multiple auth identities (e.g., password, Google OAuth, phone OTP).
 * Authentication is explicitly decoupled from identity.
 */
export const memberAuthIdentitiesTable = pgTable(
  "member_auth_identities",
  {
    id: serial("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    /** Provider: password | google | phone_otp | apple */
    provider: text("provider").notNull(),
    /** External or provider-specific subject identifier (e.g. Google sub, unique OAuth ID) */
    providerSubject: text("provider_subject"),
    /** Normalized identifier (e.g. normalized email or normalized mobile number) */
    normalizedIdentifier: text("normalized_identifier"),
    /** Password hash (scrypt), null for third-party OAuth providers */
    passwordHash: text("password_hash"),
    /** Whether this credential has verified ownership of identifier */
    isVerified: boolean("is_verified").notNull().default(false),
    /** Whether this credential is active for login */
    isEnabled: boolean("is_enabled").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_mai_provider_subject").on(t.provider, t.providerSubject),
    index("ix_mai_member_id").on(t.memberId),
    index("ix_mai_identifier").on(t.normalizedIdentifier),
    index("ix_mai_provider_identifier").on(t.provider, t.normalizedIdentifier),
  ],
);

export const insertMemberAuthIdentitySchema = createInsertSchema(memberAuthIdentitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMemberAuthIdentitySchema = createSelectSchema(memberAuthIdentitiesTable);

export type MemberAuthIdentity = typeof memberAuthIdentitiesTable.$inferSelect;
export type InsertMemberAuthIdentity = z.infer<typeof insertMemberAuthIdentitySchema>;
