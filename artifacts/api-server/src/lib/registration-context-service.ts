import { normalizeRegistrationCode, isValidRegistrationCodeFormat } from "@workspace/api-base/registration-url";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Single-query tournament lookup by public registration / auction code. */
export async function loadTournamentByRegistrationCode(
  rawCode: string,
): Promise<typeof tournamentsTable.$inferSelect | null> {
  const code = normalizeRegistrationCode(rawCode);
  if (!isValidRegistrationCodeFormat(code)) return null;

  const [row] = await db
    .select()
    .from(tournamentsTable)
    .where(sql`upper(${tournamentsTable.auctionCode}) = ${code}`)
    .limit(1);

  return row ?? null;
}
