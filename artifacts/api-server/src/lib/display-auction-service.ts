import { db } from "@workspace/db";
import { displayAuctionsTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";

export type DisplayAuctionRow = typeof displayAuctionsTable.$inferSelect;

/** Public landing strip — same query as GET /api/display-auctions. */
export async function listForLanding(): Promise<DisplayAuctionRow[]> {
  return db
    .select()
    .from(displayAuctionsTable)
    .where(eq(displayAuctionsTable.showOnLanding, true))
    .orderBy(asc(displayAuctionsTable.scheduledDate), asc(displayAuctionsTable.scheduledTime));
}

export const displayAuctionService = {
  listForLanding,
};
