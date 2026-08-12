/**
 * Shared roster assignment persistence (sport-scoped franchise roster history).
 */
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { playerTeamAssignmentsTable } from "@workspace/db";
import { logSync } from "./sync-helpers";
export async function endActiveRosterAssignment(masterPlayerId, tournamentId, sport, endedAt = new Date()) {
    if (!masterPlayerId)
        return;
    const sportSlug = sport.trim().toLowerCase() || "cricket";
    await db
        .update(playerTeamAssignmentsTable)
        .set({ isActive: false, endedAt })
        .where(and(eq(playerTeamAssignmentsTable.playerId, masterPlayerId), eq(playerTeamAssignmentsTable.tournamentId, tournamentId), eq(playerTeamAssignmentsTable.sport, sportSlug), eq(playerTeamAssignmentsTable.isActive, true)));
}
export async function assignPlayerToFranchiseRoster(input) {
    const sportSlug = input.sport.trim().toLowerCase() || "cricket";
    await endActiveRosterAssignment(input.masterPlayerId, input.tournamentId, sportSlug);
    await db.insert(playerTeamAssignmentsTable).values({
        playerId: input.masterPlayerId,
        teamId: input.masterTeamId,
        tournamentId: input.tournamentId,
        sport: sportSlug,
        auctionPlayerId: input.auctionPlayerId,
        auctionTeamId: input.auctionTeamId,
        assignmentType: input.assignmentType,
        isActive: true,
        endedAt: null,
    });
    await logSync("roster_assignment_created", `${sportSlug}_roster`, input.auctionPlayerId != null ? String(input.auctionPlayerId) : null, input.masterPlayerId, input.masterTeamId, {
        tournamentId: input.tournamentId,
        assignmentType: input.assignmentType,
        sport: sportSlug,
    });
}
