import { count, eq, sql } from "drizzle-orm";
import {
  auctionBidEventsTable,
  auctionPlayerEventsTable,
  auctionTimerEventsTable,
  db,
  intelligenceArchivesTable,
} from "@workspace/db";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TournamentArchiveMeta {
  id: number;
  name: string;
  sport: string;
  organizerId: number | null;
  venue: string | null;
  auctionDate: string | null;
  status: string;
}

/**
 * Copies intelligence event logs into archive tables before tournament delete.
 * Returns archive id, or null when there is nothing to preserve.
 */
export async function archiveIntelligenceBeforeDelete(
  tx: DbTx,
  tournament: TournamentArchiveMeta,
): Promise<number | null> {
  const tid = tournament.id;

  const [[bidRow], [playerRow], [timerRow]] = await Promise.all([
    tx.select({ value: count() }).from(auctionBidEventsTable).where(eq(auctionBidEventsTable.tournamentId, tid)),
    tx.select({ value: count() }).from(auctionPlayerEventsTable).where(eq(auctionPlayerEventsTable.tournamentId, tid)),
    tx.select({ value: count() }).from(auctionTimerEventsTable).where(eq(auctionTimerEventsTable.tournamentId, tid)),
  ]);

  const bidCount = bidRow?.value ?? 0;
  const playerCount = playerRow?.value ?? 0;
  const timerCount = timerRow?.value ?? 0;

  if (bidCount + playerCount + timerCount === 0) return null;

  const metadata = {
    venue: tournament.venue,
    auctionDate: tournament.auctionDate,
    status: tournament.status,
    archivedReason: "admin_tournament_delete",
  };

  const [archive] = await tx
    .insert(intelligenceArchivesTable)
    .values({
      sourceTournamentId: tid,
      tournamentName: tournament.name,
      tournamentSport: tournament.sport,
      organizerId: tournament.organizerId,
      bidEventCount: bidCount,
      playerEventCount: playerCount,
      timerEventCount: timerCount,
      metadataJson: metadata,
    })
    .returning({ id: intelligenceArchivesTable.id });

  const archiveId = archive!.id;

  await tx.execute(sql`
    INSERT INTO intelligence_archive_bid_events (
      archive_id, source_tournament_id, source_event_id, tournament_name, tournament_sport,
      player_id, global_player_id, team_id, team_name, team_short_code, sport,
      bid_amount, previous_bid_amount, bid_increment, bid_sequence_number,
      milliseconds_since_last_bid, timer_remaining_seconds, is_manual_bid, became_leader, timestamp
    )
    SELECT
      ${archiveId}, abe.tournament_id, abe.id, ${tournament.name}, ${tournament.sport},
      abe.player_id, abe.global_player_id, abe.team_id, t.name, t.short_code, abe.sport,
      abe.bid_amount, abe.previous_bid_amount, abe.bid_increment, abe.bid_sequence_number,
      abe.milliseconds_since_last_bid, abe.timer_remaining_seconds, abe.is_manual_bid, abe.became_leader, abe.timestamp
    FROM auction_bid_events abe
    LEFT JOIN teams t ON t.id = abe.team_id
    WHERE abe.tournament_id = ${tid}
  `);

  await tx.execute(sql`
    INSERT INTO intelligence_archive_player_events (
      archive_id, source_tournament_id, source_event_id, tournament_name, tournament_sport,
      player_id, global_player_id, category_id, category_name, sport,
      player_name, player_role, player_age, player_city, player_snapshot_json,
      base_price, outcome, auction_started_at, auction_ended_at,
      final_amount, sold_to_team_id, sold_to_team_name,
      total_bids_received, interested_teams_count, auction_duration_seconds,
      average_secs_between_bids, timestamp
    )
    SELECT
      ${archiveId}, ape.tournament_id, ape.id, ${tournament.name}, ${tournament.sport},
      ape.player_id, ape.global_player_id, ape.category_id, c.name, ape.sport,
      ape.player_name, ape.player_role, ape.player_age, ape.player_city, ape.player_snapshot_json,
      ape.base_price, ape.outcome, ape.auction_started_at, ape.auction_ended_at,
      ape.final_amount, ape.sold_to_team_id, ape.sold_to_team_name,
      ape.total_bids_received, ape.interested_teams_count, ape.auction_duration_seconds,
      ape.average_secs_between_bids, ape.timestamp
    FROM auction_player_events ape
    LEFT JOIN categories c ON c.id = ape.category_id
    WHERE ape.tournament_id = ${tid}
  `);

  await tx.execute(sql`
    INSERT INTO intelligence_archive_timer_events (
      archive_id, source_tournament_id, source_event_id, tournament_name, tournament_sport,
      player_id, action, timer_type, timer_seconds, triggered_by, timestamp
    )
    SELECT
      ${archiveId}, ate.tournament_id, ate.id, ${tournament.name}, ${tournament.sport},
      ate.player_id, ate.action, ate.timer_type, ate.timer_seconds, ate.triggered_by, ate.timestamp
    FROM auction_timer_events ate
    WHERE ate.tournament_id = ${tid}
  `);

  return archiveId;
}
