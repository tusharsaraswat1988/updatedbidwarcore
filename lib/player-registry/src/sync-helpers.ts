import { db } from "@workspace/db";
import { masterSportsSyncLogTable } from "@workspace/db";

export async function logSync(
  action: string,
  sourceType: string,
  sourceId: string | null,
  masterPlayerId: string | null,
  masterTeamId: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(masterSportsSyncLogTable).values({
      action,
      sourceType,
      sourceId,
      masterPlayerId,
      masterTeamId,
      detailsJson: details ? JSON.stringify(details) : null,
    });
  } catch {
    // Non-blocking audit
  }
}
