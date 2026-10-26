import {
  pgTable,
  text,
  serial,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

/**
 * Sport-specific identity and demographic profiles for canonical Members.
 * One active profile per (member_id, sport_slug).
 *
 * Keeps sport attributes (batting style, handedness, federation IDs) separate
 * from canonical Member identity and outside performance statistics.
 */
export const memberSportProfilesTable = pgTable(
  "member_sport_profiles",
  {
    id: serial("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    /** Sport identifier slug (e.g. cricket, badminton, football) */
    sportSlug: text("sport_slug").notNull(),
    /** Sport primary playing role (e.g. Batsman, Bowler, Singles, Doubles) */
    primaryRole: text("primary_role"),
    secondaryRole: text("secondary_role"),
    /** Playing hand (e.g. R, L, Right-hand bat, Left-arm fast) */
    handedness: text("handedness"),
    /** National or international federation identifier (e.g. BWF code) */
    federationCode: text("federation_code"),
    /** Extensible sport profile metadata without schema migration */
    profileJson: jsonb("profile_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_msp_member_sport").on(t.memberId, t.sportSlug),
    index("ix_msp_member_id").on(t.memberId),
    index("ix_msp_sport_slug").on(t.sportSlug),
  ],
);

export const insertMemberSportProfileSchema = createInsertSchema(
  memberSportProfilesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMemberSportProfileSchema = createSelectSchema(
  memberSportProfilesTable,
);

export type MemberSportProfile = typeof memberSportProfilesTable.$inferSelect;
export type InsertMemberSportProfile = z.infer<
  typeof insertMemberSportProfileSchema
>;
