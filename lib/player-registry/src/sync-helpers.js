import { db } from "@workspace/db";
import { masterSportsSyncLogTable } from "@workspace/db";
export async function logSync(action, sourceType, sourceId, masterPlayerId, masterTeamId, details) {
    try {
        await db.insert(masterSportsSyncLogTable).values({
            action,
            sourceType,
            sourceId,
            masterPlayerId,
            masterTeamId,
            detailsJson: details ? JSON.stringify(details) : null,
        });
    }
    catch {
        // Non-blocking audit
    }
}
