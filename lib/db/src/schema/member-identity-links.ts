import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

/**
 * Non-destructive Identity Link Bridge between canonical Member and legacy identity records.
 *
 * Invariants:
 * 1. Additive only — never alters or deletes legacy rows.
 * 2. Legacy primary keys remain valid and addressable.
 * 3. Links can be detached, rejected, or updated without data loss.
 * 4. Preserves evidence and provenance.
 */
export const memberIdentityLinksTable = pgTable(
  "member_identity_links",
  {
    id: serial("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    /** Source table: organizers | global_players | players | badminton_players | scorer_accounts | scoring_officials | teams_owner */
    sourceTable: text("source_table").notNull(),
    /** Source table primary key representation (e.g. "gp_0194", "42") */
    sourceRecordId: text("source_record_id").notNull(),
    /** Link type: direct_fk | verified_phone | verified_email | manual_curation | legacy_import */
    linkType: text("link_type").notNull().default("direct_fk"),
    /** Confidence score: 0 to 100 integer (100 = verified) */
    confidenceScore: integer("confidence_score").notNull().default(100),
    /** Provenance metadata and match evidence */
    provenanceJson: jsonb("provenance_json").$type<Record<string, unknown> | null>(),
    /** Link status: active | candidate | rejected | detached */
    status: text("status").notNull().default("active"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_mil_source_record_member").on(
      t.sourceTable,
      t.sourceRecordId,
      t.memberId,
    ),
    index("ix_mil_member_id").on(t.memberId),
    index("ix_mil_source").on(t.sourceTable, t.sourceRecordId),
    index("ix_mil_status").on(t.status),
  ],
);

export const insertMemberIdentityLinkSchema = createInsertSchema(
  memberIdentityLinksTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMemberIdentityLinkSchema = createSelectSchema(
  memberIdentityLinksTable,
);

export type MemberIdentityLink = typeof memberIdentityLinksTable.$inferSelect;
export type InsertMemberIdentityLink = z.infer<
  typeof insertMemberIdentityLinkSchema
>;
