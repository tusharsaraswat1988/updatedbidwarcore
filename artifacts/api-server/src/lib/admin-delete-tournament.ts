import { db } from "@workspace/db";
import {
  auctionBidEventsTable,
  auctionPlayerEventsTable,
  auctionSessionsTable,
  auctionTimerEventsTable,
  badmintonAnalyticsTable,
  badmintonCategoriesTable,
  badmintonCourtsTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  badmintonPlayersTable,
  badmintonRegistrationsTable,
  bidsTable,
  categoriesTable,
  commLogsTable,
  consentBlastLogTable,
  consentTokensTable,
  creativeJobsTable,
  displayAuctionsTable,
  masterPlayerIdMappingsTable,
  notificationLogsTable,
  playerImportLogsTable,
  playerStatisticsTable,
  playerTeamAssignmentsTable,
  playersTable,
  purseBoostersTable,
  pushSubscriptionsTable,
  scoringDrawsTable,
  scoringEventsTable,
  scoringFixturesTable,
  scoringGroupsTable,
  scoringMatchSquadsTable,
  scoringMatchesTable,
  scoringOfficialsTable,
  scoringSessionsTable,
  scoringStandingsTable,
  scoringVenuesTable,
  teamsTable,
  tournamentPlayerProfilesTable,
  tournamentsTable,
  waConsentEventsTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { invalidateIntelCacheForTournament } from "./intelligence-cache";
import { archiveIntelligenceBeforeDelete } from "./intelligence-archive";

/**
 * Permanently removes a tournament and all tournament-scoped data.
 * Used only by master/admin delete — not organizer self-service delete.
 *
 * Preserves: organizer accounts, global/master player & team identities,
 * platform audit trail, and external media (Cloudinary URLs are not purged).
 */
export async function adminDeleteTournamentCascade(tournamentId: number): Promise<boolean> {
  const [beforeTournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  if (!beforeTournament) return false;

  await db.transaction(async (tx) => {
    const matchRows = await tx
      .select({ id: scoringMatchesTable.id })
      .from(scoringMatchesTable)
      .where(eq(scoringMatchesTable.tournamentId, tournamentId));
    const matchIds = matchRows.map((row) => row.id);

    if (matchIds.length > 0) {
      await tx
        .delete(scoringMatchSquadsTable)
        .where(inArray(scoringMatchSquadsTable.matchId, matchIds));
    }

    // Scoring module
    await tx.delete(scoringSessionsTable).where(eq(scoringSessionsTable.tournamentId, tournamentId));
    await tx.delete(scoringEventsTable).where(eq(scoringEventsTable.tournamentId, tournamentId));
    await tx.delete(scoringMatchesTable).where(eq(scoringMatchesTable.tournamentId, tournamentId));
    await tx.delete(scoringFixturesTable).where(eq(scoringFixturesTable.tournamentId, tournamentId));
    await tx.delete(scoringStandingsTable).where(eq(scoringStandingsTable.tournamentId, tournamentId));
    await tx.delete(scoringDrawsTable).where(eq(scoringDrawsTable.tournamentId, tournamentId));
    await tx.delete(scoringGroupsTable).where(eq(scoringGroupsTable.tournamentId, tournamentId));
    await tx.delete(scoringVenuesTable).where(eq(scoringVenuesTable.tournamentId, tournamentId));
    await tx.delete(scoringOfficialsTable).where(eq(scoringOfficialsTable.tournamentId, tournamentId));

    // Badminton module
    await tx
      .delete(badmintonMatchDetailsTable)
      .where(eq(badmintonMatchDetailsTable.tournamentId, tournamentId));
    await tx.delete(badmintonFixturesTable).where(eq(badmintonFixturesTable.tournamentId, tournamentId));
    await tx.delete(badmintonDrawsTable).where(eq(badmintonDrawsTable.tournamentId, tournamentId));
    await tx
      .delete(badmintonRegistrationsTable)
      .where(eq(badmintonRegistrationsTable.tournamentId, tournamentId));
    await tx
      .delete(badmintonCategoriesTable)
      .where(eq(badmintonCategoriesTable.tournamentId, tournamentId));
    await tx.delete(badmintonCourtsTable).where(eq(badmintonCourtsTable.tournamentId, tournamentId));
    await tx.delete(badmintonPlayersTable).where(eq(badmintonPlayersTable.tournamentId, tournamentId));
    await tx
      .delete(badmintonAnalyticsTable)
      .where(eq(badmintonAnalyticsTable.tournamentId, tournamentId));

    // Archive intelligence logs before purge (training data preserved)
    await archiveIntelligenceBeforeDelete(tx, {
      id: tournamentId,
      name: beforeTournament.name,
      sport: beforeTournament.sport,
      organizerId: beforeTournament.organizerId,
      venue: beforeTournament.venue,
      auctionDate: beforeTournament.auctionDate,
      status: beforeTournament.status,
    });

    // Auction intelligence logs (live rows removed after archive)
    await tx.delete(auctionBidEventsTable).where(eq(auctionBidEventsTable.tournamentId, tournamentId));
    await tx
      .delete(auctionPlayerEventsTable)
      .where(eq(auctionPlayerEventsTable.tournamentId, tournamentId));
    await tx
      .delete(auctionTimerEventsTable)
      .where(eq(auctionTimerEventsTable.tournamentId, tournamentId));

    // Core auction
    await tx.delete(bidsTable).where(eq(bidsTable.tournamentId, tournamentId));
    await tx.delete(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, tournamentId));
    await tx.delete(purseBoostersTable).where(eq(purseBoostersTable.tournamentId, tournamentId));
    await tx.delete(playersTable).where(eq(playersTable.tournamentId, tournamentId));
    await tx.delete(teamsTable).where(eq(teamsTable.tournamentId, tournamentId));
    await tx.delete(categoriesTable).where(eq(categoriesTable.tournamentId, tournamentId));

    // Master-sports tournament overlays (not global identities)
    await tx
      .delete(tournamentPlayerProfilesTable)
      .where(eq(tournamentPlayerProfilesTable.tournamentId, tournamentId));
    await tx
      .delete(playerTeamAssignmentsTable)
      .where(eq(playerTeamAssignmentsTable.tournamentId, tournamentId));
    await tx
      .delete(playerStatisticsTable)
      .where(eq(playerStatisticsTable.tournamentId, tournamentId));
    await tx
      .delete(masterPlayerIdMappingsTable)
      .where(eq(masterPlayerIdMappingsTable.tournamentId, tournamentId));

    // Comms, notifications, integrations
    await tx.delete(consentTokensTable).where(eq(consentTokensTable.tournamentId, tournamentId));
    await tx.delete(commLogsTable).where(eq(commLogsTable.tournamentId, tournamentId));
    await tx.delete(consentBlastLogTable).where(eq(consentBlastLogTable.tournamentId, tournamentId));
    await tx.delete(waConsentEventsTable).where(eq(waConsentEventsTable.tournamentId, tournamentId));
    await tx
      .delete(notificationLogsTable)
      .where(eq(notificationLogsTable.tournamentId, tournamentId));
    await tx
      .delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.tournamentId, tournamentId));
    await tx.delete(creativeJobsTable).where(eq(creativeJobsTable.tournamentId, tournamentId));
    await tx
      .delete(displayAuctionsTable)
      .where(eq(displayAuctionsTable.tournamentId, tournamentId));
    await tx
      .delete(playerImportLogsTable)
      .where(
        or(
          eq(playerImportLogsTable.sourceTournamentId, tournamentId),
          eq(playerImportLogsTable.targetTournamentId, tournamentId),
        ),
      );

    await tx.delete(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  });

  invalidateIntelCacheForTournament(tournamentId);
  return true;
}
