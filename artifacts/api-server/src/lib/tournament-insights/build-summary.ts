import { db, pool } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  tournamentsTable,
  auctionSessionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildTeamPurseSnapshot } from "../team-purse-snapshot";
import type { TournamentInsightsSummary } from "./types";

function mapTournamentPhase(status: string | undefined): TournamentInsightsSummary["tournamentPhase"] {
  if (status === "active") return "active";
  if (status === "completed") return "completed";
  return "setup";
}

function mapAuctionStatus(
  sessionStatus: string | undefined,
  isBreak: boolean,
): TournamentInsightsSummary["auctionStatus"] {
  if (isBreak) return "break";
  if (sessionStatus === "active") return "active";
  if (sessionStatus === "paused") return "paused";
  if (sessionStatus === "idle") return "idle";
  return null;
}

export async function buildTournamentInsightsSummary(
  tournamentId: number,
): Promise<TournamentInsightsSummary | null> {
  const [tournament] = await db
    .select({
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      status: tournamentsTable.status,
      maximumSquadSize: tournamentsTable.maximumSquadSize,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  if (!tournament) return null;

  const [session] = await db
    .select({
      status: auctionSessionsTable.status,
      isBreak: auctionSessionsTable.isBreak,
      lastAction: auctionSessionsTable.lastAction,
    })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId));

  const teamPurses = await buildTeamPurseSnapshot(tournamentId);
  const maxSquad = tournament.maximumSquadSize ?? 0;

  const completedTeams = maxSquad > 0
    ? teamPurses.filter((t) => t.playersBought + t.retainedCount >= maxSquad).length
    : 0;

  const totalBudgetSpent = teamPurses.reduce((s, t) => s + t.purseUsed, 0);
  const totalBudgetRemaining = teamPurses.reduce((s, t) => s + t.purseRemaining, 0);

  const sortedByRemaining = [...teamPurses].sort((a, b) => b.purseRemaining - a.purseRemaining);
  const sortedBySpent = [...teamPurses].sort((a, b) => b.purseUsed - a.purseUsed);

  const highestRemainingBudgetTeam = sortedByRemaining[0]
    ? { teamName: sortedByRemaining[0].teamName, remaining: sortedByRemaining[0].purseRemaining }
    : null;

  const lowestRemainingBudgetTeam = sortedByRemaining.length > 0
    ? {
        teamName: sortedByRemaining[sortedByRemaining.length - 1]!.teamName,
        remaining: sortedByRemaining[sortedByRemaining.length - 1]!.purseRemaining,
      }
    : null;

  const topSpender = sortedBySpent[0] && sortedBySpent[0].purseUsed > 0
    ? { teamName: sortedBySpent[0].teamName, spent: sortedBySpent[0].purseUsed }
    : null;

  const players = await db
    .select({
      status: playersTable.status,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  const soldPlayers = players.filter((p) => p.status === "sold").length;
  const unsoldPlayers = players.filter((p) => p.status === "unsold").length;
  const availablePlayers = players.filter((p) => p.status === "available").length;

  const [
    highestBidResult,
    bargainResult,
    multiplierResult,
    hottestResult,
    lastSalesResult,
    recentEventsResult,
  ] = await Promise.all([
    pool.query(
      `SELECT p.name AS player_name, p.sold_price AS amount, t.name AS team_name
       FROM players p
       LEFT JOIN teams t ON t.id = p.team_id
       WHERE p.tournament_id = $1 AND p.status = 'sold' AND p.sold_price IS NOT NULL
       ORDER BY p.sold_price DESC LIMIT 1`,
      [tournamentId],
    ),
    pool.query(
      `SELECT player_name, final_amount AS sold_price, base_price,
              ROUND(final_amount::numeric / NULLIF(base_price, 0), 2) AS multiplier
       FROM auction_player_events
       WHERE tournament_id = $1 AND outcome = 'sold'
         AND final_amount IS NOT NULL AND base_price IS NOT NULL AND base_price > 0
       ORDER BY (final_amount::numeric / base_price) ASC LIMIT 1`,
      [tournamentId],
    ),
    pool.query(
      `SELECT player_name, final_amount AS sold_price, base_price,
              ROUND(final_amount::numeric / NULLIF(base_price, 0), 2) AS multiplier
       FROM auction_player_events
       WHERE tournament_id = $1 AND outcome = 'sold'
         AND final_amount IS NOT NULL AND base_price IS NOT NULL AND base_price > 0
       ORDER BY (final_amount::numeric / base_price) DESC LIMIT 1`,
      [tournamentId],
    ),
    pool.query(
      `SELECT MIN(ape.player_name) AS player_name, COUNT(*)::int AS bid_count
       FROM auction_bid_events abe
       LEFT JOIN auction_player_events ape
         ON abe.player_id = ape.player_id AND abe.tournament_id = ape.tournament_id
       WHERE abe.tournament_id = $1
       GROUP BY abe.player_id
       ORDER BY bid_count DESC LIMIT 1`,
      [tournamentId],
    ),
    pool.query(
      `SELECT player_name, sold_to_team_name AS team_name, final_amount AS amount
       FROM auction_player_events
       WHERE tournament_id = $1 AND outcome = 'sold' AND final_amount IS NOT NULL
       ORDER BY auction_ended_at DESC NULLS LAST, id DESC LIMIT 5`,
      [tournamentId],
    ),
    pool.query(
      `SELECT outcome AS event,
              player_name || ' → ' || COALESCE(sold_to_team_name, 'Unsold') AS detail
       FROM auction_player_events
       WHERE tournament_id = $1 AND outcome IN ('sold', 'unsold') AND auction_ended_at IS NOT NULL
       ORDER BY auction_ended_at DESC NULLS LAST LIMIT 5`,
      [tournamentId],
    ),
  ]);

  const highestBidRow = highestBidResult.rows[0];
  const bargainRow = bargainResult.rows[0];
  const multiplierRow = multiplierResult.rows[0];
  const hottestRow = hottestResult.rows[0];

  const avgResult = await pool.query(
    `SELECT ROUND(AVG(sold_price))::int AS avg_price
     FROM players WHERE tournament_id = $1 AND status = 'sold' AND sold_price IS NOT NULL`,
    [tournamentId],
  );

  const recentAuctionEvents = recentEventsResult.rows.map((r: { event: string; detail: string }) => ({
    event: r.event,
    detail: r.detail,
  }));

  if (session?.lastAction && recentAuctionEvents.length === 0) {
    recentAuctionEvents.push({ event: "status", detail: session.lastAction });
  }

  return {
    tournamentName: tournament.name,
    sport: tournament.sport,
    tournamentPhase: mapTournamentPhase(tournament.status),
    auctionStatus: mapAuctionStatus(session?.status, session?.isBreak ?? false),

    totalTeams: teamPurses.length,
    completedTeams,

    totalPlayers: players.length,
    soldPlayers,
    unsoldPlayers,
    availablePlayers,

    highestBid: highestBidRow
      ? {
          playerName: highestBidRow.player_name,
          amount: highestBidRow.amount,
          teamName: highestBidRow.team_name ?? "Unknown",
        }
      : null,

    highestRemainingBudgetTeam,
    lowestRemainingBudgetTeam,

    totalBudgetSpent,
    totalBudgetRemaining,

    topSpender,
    biggestBargain: bargainRow
      ? {
          playerName: bargainRow.player_name,
          soldPrice: bargainRow.sold_price,
          basePrice: bargainRow.base_price,
          multiplier: Number(bargainRow.multiplier),
        }
      : null,
    highestBidMultiplier: multiplierRow
      ? {
          playerName: multiplierRow.player_name,
          multiplier: Number(multiplierRow.multiplier),
          soldPrice: multiplierRow.sold_price,
        }
      : null,
    hottestPlayer: hottestRow?.player_name
      ? { playerName: hottestRow.player_name, bidCount: hottestRow.bid_count }
      : null,

    averagePlayerPrice: avgResult.rows[0]?.avg_price ?? 0,

    lastFewSales: lastSalesResult.rows.map((r: { player_name: string; team_name: string; amount: number }) => ({
      playerName: r.player_name,
      teamName: r.team_name ?? "Unknown",
      amount: r.amount,
    })),
    recentAuctionEvents,
  };
}

export function isLiveAuctionSummary(summary: TournamentInsightsSummary): boolean {
  return (
    summary.tournamentPhase === "active" &&
    (summary.auctionStatus === "active" || summary.auctionStatus === "break")
  );
}
