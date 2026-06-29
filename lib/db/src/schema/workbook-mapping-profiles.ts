import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/** Saved column mapping profiles for organizer-specific sheet formats */
export const workbookMappingProfilesTable = pgTable(
  "workbook_mapping_profiles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    organizerId: integer("organizer_id"),
    tournamentId: integer("tournament_id"),
    sourceLabel: text("source_label"),
    sport: text("sport"),
    fieldsJson: jsonb("fields_json").notNull().default([]),
    createdBy: text("created_by").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    useCount: integer("use_count").notNull().default(0),
  },
  (t) => [
    index("ix_workbook_mapping_profiles_tournament").on(t.tournamentId),
    index("ix_workbook_mapping_profiles_organizer").on(t.organizerId),
  ],
);

export type WorkbookMappingProfileRow = typeof workbookMappingProfilesTable.$inferSelect;
