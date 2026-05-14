import { Router } from "express";
import { pool } from "@workspace/db";
import { teamsTable, tournamentsTable } from "@workspace/db";
import { db } from "@workspace/db";

const router = Router();

// ─── Tournament list ──────────────────────────────────────────────────────────

router.get("/intelligence/tournaments", async (_req, res) => {
  const rows = await db.select({
    id: tournamentsTable.id,
    name: tournamentsTable.name,
    sport: tournamentsTable.sport,
    status: tournamentsTable.status,
  }).from(tournamentsTable).orderBy(tournamentsTable.id);
  res.json(rows);
});

// ─── Tournament Overview ──────────────────────────────────────────────────────

router.get("/intelligence/tournament/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [bidStatsResult, hottestResult, fastestTeamResult, inflationResult, outcomeResult] =
    await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_bids,
                AVG(milliseconds_since_last_bid)
                  FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
         FROM auction_bid_events WHERE tournament_id = $1`, [tid],
      ),
      pool.query(
        `SELECT abe.player_id, MIN(ape.player_name) AS player_name, COUNT(*)::int AS bid_count
         FROM auction_bid_events abe
         LEFT JOIN auction_player_events ape
           ON abe.player_id = ape.player_id AND abe.tournament_id = ape.tournament_id
          AND ape.outcome != 'in_progress'
         WHERE abe.tournament_id = $1
         GROUP BY abe.player_id ORDER BY bid_count DESC LIMIT 1`, [tid],
      ),
      pool.query(
        `SELECT abe.team_id, t.name AS team_name, t.color AS team_color,
                AVG(abe.milliseconds_since_last_bid)::int AS avg_response_ms,
                COUNT(*)::int AS total_bids
         FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
         WHERE abe.tournament_id = $1 AND abe.milliseconds_since_last_bid IS NOT NULL
         GROUP BY abe.team_id, t.name, t.color
         ORDER BY avg_response_ms ASC LIMIT 1`, [tid],
      ),
      pool.query(
        `SELECT player_name, final_amount, base_price,
                ROUND((final_amount::numeric / NULLIF(base_price,0) - 1) * 100)::int AS inflation_pct,
                sold_to_team_name
         FROM auction_player_events
         WHERE tournament_id = $1 AND outcome = 'sold'
           AND final_amount IS NOT NULL AND base_price IS NOT NULL AND base_price > 0
         ORDER BY (final_amount::numeric / NULLIF(base_price,0)) DESC LIMIT 1`, [tid],
      ),
      pool.query(
        `SELECT outcome, COUNT(*)::int AS cnt
         FROM auction_player_events
         WHERE tournament_id = $1 AND outcome != 'in_progress'
         GROUP BY outcome`, [tid],
      ),
    ]);

  const outcomes: Record<string, number> = {};
  for (const row of outcomeResult.rows) outcomes[row.outcome] = row.cnt;
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

// ─── Replay Timeline ──────────────────────────────────────────────────────────

router.get("/intelligence/replay/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const limit = Math.min(parseInt((req.query.limit as string) ?? "400"), 600);

  const { rows } = await pool.query(
    `SELECT event_type, timestamp, player_id, player_name, team_id, team_name,
            team_color, short_code, bid_amount, bid_sequence_number,
            milliseconds_since_last_bid, outcome, category_name
     FROM (
       SELECT
         'bid'                              AS event_type,
         abe.timestamp,
         abe.player_id,
         COALESCE(ape.player_name, '?')    AS player_name,
         abe.team_id,
         t.name                            AS team_name,
         t.color                           AS team_color,
         t.short_code,
         abe.bid_amount,
         abe.bid_sequence_number,
         abe.milliseconds_since_last_bid,
         NULL::text                        AS outcome,
         NULL::text                        AS category_name
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name
         FROM auction_player_events
         ORDER BY player_id, tournament_id, id ASC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       WHERE abe.tournament_id = $1

       UNION ALL

       SELECT
         CASE WHEN ape.outcome = 'in_progress' THEN 'player_start'
              ELSE 'player_' || ape.outcome
         END                               AS event_type,
         ape.timestamp,
         ape.player_id,
         ape.player_name,
         ape.sold_to_team_id              AS team_id,
         ape.sold_to_team_name            AS team_name,
         NULL::text                       AS team_color,
         NULL::text                       AS short_code,
         ape.final_amount                 AS bid_amount,
         NULL::int                        AS bid_sequence_number,
         NULL::int                        AS milliseconds_since_last_bid,
         ape.outcome,
         c.name                           AS category_name
       FROM auction_player_events ape
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE ape.tournament_id = $1
     ) ev
     ORDER BY timestamp ASC
     LIMIT $2`,
    [tid, limit],
  );

  res.json(rows);
});

// ─── Player Demand Analytics ──────────────────────────────────────────────────

router.get("/intelligence/demand/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { rows } = await pool.query(
    `SELECT
       player_id, player_name, player_role, base_price, final_amount, outcome,
       COALESCE(total_bids_received, 0)::int                              AS total_bids,
       COALESCE(interested_teams_count, 0)::int                           AS competition_score,
       COALESCE(auction_duration_seconds, 0)::int                         AS duration_secs,
       COALESCE(average_secs_between_bids, 0)::int                        AS avg_secs_between,
       CASE WHEN base_price > 0 AND final_amount IS NOT NULL
            THEN ROUND((final_amount::numeric / base_price - 1) * 100)::int
            ELSE NULL
       END AS inflation_pct,
       ROUND((
         COALESCE(total_bids_received, 0)::numeric         * 0.40 +
         COALESCE(interested_teams_count, 0)::numeric       * 3.00 +
         CASE WHEN base_price > 0 AND final_amount IS NOT NULL
              THEN LEAST((final_amount::numeric / base_price) * 5, 50)
              ELSE 0
         END
       )::numeric, 1) AS demand_score
     FROM auction_player_events
     WHERE tournament_id = $1 AND outcome IN ('sold','unsold','deferred')
     ORDER BY demand_score DESC
     LIMIT 60`,
    [tid],
  );

  res.json(rows);
});

// ─── Team Behavior Profiles ───────────────────────────────────────────────────

router.get("/intelligence/behavior/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [teamRows, categoryRows] = await Promise.all([
    pool.query(
      `SELECT
         abe.team_id,
         t.name AS team_name, t.color AS team_color, t.short_code,
         t.purse, t.purse_used,
         COUNT(*)::int                                                     AS total_bids,
         COUNT(DISTINCT abe.player_id)::int                                AS unique_players,
         AVG(abe.milliseconds_since_last_bid)
           FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms,
         MIN(abe.milliseconds_since_last_bid)
           FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int AS min_response_ms,
         COUNT(*) FILTER (WHERE abe.bid_sequence_number <= 2)::int         AS opening_bids,
         COUNT(*) FILTER (WHERE abe.bid_sequence_number > 5)::int          AS late_bids
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE abe.tournament_id = $1
       GROUP BY abe.team_id, t.name, t.color, t.short_code, t.purse, t.purse_used
       ORDER BY total_bids DESC`,
      [tid],
    ),
    pool.query(
      `SELECT abe.team_id, c.name AS cat_name, c.color_code,
              COUNT(*)::int AS cat_bids
       FROM auction_bid_events abe
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, category_id
         FROM auction_player_events WHERE outcome != 'in_progress'
         ORDER BY player_id, tournament_id, id DESC
       ) ape ON ape.player_id = abe.player_id AND abe.tournament_id = $1
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE abe.tournament_id = $1 AND c.name IS NOT NULL
       GROUP BY abe.team_id, c.name, c.color_code
       ORDER BY cat_bids DESC`,
      [tid],
    ),
  ]);

  // Group categories by team
  const catsByTeam: Record<number, Array<{ cat_name: string; color_code: string | null; cat_bids: number }>> = {};
  for (const r of categoryRows.rows) {
    if (!catsByTeam[r.team_id]) catsByTeam[r.team_id] = [];
    catsByTeam[r.team_id]!.push(r);
  }

  const profiles = teamRows.rows.map(row => {
    const cats = catsByTeam[row.team_id] ?? [];
    const totalCatBids = cats.reduce((s: number, c: { cat_bids: number }) => s + c.cat_bids, 0);
    const topCat = cats[0] ?? null;
    const catConcentration = totalCatBids > 0 && topCat ? topCat.cat_bids / totalCatBids : 0;
    const bidsPerPlayer = row.unique_players > 0 ? row.total_bids / row.unique_players : 0;
    const purseUsedPct = row.purse > 0 ? row.purse_used / row.purse : 0;
    const openingRatio = row.total_bids > 0 ? row.opening_bids / row.total_bids : 0;
    const lateRatio = row.total_bids > 0 ? row.late_bids / row.total_bids : 0;

    const labels: string[] = [];
    const avgMs: number | null = row.avg_response_ms;
    if (avgMs !== null) {
      if (avgMs < 2500) labels.push("Aggressive");
      else if (avgMs > 9000) labels.push("Patient");
      else labels.push("Strategic");
    }
    if (bidsPerPlayer >= 4.5) labels.push("Persistent");
    else if (row.unique_players > 0 && bidsPerPlayer < 1.8) labels.push("Selective");
    if (openingRatio > 0.55) labels.push("Early Aggressor");
    if (lateRatio > 0.45) labels.push("Late Specialist");
    if (catConcentration > 0.72 && topCat) labels.push(`${topCat.cat_name} Hunter`);
    if (purseUsedPct > 0.60) labels.push("High Spender");
    else if (purseUsedPct < 0.20 && row.total_bids > 5) labels.push("Purse Conserver");

    return {
      ...row,
      purse_used_pct: Math.round(purseUsedPct * 100),
      bids_per_player: Math.round(bidsPerPlayer * 10) / 10,
      category_focus: cats.slice(0, 3),
      top_category: topCat,
      cat_concentration: Math.round(catConcentration * 100),
      behavior_labels: labels,
    };
  });

  res.json(profiles);
});

// ─── Observation Notes (rule-based) ──────────────────────────────────────────

router.get("/intelligence/observations/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [catStats, roleStats, speedStats, inflationStats, unsoldStats, bidTiming, teamConc] =
    await Promise.all([
      pool.query(
        `SELECT c.name, AVG(ape.total_bids_received)::numeric(6,1) AS avg_bids,
                COUNT(*)::int AS player_count
         FROM auction_player_events ape
         LEFT JOIN categories c ON c.id = ape.category_id
         WHERE ape.tournament_id = $1 AND ape.outcome IN ('sold','unsold','deferred')
           AND c.name IS NOT NULL
         GROUP BY c.name ORDER BY avg_bids DESC`, [tid],
      ),
      pool.query(
        `SELECT player_role, AVG(total_bids_received)::numeric(6,1) AS avg_bids,
                COUNT(*)::int AS count
         FROM auction_player_events
         WHERE tournament_id = $1 AND outcome IN ('sold','unsold','deferred')
           AND player_role IS NOT NULL AND total_bids_received IS NOT NULL
         GROUP BY player_role ORDER BY avg_bids DESC LIMIT 3`, [tid],
      ),
      pool.query(
        `SELECT
           AVG(milliseconds_since_last_bid)
             FILTER (WHERE bid_sequence_number <= 2)::int AS early_avg_ms,
           AVG(milliseconds_since_last_bid)
             FILTER (WHERE bid_sequence_number > 5)::int AS late_avg_ms,
           COUNT(*)::int AS total_bids
         FROM auction_bid_events
         WHERE tournament_id = $1 AND milliseconds_since_last_bid IS NOT NULL`, [tid],
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE final_amount > base_price * 3 AND outcome = 'sold')::int AS high_inflation,
           COUNT(*) FILTER (WHERE outcome = 'sold')::int AS total_sold,
           MAX(final_amount) AS max_sold,
           AVG(final_amount) FILTER (WHERE outcome = 'sold')::int AS avg_sold
         FROM auction_player_events
         WHERE tournament_id = $1 AND base_price > 0`, [tid],
      ),
      pool.query(
        `SELECT player_role, COUNT(*)::int AS unsold_count,
                COUNT(*) FILTER (WHERE outcome = 'sold')::int AS sold_count
         FROM auction_player_events
         WHERE tournament_id = $1 AND player_role IS NOT NULL
         GROUP BY player_role
         HAVING COUNT(*) FILTER (WHERE outcome = 'unsold') > 0
         ORDER BY unsold_count DESC LIMIT 1`, [tid],
      ),
      pool.query(
        `SELECT COUNT(DISTINCT player_id)::int AS players_with_wars
         FROM (
           SELECT player_id
           FROM auction_bid_events
           WHERE tournament_id = $1
           GROUP BY player_id
           HAVING COUNT(DISTINCT team_id) >= 3
         ) x`, [tid],
      ),
      pool.query(
        `SELECT t.name AS team_name,
                COUNT(*)::int AS bids,
                ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100)::int AS share_pct
         FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
         WHERE abe.tournament_id = $1
         GROUP BY t.name ORDER BY bids DESC LIMIT 2`, [tid],
      ),
    ]);

  const notes: Array<{ type: string; headline: string; detail: string }> = [];

  // Category demand
  if (catStats.rows.length > 0) {
    const top = catStats.rows[0];
    const bottom = catStats.rows[catStats.rows.length - 1];
    notes.push({
      type: "pattern",
      headline: `${top.name} players generated the highest competition`,
      detail: `Average of ${parseFloat(top.avg_bids).toFixed(1)} bids per ${top.name} player — ` +
        (catStats.rows.length > 1 ? `${Math.round((top.avg_bids / Math.max(bottom.avg_bids, 1)) * 10) / 10}x more than ${bottom.name}.` : "the most contested category."),
    });
  }

  // Role demand
  if (roleStats.rows.length > 0) {
    const topRole = roleStats.rows[0];
    notes.push({
      type: "insight",
      headline: `${topRole.player_role} attracted the most bidding interest`,
      detail: `Averaging ${parseFloat(topRole.avg_bids).toFixed(1)} bids per player across ${topRole.count} ${topRole.player_role.toLowerCase()} slots.`,
    });
  }

  // Speed pattern
  const sp = speedStats.rows[0];
  if (sp && sp.early_avg_ms && sp.late_avg_ms && sp.total_bids > 10) {
    const ratio = Math.round(sp.late_avg_ms / Math.max(sp.early_avg_ms, 1));
    notes.push({
      type: "strategy",
      headline: `Teams react ${ratio}x slower in extended bidding`,
      detail: `Opening bids averaged ${Math.round(sp.early_avg_ms / 1000 * 10) / 10}s response vs ${Math.round(sp.late_avg_ms / 1000 * 10) / 10}s after the 5th bid — indicating deliberation fatigue.`,
    });
  }

  // Inflation
  const inf = inflationStats.rows[0];
  if (inf && inf.total_sold > 0) {
    const pct = Math.round((inf.high_inflation / inf.total_sold) * 100);
    if (pct > 0) {
      notes.push({
        type: "insight",
        headline: `${pct}% of sold players went above 3× their base price`,
        detail: `Strong demand signals in premium slots. Average sale price: ${inf.avg_sold ? `₹${(inf.avg_sold / 100000).toFixed(1)}L` : "—"}.`,
      });
    }
  }

  // Unsold role
  if (unsoldStats.rows.length > 0) {
    const u = unsoldStats.rows[0];
    if (u.unsold_count > 0) {
      notes.push({
        type: "warning",
        headline: `${u.player_role} positions had the highest unsold rate`,
        detail: `${u.unsold_count} ${u.player_role.toLowerCase()} players went unsold — suggesting oversupply or price mismatch relative to team budgets.`,
      });
    }
  }

  // Bid wars
  const wars = bidTiming.rows[0];
  const bwCount = bidTiming.rows[0]?.players_with_wars;
  if (bidTiming.rows[0]) {
    const bw = bidTiming.rows;
    void bw;
  }
  if (teamConc.rows.length > 0 && bidTiming.rows[0]?.total_bids > 5) {
    const top2 = teamConc.rows.slice(0, 2);
    const combined = top2.reduce((s: number, r: { share_pct: number }) => s + r.share_pct, 0);
    if (combined > 55) {
      notes.push({
        type: "strategy",
        headline: `Bidding dominated by ${top2.map((r: { team_name: string }) => r.team_name).join(" & ")}`,
        detail: `Together they placed ${combined}% of all bids — the auction was largely a two-team contest.`,
      });
    }
  }

  // Bid war count observation
  const bwRow = bidTiming.rows[0];
  void bwRow; void wars;
  const bwCountRow = bidTiming.rows[0];
  void bwCountRow;
  const twoTeamWars = bidTiming.rows.length;
  void twoTeamWars;

  // Three-team competition
  if (bidTiming.rows[0]?.total_bids > 0) {
    const threeWay = bidTiming.rows[0];
    void threeWay;
  }

  // players_with_wars observation
  if (bidTiming.rows.length > 0 && bwCount === undefined) {
    const playersWithWarsRow = await pool.query(
      `SELECT COUNT(DISTINCT player_id)::int AS cnt
       FROM (
         SELECT player_id FROM auction_bid_events WHERE tournament_id = $1
         GROUP BY player_id HAVING COUNT(DISTINCT team_id) >= 3
       ) x`, [tid],
    );
    const warsCount = playersWithWarsRow.rows[0]?.cnt ?? 0;
    if (warsCount > 0) {
      notes.push({
        type: "pattern",
        headline: `${warsCount} player${warsCount !== 1 ? "s" : ""} triggered multi-team bid wars`,
        detail: `3 or more teams competed simultaneously on these players — the most contested slots of the tournament.`,
      });
    }
  }

  res.json(notes.length > 0 ? notes : [
    {
      type: "insight",
      headline: "Insufficient data to generate observations",
      detail: "Run at least one complete auction session to unlock behavioral intelligence.",
    },
  ]);
});

// ─── Event Explorer ───────────────────────────────────────────────────────────

router.get("/intelligence/events", async (req, res) => {
  const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : null;
  const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : null;
  const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : null;
  const eventType = (req.query.eventType as string) || null; // 'bid' | 'player'
  const offset = Math.max(parseInt((req.query.offset as string) ?? "0"), 0);
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50"), 100);

  const bidConds: string[] = [];
  const playerConds: string[] = [];
  const bidParams: unknown[] = [];
  const playerParams: unknown[] = [];

  // Build conditions separately for bid and player event tables
  let bidIdx = 1;
  let playerIdx = 1;

  if (tournamentId) {
    bidConds.push(`tournament_id = $${bidIdx++}`); bidParams.push(tournamentId);
    playerConds.push(`tournament_id = $${playerIdx++}`); playerParams.push(tournamentId);
  }
  if (teamId) {
    bidConds.push(`team_id = $${bidIdx++}`); bidParams.push(teamId);
  }
  if (playerId) {
    bidConds.push(`player_id = $${bidIdx++}`); bidParams.push(playerId);
    playerConds.push(`player_id = $${playerIdx++}`); playerParams.push(playerId);
  }

  const bidWhere = bidConds.length ? `WHERE ${bidConds.join(" AND ")}` : "";
  const playerWhere = playerConds.length ? `WHERE ${playerConds.join(" AND ")}` : "";

  // Conditionally include bid and player event tables based on eventType filter
  const includeBid = !eventType || eventType === "bid";
  const includePlayer = !eventType || eventType === "player";

  let parts: string[] = [];
  const mergedParams: unknown[] = [];

  if (includeBid) {
    parts.push(`
      SELECT
        'bid'                                    AS event_type,
        abe.id, abe.timestamp,
        abe.player_id,
        COALESCE(ape.player_name, '?')           AS player_name,
        abe.team_id,
        t.name                                   AS team_name,
        t.color                                  AS team_color,
        abe.bid_amount                           AS amount,
        abe.bid_sequence_number,
        abe.milliseconds_since_last_bid          AS latency_ms,
        NULL::text                               AS outcome,
        abe.tournament_id
      FROM auction_bid_events abe
      LEFT JOIN teams t ON t.id = abe.team_id
      LEFT JOIN (
        SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name
        FROM auction_player_events ORDER BY player_id, tournament_id, id ASC
      ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
      ${bidWhere}
    `);
    mergedParams.push(...bidParams);
  }

  if (includePlayer) {
    const offset2 = mergedParams.length;
    const reindexedConds = playerConds.map((c, i) => c.replace(`$${i + 1}`, `$${offset2 + i + 1}`));
    const reindexedWhere = reindexedConds.length ? `WHERE ${reindexedConds.join(" AND ")} AND outcome != 'in_progress'` : "WHERE outcome != 'in_progress'";
    parts.push(`
      SELECT
        'player_' || outcome                     AS event_type,
        id, timestamp,
        player_id, player_name,
        sold_to_team_id                          AS team_id,
        sold_to_team_name                        AS team_name,
        NULL::text                               AS team_color,
        final_amount                             AS amount,
        NULL::int                                AS bid_sequence_number,
        NULL::int                                AS latency_ms,
        outcome,
        tournament_id
      FROM auction_player_events
      ${reindexedWhere}
    `);
    mergedParams.push(...playerParams);
  }

  if (parts.length === 0) {
    res.json({ events: [], total: 0 });
    return;
  }

  const union = parts.join(" UNION ALL ");
  const countIdx = mergedParams.length + 1;
  const limitIdx = mergedParams.length + 2;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM (${union}) ev ORDER BY timestamp DESC LIMIT $${limitIdx} OFFSET $${countIdx}`,
      [...mergedParams, offset, limit],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM (${union}) ev`,
      mergedParams,
    ),
  ]);

  res.json({
    events: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
  });
});

// ─── Player Search ────────────────────────────────────────────────────────────

router.get("/intelligence/players/search", async (req, res) => {
  const q = `%${(req.query.q as string) ?? ""}%`;
  const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : null;

  const base = `
    SELECT player_id,
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
  `;
  if (tournamentId && !isNaN(tournamentId)) {
    const { rows } = await pool.query(
      `${base} AND tournament_id = $2
       GROUP BY player_id
       ORDER BY total_auctions DESC, avg_sold_value DESC NULLS LAST LIMIT 30`,
      [q, tournamentId],
    );
    res.json(rows);
  } else {
    const { rows } = await pool.query(
      `${base} GROUP BY player_id ORDER BY total_auctions DESC, avg_sold_value DESC NULLS LAST LIMIT 30`,
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
       WHERE ape.player_id = $1 AND ape.outcome != 'in_progress'
       ORDER BY ape.timestamp DESC`, [pid],
    ),
    pool.query(
      `SELECT abe.bid_amount, abe.bid_sequence_number,
              abe.milliseconds_since_last_bid, abe.timer_remaining_seconds,
              abe.timestamp, abe.tournament_id,
              t.name AS team_name, t.color AS team_color, t.short_code
       FROM auction_bid_events abe
       LEFT JOIN teams t ON t.id = abe.team_id
       WHERE abe.player_id = $1
       ORDER BY abe.timestamp DESC LIMIT 100`, [pid],
    ),
    pool.query(
      `SELECT t.name AS team_name, t.color AS team_color, COUNT(*)::int AS bid_count
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE abe.player_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY bid_count DESC`, [pid],
    ),
  ]);

  res.json({
    auctions: auctionsResult.rows,
    bidTimeline: bidTimelineResult.rows,
    interestedTeams: interestedTeamsResult.rows,
  });
});

// ─── Team list ────────────────────────────────────────────────────────────────

router.get("/intelligence/teams", async (req, res) => {
  const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : null;

  if (tournamentId && !isNaN(tournamentId)) {
    const { rows } = await pool.query(
      `SELECT abe.team_id, t.name AS team_name, t.color AS team_color,
              t.short_code, t.owner_name,
              COUNT(*)::int                                                              AS total_bids,
              AVG(abe.milliseconds_since_last_bid)
                FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int         AS avg_response_ms,
              COUNT(DISTINCT abe.player_id)::int                                        AS unique_players_bid
       FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
       WHERE abe.tournament_id = $1
       GROUP BY abe.team_id, t.name, t.color, t.short_code, t.owner_name
       ORDER BY total_bids DESC`,
      [tournamentId],
    );
    res.json(rows);
  } else {
    const { rows } = await pool.query(
      `SELECT abe.team_id, t.name AS team_name, t.color AS team_color, t.short_code,
              COUNT(*)::int AS total_bids, COUNT(DISTINCT abe.tournament_id)::int AS tournaments_participated
       FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
       GROUP BY abe.team_id, t.name, t.color, t.short_code
       ORDER BY total_bids DESC`, [],
    );
    res.json(rows);
  }
});

// ─── Team Intelligence ────────────────────────────────────────────────────────

router.get("/intelligence/team/:teamId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : null;
  const hasTid = tournamentId && !isNaN(tournamentId);
  const tidParam = hasTid ? [teamId, tournamentId] : [teamId];
  const tidClause = hasTid ? "AND abe.tournament_id = $2" : "";

  const [bidStatsResult, categoryResult, aggressionResult, recentResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_bids,
              AVG(milliseconds_since_last_bid) FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms,
              MIN(milliseconds_since_last_bid) FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS fastest_response_ms,
              COUNT(DISTINCT tournament_id)::int AS tournaments_active,
              COUNT(DISTINCT player_id)::int AS unique_players_bid
       FROM auction_bid_events abe WHERE abe.team_id = $1 ${tidClause}`,
      tidParam,
    ),
    pool.query(
      `SELECT ape.category_id, c.name AS category_name, c.color_code,
              COUNT(*)::int AS bid_count, COUNT(DISTINCT abe.player_id)::int AS players_contested
       FROM auction_bid_events abe
       LEFT JOIN auction_player_events ape
         ON abe.player_id = ape.player_id AND abe.tournament_id = ape.tournament_id
        AND ape.outcome != 'in_progress'
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE abe.team_id = $1 ${tidClause} AND ape.category_id IS NOT NULL
       GROUP BY ape.category_id, c.name, c.color_code
       ORDER BY bid_count DESC LIMIT 10`,
      tidParam,
    ),
    pool.query(
      `SELECT agg.player_id, agg.player_name, agg.team_bids, agg.total_bids,
              ROUND(agg.team_bids::numeric / NULLIF(agg.total_bids, 0) * 100)::int AS aggression_pct
       FROM (
         SELECT abe.player_id,
                MIN(ape.player_name) AS player_name,
                COUNT(*) FILTER (WHERE abe.team_id = $1)::int AS team_bids,
                COUNT(*)::int AS total_bids
         FROM auction_bid_events abe
         LEFT JOIN (
           SELECT DISTINCT ON (player_id) player_id, player_name
           FROM auction_player_events ORDER BY player_id, id ASC
         ) ape ON ape.player_id = abe.player_id
         WHERE TRUE ${tidClause.replace("abe.tournament_id", "abe.tournament_id")}
         GROUP BY abe.player_id
       ) agg
       WHERE agg.team_bids > 0
       ORDER BY aggression_pct DESC, team_bids DESC LIMIT 5`,
      tidParam,
    ),
    pool.query(
      `SELECT abe.player_id, abe.bid_amount, abe.timestamp,
              abe.milliseconds_since_last_bid,
              ape.player_name, ape.outcome, tor.name AS tournament_name
       FROM auction_bid_events abe
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name, outcome
         FROM auction_player_events WHERE outcome != 'in_progress'
         ORDER BY player_id, tournament_id, id DESC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       LEFT JOIN tournaments tor ON tor.id = abe.tournament_id
       WHERE abe.team_id = $1 ${tidClause}
       ORDER BY abe.timestamp DESC LIMIT 20`,
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
