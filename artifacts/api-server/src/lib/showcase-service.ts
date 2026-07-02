import { db } from "@workspace/db";
import { showcaseEventsTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";

export type ShowcaseEventRow = typeof showcaseEventsTable.$inferSelect;

/** Active gallery cards — same query as GET /api/showcase-events. */
export async function listActive(): Promise<ShowcaseEventRow[]> {
  return db
    .select()
    .from(showcaseEventsTable)
    .where(eq(showcaseEventsTable.active, true))
    .orderBy(asc(showcaseEventsTable.displayOrder), asc(showcaseEventsTable.createdAt));
}

export const showcaseService = {
  listActive,
};
