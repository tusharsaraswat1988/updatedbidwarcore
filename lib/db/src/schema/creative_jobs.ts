import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/** Buzz Studio creative render jobs — queue only; PNG rendering is a future phase. */
export const creativeJobsTable = pgTable(
  "creative_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: integer("tournament_id").notNull(),
    templateId: text("template_id").notNull(),
    status: text("status").notNull().default("queued"),
    contractJson: jsonb("contract_json").$type<Record<string, unknown>>().notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    requestedByUserId: integer("requested_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    resultUrl: text("result_url"),
    downloadEnabled: boolean("download_enabled").notNull().default(false),
  },
  (t) => [
    index("ix_creative_jobs_tournament_id").on(t.tournamentId),
    index("ix_creative_jobs_status").on(t.status),
    index("ix_creative_jobs_created_at").on(t.createdAt),
    index("ix_creative_jobs_tournament_created").on(t.tournamentId, t.createdAt),
  ],
);

export type CreativeJobRow = typeof creativeJobsTable.$inferSelect;
export type InsertCreativeJobRow = typeof creativeJobsTable.$inferInsert;
