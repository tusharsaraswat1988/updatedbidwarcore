import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoringOfficialsTable = pgTable(
  "scoring_officials",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    name: text("name").notNull(),
    /** scorer | referee | match_referee */
    role: text("role").notNull().default("scorer"),
    mobile: text("mobile"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_scoring_officials_tournament_id").on(t.tournamentId)],
);

export const insertScoringOfficialSchema = createInsertSchema(scoringOfficialsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringOfficial = typeof scoringOfficialsTable.$inferSelect;
export type InsertScoringOfficial = z.infer<typeof insertScoringOfficialSchema>;
