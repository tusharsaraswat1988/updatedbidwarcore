import { Router } from "express";
import { pool } from "@workspace/db";
import { teamsTable, categoriesTable, tournamentsTable } from "@workspace/db";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Tournament list (for dropdowns) ─────────────────────────────────────────

router.get("/intelligence/tournaments", async (req, res) => {
  const rows = await db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      status: tournamentsTable.status,
    })
    .from(tournamentsTable)
    .orderBy(tournamentsTable.id);
  res.json(rows);
});

// ─── Tournament Intelligence ──────────────────────────────────────────────────

router.get("/intelligence/tournament/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [bidStatsResult, hottestResult, fastestTeamResult, inflationResult, outcomeResult] =
    await Promise.all([
      pool.query(
        `SELECT
          COUNT(*)::int AS total_bids,
          AVG(milliseconds_since_last_bid)
            FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
         FROM auction_bid_events
         WHERE tournament_id = $1`,
        [tid],
      ),
      pool.query(
        `SELECT abe.player_id, MIN(ape.player_name) AS player_name,
                COUNT(*)::int AS bid_count
         FROM auction_bid_events abe
         LEFT JOIN auction_player_events ape
           ON abe.player_id = ape.player_id
          AND abe.tournament_id = ape.tournament_id
          AND ape.outcome != 'in_progress'
         WHERE abe.tournament_id = $1
         GROUP BY abe.player_id
         ORDER BY bid_count DESC
         LIMIT 1`,
        [tid],
      ),
      pool.query(
        `SELECT abe.team_id, t.name AS team_name, t.color AS team_color,
                AVG(abe.milliseconds_since_last_bid)::int AS avg_response_ms,
                COUNT(*)::int AS total_bids
         FROM auction_bid_events abe
         JOIN teams t ON t.id = abe.team_id
         WHERE abe.tournament_id = $1
           AND abe.milliseconds_since_last_bid IS NOT NULL
         GROUP BY abe.team_id, t.name, t.color
         ORDER BY avg_response_ms ASC
         LIMIT 1`,
        [tid],
      ),
      pool.query(
        `SELECT player_name, final_amount, base_price,
                ROUND((final_amount::numeric / NULLIF(base_price, 0) - 1) * 100)::int AS inflation_pct,
                sold_to_team_name
         FROM auction_player_events
         WHERE tournament_id = $1
           AND outcome = 'sold'
           AND final_amount IS NOT NULL
           AND base_price IS NOT NULL
           AND base_price > 0
         ORDER BY (final_amount::numeric / NULLIF(base_price, 0)) DESC
         LIMIT 1`,
        [tid],
      ),
      pool.query(
        `SELECT outcome, COUNT(*)::int AS cnt
         FROM auction_player_events
         WHERE tournament_id = $1
           AND outcome != 'in_progress'
         GROUP BY outcome`,
        [tid],
      ),
    ]);

  const outcomes: Record<string, number> = {};
  for (const row of outcomeResult.rows) {
    outcomes[row.outcome] = row.cnt;
  }
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0) || 1;

  res.json({
    totalBids: bidStatsResult.rows[0]?.total_bids ?? 0,
    avgResponseMs: bidStatsResult.rows[0]?.avg_response_ms ?? null,
    hottestPlayer: hottestResult.rows[0] ?? null,
    fastestTeam: fastestTeamResult.rows[0] ?? null,
    biggestInflation: inflationResult.rows[0] ?? null,
    outcomes,
    soldPct: Math.round(((outcomes.sold ?? 0) / total) * 100),
    unsoldPct: Math.round(((outcomes.unsold ?? 0) / total) * 100),
    deferredPct: Math.round(((outcomes.deferred ?? 0) / total) * 100),
    totalConcluded: total,
  });
});

// ─── Player Search ────────────────────────────────────────────────────────────

router.get("/intelligence/players/search", async (req, res) => {
  const q = `%${(req.query.q as string) ?? ""}%`;
  const tournamentId = req.query.tournamentId
    ? parseInt(req.query.tournamentId as string)
    : null;

  if (tournamentId && !isNaN(tournamentId)) {
    const { rows } = await pool.query(
      `SELECT
          player_id,
          MIN(player_name)                                                           AS player_name,
          MIN(player_role)                                                           AS player_role,
          MIN(sport)                                                                 AS sport,
          COUNT(*) FILTER (WHERE outcome IN ('sold','unsold','deferred'))::int       AS total_auctions,
          AVG(final_amount) FILTER (WHERE outcome = 'sold')::int                    AS avg_sold_value,
          MAX(final_amount) FILTER (WHERE outcome = 'sold')::int                    AS max_sold_value,
          SUM(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS total_bids_received,
          AVG(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS avg_bids_per_auction,
          COUNT(DISTINCT tournament_id)::int                                         AS tournament_count
       FROM auction_player_events
       WHERE player_name ILIKE $1
         AND tournament_id = $2
       GROUP BY player_id
       ORDER BY total_auctions DESC, avg_sold_value DESC NULLS LAST
       LIMIT 30`,
      [q, tournamentId],
    );
    res.json(rows);
  } else {
    const { rows } = await pool.query(
      `SELECT
          player_id,
          MIN(player_name)                                                           AS player_name,
          MIN(player_role)                                                           AS player_role,
          MIN(sport)                                                                 AS sport,
          COUNT(*) FILTER (WHERE outcome IN ('sold','unsold','deferred'))::int       AS total_auctions,
          AVG(final_amount) FILTER (WHERE outcome = 'sold')::int                    AS avg_sold_value,
          MAX(final_amount) FILTER (WHERE outcome = 'sold')::int                    AS max_sold_value,
          SUM(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS total_bids_received,
          AVG(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS avg_bids_per_auction,
          COUNT(DISTINCT tournament_id)::int                                         AS tournament_count
       FROM auction_player_events
       WHERE player_name ILIKE $1
       GROUP BY player_id
       ORDER BY total_auctions DESC, avg_sold_value DESC NULLS LAST
       LIMIT 30`,
      [q],
    );
    res.json(rows);
  }
});

// ─── Player Detail ────────────────────────────────────────────────────────────

router.get("/intelligence/players/:playerId", async (req, res) => {
  const pid = parseInt(req.params.playerId);
  if (isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [auctionsResult, bidTimelineResult, interestedTeamsResult] = await Promise.all([
    pool.query(
      `SELECT ape.*, tor.name AS tournament_name, tor.sport AS tournament_sport
       FROM auction_player_events ape
       LEFT JOIN tournaments tor ON tor.id = ape.tournament_id
       WHERE ape.player_id = $1
         AND ape.outcome != 'in_progress'
       ORDER BY ape.timestamp DESC`,
      [pid],
    ),
    pool.query(
      `SELECT abe.bid_amount, abe.bid_sequence_number,
              abe.milliseconds_since_last_bid, abe.timer_remaining_seconds,
              abe.timestamp, abe.tournament_id,
              t.name AS team_name, t.color AS team_color, t.short_code
       FROM auction_bid_events abe
       LEFT JOIN teams t ON t.id = abe.team_id
       WHERE abe.player_id = $1
       ORDER BY abe.timestamp DESC
       LIMIT 100`,
      [pid],
    ),
    pool.query(
      `SELECT t.name AS team_name, t.color AS team_color, COUNT(*)::int AS bid_count
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE abe.player_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY bid_count DESC`,
      [pid],
    ),
  ]);

  res.json({
    auctions: auctionsResult.rows,
    bidTimeline: bidTimelineResult.rows,
    interestedTeams: interestedTeamsResult.rows,
  });
});

// ─── Team list for a tournament ───────────────────────────────────────────────

router.get("/intelligence/teams", async (req, res) => {
  const tournamentId = req.query.tournamentId
    ? parseInt(req.query.tournamentId as string)
    : null;

  if (tournamentId && !isNaN(tournamentId)) {
    const { rows } = await pool.query(
      `SELECT abe.team_id, t.name AS team_name, t.color AS team_color,
              t.short_code, t.owner_name,
              COUNT(*)::int                                                              AS total_bids,
              AVG(abe.milliseconds_since_last_bid)
                FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int         AS avg_response_ms,
              COUNT(DISTINCT abe.player_id)::int                                        AS unique_players_bid
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE abe.tournament_id = $1
       GROUP BY abe.team_id, t.name, t.color, t.short_code, t.owner_name
       ORDER BY total_bids DESC`,
      [tournamentId],
    );
    res.json(rows);
  } else {
    const { rows } = await pool.query(
      `SELECT abe.team_id, t.name AS team_name, t.color AS team_color, t.short_code,
              COUNT(*)::int                              AS total_bids,
              COUNT(DISTINCT abe.tournament_id)::int    AS tournaments_participated
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       GROUP BY abe.team_id, t.name, t.color, t.short_code
       ORDER BY total_bids DESC`,
      [],
    );
    res.json(rows);
  }
});

// ─── Team Intelligence ────────────────────────────────────────────────────────

router.get("/intelligence/team/:teamId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const tournamentId = req.query.tournamentId
    ? parseInt(req.query.tournamentId as string)
    : null;
  const hasTid = tournamentId && !isNaN(tournamentId);

  const tidParam = hasTid ? [teamId, tournamentId] : [teamId];
  const tidClause = hasTid ? "AND abe.tournament_id = $2" : "";

  const [bidStatsResult, categoryResult, aggressionResult, recentResult] = await Promise.all([
    pool.query(
      `SELECT
          COUNT(*)::int                                                                        AS total_bids,
          AVG(milliseconds_since_last_bid)
            FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int                       AS avg_response_ms,
          MIN(milliseconds_since_last_bid)
            FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int                       AS fastest_response_ms,
          COUNT(DISTINCT tournament_id)::int                                                  AS tournaments_active,
          COUNT(DISTINCT player_id)::int                                                      AS unique_players_bid
       FROM auction_bid_events abe
       WHERE abe.team_id = $1 ${tidClause}`,
      tidParam,
    ),
    pool.query(
      `SELECT
          ape.category_id, c.name AS category_name, c.color_code,
          COUNT(*)::int                      AS bid_count,
          COUNT(DISTINCT abe.player_id)::int AS players_contested
       FROM auction_bid_events abe
       LEFT JOIN auction_player_events ape
         ON abe.player_id = ape.player_id
        AND abe.tournament_id = ape.tournament_id
        AND ape.outcome != 'in_progress'
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE abe.team_id = $1 ${tidClause}
         AND ape.category_id IS NOT NULL
       GROUP BY ape.category_id, c.name, c.color_code
       ORDER BY bid_count DESC
       LIMIT 10`,
      tidParam,
    ),
    pool.query(
      `SELECT
          agg.player_id,
          agg.player_name,
          agg.team_bids,
          agg.total_bids,
          ROUND(agg.team_bids::numeric / NULLIF(agg.total_bids, 0) * 100)::int AS aggression_pct
       FROM (
         SELECT
           abe.player_id,
           MIN(ape.player_name)                                   AS player_name,
           COUNT(*) FILTER (WHERE abe.team_id = $1)::int         AS team_bids,
           COUNT(*)::int                                          AS total_bids
         FROM auction_bid_events abe
         LEFT JOIN (
           SELECT DISTINCT ON (player_id)
             player_id, player_name
           FROM auction_player_events
           ORDER BY player_id, id ASC
         ) ape ON ape.player_id = abe.player_id
         WHERE TRUE ${tidClause.replace("abe.tournament_id", "abe.tournament_id")}
         GROUP BY abe.player_id
       ) agg
       WHERE agg.team_bids > 0
       ORDER BY aggression_pct DESC, team_bids DESC
       LIMIT 5`,
      tidParam,
    ),
    pool.query(
      `SELECT abe.player_id, abe.bid_amount, abe.timestamp,
              abe.milliseconds_since_last_bid,
              ape.player_name, ape.outcome, tor.name AS tournament_name
       FROM auction_bid_events abe
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id)
           player_id, tournament_id, player_name, outcome
         FROM auction_player_events
         WHERE outcome != 'in_progress'
         ORDER BY player_id, tournament_id, id DESC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       LEFT JOIN tournaments tor ON tor.id = abe.tournament_id
       WHERE abe.team_id = $1 ${tidClause}
       ORDER BY abe.timestamp DESC
       LIMIT 20`,
      tidParam,
    ),
  ]);

  res.json({
    bidStats: bidStatsResult.rows[0] ?? null,
    categoryBreakdown: categoryResult.rows,
    aggressionHighlights: aggressionResult.rows,
    recentActivity: recentResult.rows,
  });
});

export default router;
