import { normalizeRegistrationCode, isValidRegistrationCodeFormat } from "@workspace/api-base/registration-url";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export { isValidRegistrationCodeFormat };

/** Resolve a public registration code (auction code) to an internal tournament ID. */
export async function findTournamentIdByRegistrationCode(rawCode: string): Promise<number | null> {
  const code = normalizeRegistrationCode(rawCode);
  if (!isValidRegistrationCodeFormat(code)) return null;

  const [row] = await db
    .select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(sql`upper(${tournamentsTable.auctionCode}) = ${code}`)
    .limit(1);

  return row?.id ?? null;
}
