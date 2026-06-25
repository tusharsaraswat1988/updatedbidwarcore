import { Router } from "express";
import { pool } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { db } from "@workspace/db";
import { heavyLimiter } from "../lib/rate-limiters";
import { requireAdmin } from "../middleware/require-admin";
import {
  getCachedIntel,
  intelCacheKey,
  parseIntelFilters,
  type IntelFilterParams,
} from "../lib/intelligence-cache";
import { buildIntelligenceBriefing, type ObservationNote } from "../lib/intelligence-briefing";
import { writeIntelligenceCsv, type ExportDataset } from "../lib/intelligence-export";
import { intelligenceArchivesTable } from "@workspace/db";
import { desc, eq as drizzleEq } from "drizzle-orm";

const router = Router();
router.use(requireAdmin);

function bidEventFilters(filters: IntelFilterParams, paramStart: number): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = paramStart;
  if (filters.teamId != null) {
    clauses.push(`abe.team_id = $${idx++}`);
    params.push(filters.teamId);
  }
  if (filters.categoryId != null) {
    clauses.push(`EXISTS (
      SELECT 1 FROM auction_player_events ape_f
      WHERE ape_f.player_id = abe.player_id AND ape_f.tournament_id = abe.tournament_id
        AND ape_f.category_id = $${idx++}
    )`);
    params.push(filters.categoryId);
  }
  const sql = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
  return { sql, params };
}

function playerEventFilters(filters: IntelFilterParams, paramStart: number): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = paramStart;
  if (filters.categoryId != null) {
    clauses.push(`category_id = $${idx++}`);
    params.push(filters.categoryId);
  }
  if (filters.teamId != null) {
    clauses.push(`EXISTS (
      SELECT 1 FROM auction_bid_events abe_f
      WHERE abe_f.player_id = auction_player_events.player_id
        AND abe_f.tournament_id = auction_player_events.tournament_id
        AND abe_f.team_id = $${idx++}
    )`);
    params.push(filters.teamId);
  }
  const sql = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
  return { sql, params };
}

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
  const filters = parseIntelFilters(req.query as Record<string, unknown>);

  const payload = await getCachedIntel(intelCacheKey("overview", tid, filters), async () => {
    const bidF = bidEventFilters(filters, 2);
    const playerF = playerEventFilters(filters, 2);

    const [bidStatsResult, hottestResult, fastestTeamResult, inflationResult, outcomeResult] =
      await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS total_bids,
                  AVG(milliseconds_since_last_bid)
                    FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
           FROM auction_bid_events abe
           WHERE abe.tournament_id = $1${bidF.sql}`,
          [tid, ...bidF.params],
        ),
        pool.query(
          `SELECT abe.player_id, MIN(ape.player_name) AS player_name, COUNT(*)::int AS bid_count
           FROM auction_bid_events abe
           LEFT JOIN auction_player_events ape
             ON abe.player_id = ape.player_id AND abe.tournament_id = ape.tournament_id
            AND ape.outcome != 'in_progress'
           WHERE abe.tournament_id = $1${bidF.sql}
           GROUP BY abe.player_id ORDER BY bid_count DESC LIMIT 1`,
          [tid, ...bidF.params],
        ),
        pool.query(
          `SELECT abe.team_id, t.name AS team_name, t.color AS team_color,
                  AVG(abe.milliseconds_since_last_bid)::int AS avg_response_ms,
                  COUNT(*)::int AS total_bids
           FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
           WHERE abe.tournament_id = $1 AND abe.milliseconds_since_last_bid IS NOT NULL${bidF.sql}
           GROUP BY abe.team_id, t.name, t.color
           ORDER BY avg_response_ms ASC LIMIT 1`,
          [tid, ...bidF.params],
        ),
        pool.query(
          `SELECT player_name, final_amount, base_price,
                  ROUND((final_amount::numeric / NULLIF(base_price,0) - 1) * 100)::int AS inflation_pct,
                  sold_to_team_name
           FROM auction_player_events
           WHERE tournament_id = $1 AND outcome = 'sold'
             AND final_amount IS NOT NULL AND base_price IS NOT NULL AND base_price > 0${playerF.sql}
           ORDER BY (final_amount::numeric / NULLIF(base_price,0)) DESC LIMIT 1`,
          [tid, ...playerF.params],
        ),
        pool.query(
          `SELECT outcome, COUNT(*)::int AS cnt
           FROM auction_player_events
           WHERE tournament_id = $1 AND outcome != 'in_progress'${playerF.sql}
           GROUP BY outcome`,
          [tid, ...playerF.params],
        ),
      ]);

    const outcomes: Record<string, number> = {};
    for (const row of outcomeResult.rows) outcomes[row.outcome] = row.cnt;
    const total = Object.values(outcomes).reduce((a, b) => a + b, 0) || 1;

    return {
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
    };
  });

  res.json(payload);
});

// ─── Replay Timeline ──────────────────────────────────────────────────────────

router.get("/intelligence/replay/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const limit = Math.min(parseInt((req.query.limit as string) ?? "400", 10) || 400, 600);
  const afterRaw = typeof req.query.after === "string" && req.query.after.length > 0
    ? req.query.after
    : null;
  let afterTs: string | null = null;
  let afterPriority = 0;
  let afterType = "";
  if (afterRaw) {
    const parts = afterRaw.split("|");
    afterTs = parts[0] ?? null;
    afterPriority = parseInt(parts[1] ?? "0", 10) || 0;
    afterType = parts[2] ?? "";
  }

  const params: unknown[] = [tid];
  let afterClause = "";
  if (afterTs) {
    params.push(afterTs, afterPriority, afterType);
    afterClause = `WHERE (
      ev.timestamp > $${params.length - 2}::timestamptz
      OR (ev.timestamp = $${params.length - 2}::timestamptz AND ev.sort_priority > $${params.length - 1})
      OR (ev.timestamp = $${params.length - 2}::timestamptz AND ev.sort_priority = $${params.length - 1} AND ev.event_type > $${params.length})
    )`;
  }
  params.push(limit + 1);

  const { rows } = await pool.query(
    `SELECT event_type, timestamp, player_id, player_name, team_id, team_name,
            team_color, short_code, bid_amount, bid_sequence_number,
            milliseconds_since_last_bid, outcome, category_name,
            timer_type, timer_seconds, triggered_by, sort_priority
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
         NULL::text                        AS category_name,
         NULL::text                        AS timer_type,
         NULL::int                         AS timer_seconds,
         NULL::text                        AS triggered_by,
         2                                 AS sort_priority
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
         c.name                           AS category_name,
         NULL::text                       AS timer_type,
         NULL::int                         AS timer_seconds,
         NULL::text                       AS triggered_by,
         CASE WHEN ape.outcome = 'in_progress' THEN 1 ELSE 4 END AS sort_priority
       FROM auction_player_events ape
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE ape.tournament_id = $1

       UNION ALL

       SELECT
         'timer_' || ate.action           AS event_type,
         ate.timestamp,
         ate.player_id,
         COALESCE(ape.player_name, '?')   AS player_name,
         NULL::int                        AS team_id,
         NULL::text                       AS team_name,
         NULL::text                       AS team_color,
         NULL::text                       AS short_code,
         NULL::int                        AS bid_amount,
         NULL::int                        AS bid_sequence_number,
         NULL::int                        AS milliseconds_since_last_bid,
         NULL::text                       AS outcome,
         NULL::text                       AS category_name,
         ate.timer_type,
         ate.timer_seconds,
         ate.triggered_by,
         3                                AS sort_priority
       FROM auction_timer_events ate
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name
         FROM auction_player_events
         ORDER BY player_id, tournament_id, id ASC
       ) ape ON ape.player_id = ate.player_id AND ape.tournament_id = ate.tournament_id
       WHERE ate.tournament_id = $1
     ) ev
     ${afterClause}
     ORDER BY timestamp ASC, sort_priority ASC, event_type ASC
     LIMIT $${params.length}`,
    params,
  );

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const last = events.length > 0 ? events[events.length - 1] : null;
  const nextAfter = last
    ? `${new Date(last.timestamp).toISOString()}|${last.sort_priority ?? 0}|${last.event_type ?? ""}`
    : null;

  res.json({
    events,
    nextAfter,
    hasMore,
  });
});

// ─── Player Demand Analytics ──────────────────────────────────────────────────

router.get("/intelligence/demand/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const filters = parseIntelFilters(req.query as Record<string, unknown>);
  const playerF = playerEventFilters(filters, 2);

  const rows = await getCachedIntel(intelCacheKey("demand", tid, filters), async () => {
    const { rows: data } = await pool.query(
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
       WHERE tournament_id = $1 AND outcome IN ('sold','unsold','deferred')${playerF.sql}
       ORDER BY demand_score DESC
       LIMIT 60`,
      [tid, ...playerF.params],
    );
    return data;
  });

  res.json(rows);
});

// ─── Team Behavior Profiles ───────────────────────────────────────────────────

router.get("/intelligence/behavior/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const filters = parseIntelFilters(req.query as Record<string, unknown>);

  const profiles = await getCachedIntel(intelCacheKey("behavior", tid, filters), async () => {
    const bidF = bidEventFilters(filters, 2);

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
         WHERE abe.tournament_id = $1${bidF.sql}
         GROUP BY abe.team_id, t.name, t.color, t.short_code, t.purse, t.purse_used
         ORDER BY total_bids DESC`,
        [tid, ...bidF.params],
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
         WHERE abe.tournament_id = $1 AND c.name IS NOT NULL${bidF.sql}
         GROUP BY abe.team_id, c.name, c.color_code
         ORDER BY cat_bids DESC`,
        [tid, ...bidF.params],
      ),
    ]);

    const catsByTeam: Record<number, Array<{ cat_name: string; color_code: string | null; cat_bids: number }>> = {};
    for (const r of categoryRows.rows) {
      if (!catsByTeam[r.team_id]) catsByTeam[r.team_id] = [];
      catsByTeam[r.team_id]!.push(r);
    }

    return teamRows.rows.map(row => {
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
  });

  res.json(profiles);
});

// ─── Observation Notes (rule-based) ──────────────────────────────────────────

router.get("/intelligence/observations/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const filters = parseIntelFilters(req.query as Record<string, unknown>);

  const notes = await getCachedIntel(intelCacheKey("observations", tid, filters), async () => {
  const [
    catStats,
    roleStats,
    speedStats,
    inflationStats,
    unsoldStats,
    bidWarsResult,
    teamConc,
    catSaleStats,
    phaseStats,
    pursePhaseStats,
  ] = await Promise.all([
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
      pool.query(
        `SELECT c.name,
                AVG(ape.final_amount) FILTER (WHERE ape.outcome = 'sold')::int AS avg_sold,
                COUNT(*) FILTER (WHERE ape.outcome = 'sold')::int AS sold_count
         FROM auction_player_events ape
         LEFT JOIN categories c ON c.id = ape.category_id
         WHERE ape.tournament_id = $1 AND c.name IS NOT NULL
         GROUP BY c.name
         HAVING COUNT(*) FILTER (WHERE ape.outcome = 'sold') >= 2
         ORDER BY avg_sold DESC NULLS LAST`, [tid],
      ),
      pool.query(
        `SELECT phase,
                COUNT(*)::int AS bids,
                AVG(milliseconds_since_last_bid)
                  FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_ms
         FROM (
           SELECT abe.*,
                  NTILE(3) OVER (ORDER BY abe.timestamp ASC) AS phase
           FROM auction_bid_events abe
           WHERE abe.tournament_id = $1
         ) phased
         GROUP BY phase
         ORDER BY phase ASC`, [tid],
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE phase = 1)::int AS early_bids,
           COUNT(*) FILTER (WHERE phase = 3)::int AS late_bids,
           AVG(milliseconds_since_last_bid)
             FILTER (WHERE phase = 1 AND milliseconds_since_last_bid IS NOT NULL)::int AS early_avg_ms,
           AVG(milliseconds_since_last_bid)
             FILTER (WHERE phase = 3 AND milliseconds_since_last_bid IS NOT NULL)::int AS late_avg_ms
         FROM (
           SELECT abe.*,
                  NTILE(3) OVER (PARTITION BY abe.team_id ORDER BY abe.timestamp ASC) AS phase
           FROM auction_bid_events abe
           JOIN teams t ON t.id = abe.team_id
           WHERE abe.tournament_id = $1
             AND t.purse > 0
             AND (t.purse_used::numeric / t.purse) >= 0.70
         ) team_phased`, [tid],
      ),
    ]);

  const notes: Array<{ type: string; headline: string; detail: string }> = [];

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

  if (catSaleStats.rows.length >= 2) {
    const topSale = catSaleStats.rows[0];
    const bottomSale = catSaleStats.rows[catSaleStats.rows.length - 1];
    if (topSale.avg_sold && bottomSale.avg_sold && topSale.avg_sold > bottomSale.avg_sold * 1.5) {
      const ratio = Math.round((topSale.avg_sold / bottomSale.avg_sold) * 10) / 10;
      notes.push({
        type: "insight",
        headline: `${topSale.name} sold at ${ratio}x the average price of ${bottomSale.name}`,
        detail: `Average sale: ${topSale.name} ₹${(topSale.avg_sold / 100000).toFixed(1)}L vs ${bottomSale.name} ₹${(bottomSale.avg_sold / 100000).toFixed(1)}L — premium category pricing gap detected.`,
      });
    }
  }

  if (roleStats.rows.length > 0) {
    const topRole = roleStats.rows[0];
    notes.push({
      type: "insight",
      headline: `${topRole.player_role} attracted the most bidding interest`,
      detail: `Averaging ${parseFloat(topRole.avg_bids).toFixed(1)} bids per player across ${topRole.count} ${topRole.player_role.toLowerCase()} slots.`,
    });
  }

  const sp = speedStats.rows[0];
  if (sp && sp.early_avg_ms && sp.late_avg_ms && sp.total_bids > 10) {
    const ratio = Math.round(sp.late_avg_ms / Math.max(sp.early_avg_ms, 1));
    notes.push({
      type: "strategy",
      headline: `Teams react ${ratio}x slower in extended bidding`,
      detail: `Opening bids averaged ${Math.round(sp.early_avg_ms / 1000 * 10) / 10}s response vs ${Math.round(sp.late_avg_ms / 1000 * 10) / 10}s after the 5th bid — indicating deliberation fatigue.`,
    });
  }

  const phaseRows = phaseStats.rows;
  if (phaseRows.length >= 2) {
    const early = phaseRows.find((r: { phase: number }) => r.phase === 1);
    const late = phaseRows.find((r: { phase: number }) => r.phase === 3);
    if (early?.avg_ms && late?.avg_ms && late.avg_ms > early.avg_ms * 1.4 && early.bids >= 5) {
      notes.push({
        type: "pattern",
        headline: "Auction pace slowed in the final third",
        detail: `Average bid response rose from ${Math.round(early.avg_ms / 1000 * 10) / 10}s early to ${Math.round(late.avg_ms / 1000 * 10) / 10}s late — teams became more cautious as the auction progressed.`,
      });
    }
  }

  const pursePhase = pursePhaseStats.rows[0];
  if (pursePhase && pursePhase.late_bids > 0 && pursePhase.early_bids > 0) {
    const lateShare = pursePhase.late_bids / (pursePhase.early_bids + pursePhase.late_bids);
    if (lateShare < 0.25 && pursePhase.early_avg_ms && pursePhase.late_avg_ms && pursePhase.late_avg_ms > pursePhase.early_avg_ms * 1.3) {
      notes.push({
        type: "strategy",
        headline: "High-spend teams turned conservative after 70% purse use",
        detail: `Teams above 70% purse usage placed fewer late-phase bids and slowed response times — budget pressure visibly changed behavior.`,
      });
    }
  }

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

  if (teamConc.rows.length > 0 && sp?.total_bids > 5) {
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

  const warsCount = bidWarsResult.rows[0]?.players_with_wars ?? 0;
  if (warsCount > 0) {
    notes.push({
      type: "pattern",
      headline: `${warsCount} player${warsCount !== 1 ? "s" : ""} triggered multi-team bid wars`,
      detail: "3 or more teams competed simultaneously on these players — the most contested slots of the tournament.",
    });
  }

  return notes.length > 0 ? notes : [
    {
      type: "insight",
      headline: "Insufficient data to generate observations",
      detail: "Run at least one complete auction session to unlock behavioral intelligence.",
    },
  ];
  });

  res.json(notes);
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

router.get("/intelligence/players/search", heavyLimiter, async (req, res) => {
  const q = `%${(req.query.q as string) ?? ""}%`;
  const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : null;

  const tournamentFilter = tournamentId && !isNaN(tournamentId) ? "AND tournament_id = $2" : "";
  const params: unknown[] = [q];
  if (tournamentId && !isNaN(tournamentId)) params.push(tournamentId);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(global_player_id, 'local:' || player_id::text) AS identity_key,
       MAX(global_player_id) AS global_player_id,
       MIN(player_id) AS player_id,
       MIN(player_name) AS player_name,
       MIN(player_role) AS player_role,
       MIN(sport) AS sport,
       COUNT(*) FILTER (WHERE outcome IN ('sold','unsold','deferred'))::int AS total_auctions,
       AVG(final_amount) FILTER (WHERE outcome = 'sold')::int AS avg_sold_value,
       MAX(final_amount) FILTER (WHERE outcome = 'sold')::int AS max_sold_value,
       SUM(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS total_bids_received,
       AVG(total_bids_received) FILTER (WHERE outcome IN ('sold','unsold'))::int AS avg_bids_per_auction,
       COUNT(DISTINCT tournament_id)::int AS tournament_count
     FROM auction_player_events
     WHERE player_name ILIKE $1 ${tournamentFilter}
     GROUP BY COALESCE(global_player_id, 'local:' || player_id::text)
     ORDER BY total_auctions DESC, avg_sold_value DESC NULLS LAST
     LIMIT 30`,
    params,
  );

  res.json(rows);
});

// ─── Player Detail (cross-tournament when global_player_id is linked) ───────────

router.get("/intelligence/players/detail", async (req, res) => {
  const globalPlayerId = typeof req.query.globalPlayerId === "string" ? req.query.globalPlayerId : null;
  const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : null;

  if (!globalPlayerId && (playerId == null || isNaN(playerId))) {
    res.status(400).json({ error: "Provide globalPlayerId or playerId" });
    return;
  }

  const useGlobal = !!globalPlayerId;
  const param = globalPlayerId ?? playerId;
  const apeWhere = useGlobal
    ? "ape.global_player_id = $1 AND ape.outcome != 'in_progress'"
    : "ape.player_id = $1 AND ape.global_player_id IS NULL AND ape.outcome != 'in_progress'";
  const abeWhere = useGlobal
    ? "abe.global_player_id = $1"
    : "abe.player_id = $1 AND abe.global_player_id IS NULL";

  const [auctionsResult, bidTimelineResult, interestedTeamsResult] = await Promise.all([
    pool.query(
      `SELECT ape.*, tor.name AS tournament_name, tor.sport AS tournament_sport
       FROM auction_player_events ape
       LEFT JOIN tournaments tor ON tor.id = ape.tournament_id
       WHERE ${apeWhere}
       ORDER BY ape.timestamp DESC`,
      [param],
    ),
    pool.query(
      `SELECT abe.bid_amount, abe.bid_sequence_number,
              abe.milliseconds_since_last_bid, abe.timer_remaining_seconds,
              abe.timestamp, abe.tournament_id,
              t.name AS team_name, t.color AS team_color, t.short_code,
              tor.name AS tournament_name
       FROM auction_bid_events abe
       LEFT JOIN teams t ON t.id = abe.team_id
       LEFT JOIN tournaments tor ON tor.id = abe.tournament_id
       WHERE ${abeWhere}
       ORDER BY abe.timestamp DESC LIMIT 100`,
      [param],
    ),
    pool.query(
      `SELECT t.name AS team_name, t.color AS team_color, COUNT(*)::int AS bid_count
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE ${abeWhere}
       GROUP BY t.id, t.name, t.color
       ORDER BY bid_count DESC`,
      [param],
    ),
  ]);

  res.json({
    globalPlayerId: useGlobal ? globalPlayerId : null,
    playerId: playerId ?? auctionsResult.rows[0]?.player_id ?? null,
    auctions: auctionsResult.rows,
    bidTimeline: bidTimelineResult.rows,
    interestedTeams: interestedTeamsResult.rows,
  });
});

// ─── Player Detail (legacy path) ───────────────────────────────────────────────

router.get("/intelligence/players/:playerId", async (req, res) => {
  const pid = parseInt(req.params.playerId);
  if (isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [linked] = await pool.query(
    `SELECT global_player_id FROM auction_player_events
     WHERE player_id = $1 AND global_player_id IS NOT NULL
     LIMIT 1`,
    [pid],
  );
  const globalPlayerId = linked.rows[0]?.global_player_id as string | undefined;

  const useGlobal = !!globalPlayerId;
  const param = globalPlayerId ?? pid;
  const apeWhere = useGlobal
    ? "ape.global_player_id = $1 AND ape.outcome != 'in_progress'"
    : "ape.player_id = $1 AND ape.global_player_id IS NULL AND ape.outcome != 'in_progress'";
  const abeWhere = useGlobal
    ? "abe.global_player_id = $1"
    : "abe.player_id = $1 AND abe.global_player_id IS NULL";

  const [auctionsResult, bidTimelineResult, interestedTeamsResult] = await Promise.all([
    pool.query(
      `SELECT ape.*, tor.name AS tournament_name, tor.sport AS tournament_sport
       FROM auction_player_events ape
       LEFT JOIN tournaments tor ON tor.id = ape.tournament_id
       WHERE ${apeWhere}
       ORDER BY ape.timestamp DESC`,
      [param],
    ),
    pool.query(
      `SELECT abe.bid_amount, abe.bid_sequence_number,
              abe.milliseconds_since_last_bid, abe.timer_remaining_seconds,
              abe.timestamp, abe.tournament_id,
              t.name AS team_name, t.color AS team_color, t.short_code,
              tor.name AS tournament_name
       FROM auction_bid_events abe
       LEFT JOIN teams t ON t.id = abe.team_id
       LEFT JOIN tournaments tor ON tor.id = abe.tournament_id
       WHERE ${abeWhere}
       ORDER BY abe.timestamp DESC LIMIT 100`,
      [param],
    ),
    pool.query(
      `SELECT t.name AS team_name, t.color AS team_color, COUNT(*)::int AS bid_count
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       WHERE ${abeWhere}
       GROUP BY t.id, t.name, t.color
       ORDER BY bid_count DESC`,
      [param],
    ),
  ]);

  res.json({
    globalPlayerId: useGlobal ? globalPlayerId : null,
    playerId: pid,
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

// ─── Filter Options ───────────────────────────────────────────────────────────

router.get("/intelligence/filters/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [categories, teams, tournament] = await Promise.all([
    pool.query(
      `SELECT id, name, color_code FROM categories WHERE tournament_id = $1 ORDER BY name ASC`,
      [tid],
    ),
    pool.query(
      `SELECT id, name, color, short_code FROM teams WHERE tournament_id = $1 ORDER BY name ASC`,
      [tid],
    ),
    pool.query(
      `SELECT id, name, sport, status FROM tournaments WHERE id = $1`,
      [tid],
    ),
  ]);

  res.json({
    tournament: tournament.rows[0] ?? null,
    categories: categories.rows,
    teams: teams.rows,
  });
});

// ─── Bid Intensity Analysis ───────────────────────────────────────────────────

router.get("/intelligence/intensity/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const filters = parseIntelFilters(req.query as Record<string, unknown>);

  const payload = await getCachedIntel(intelCacheKey("intensity", tid, filters), async () => {
    const bidF = bidEventFilters(filters, 2);

    const { rows } = await pool.query(
      `SELECT
         abe.player_id,
         MIN(ape.player_name) AS player_name,
         MIN(ape.base_price) AS base_price,
         MIN(ape.final_amount) AS final_amount,
         MIN(ape.outcome) AS outcome,
         COUNT(*)::int AS total_bids,
         COUNT(DISTINCT abe.team_id)::int AS team_count,
         json_agg(abe.bid_amount ORDER BY abe.bid_sequence_number) AS escalation_curve,
         AVG(abe.milliseconds_since_last_bid)
           FILTER (WHERE abe.bid_sequence_number <= 2)::int AS early_avg_ms,
         AVG(abe.milliseconds_since_last_bid)
           FILTER (WHERE abe.bid_sequence_number > 2 AND abe.bid_sequence_number <= 5)::int AS mid_avg_ms,
         AVG(abe.milliseconds_since_last_bid)
           FILTER (WHERE abe.bid_sequence_number > 5)::int AS late_avg_ms,
         MIN(abe.bid_amount) FILTER (WHERE abe.bid_sequence_number = 1) AS first_bid,
         MAX(abe.bid_amount) AS last_bid,
         MIN(abe.timestamp) AS first_bid_at,
         MAX(abe.timestamp) AS last_bid_at
       FROM auction_bid_events abe
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id,
                player_name, base_price, final_amount, outcome
         FROM auction_player_events
         WHERE outcome != 'in_progress'
         ORDER BY player_id, tournament_id, id DESC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       WHERE abe.tournament_id = $1${bidF.sql}
       GROUP BY abe.player_id
       HAVING COUNT(*) >= 2
       ORDER BY total_bids DESC
       LIMIT 50`,
      [tid, ...bidF.params],
    );

    type IntensityRow = {
      player_id: number;
      player_name: string;
      base_price: number | null;
      final_amount: number | null;
      outcome: string | null;
      total_bids: number;
      team_count: number;
      escalation_curve: number[];
      early_avg_ms: number | null;
      mid_avg_ms: number | null;
      late_avg_ms: number | null;
      first_bid: number | null;
      last_bid: number | null;
      first_bid_at: string;
      last_bid_at: string;
      escalation_pct: number;
      intensity_score: number;
      badges: string[];
    };

    const players: IntensityRow[] = rows.map((r) => {
      const curve = (r.escalation_curve as number[]) ?? [];
      const first = curve[0] ?? r.first_bid ?? 0;
      const last = curve[curve.length - 1] ?? r.last_bid ?? 0;
      const escalationPct = first > 0 ? Math.round((last / first - 1) * 100) : 0;
      const durationMs = new Date(r.last_bid_at).getTime() - new Date(r.first_bid_at).getTime();
      const durationSecs = Math.max(durationMs / 1000, 1);
      const escalationRate = escalationPct / durationSecs;

      const intensityScore = Math.round(
        r.total_bids * 2.5 +
        r.team_count * 6 +
        Math.min(escalationPct / 4, 35) +
        Math.min(escalationRate * 2, 15),
      );

      const badges: string[] = [];
      if (r.total_bids >= 12) badges.push("Most Wanted");
      if (r.team_count >= 3) badges.push("Bid War");
      if (escalationPct >= 150) badges.push("Steep Climb");
      if (r.early_avg_ms != null && r.late_avg_ms != null && r.late_avg_ms < r.early_avg_ms * 0.7) {
        badges.push("Fast Escalation");
      }
      if (r.outcome === "sold" && r.base_price && r.final_amount && r.final_amount > r.base_price * 2.5) {
        badges.push("Surprise Sale");
      }

      return {
        ...r,
        escalation_curve: curve,
        escalation_pct: escalationPct,
        intensity_score: intensityScore,
        badges,
      };
    });

    const maxIntensity = Math.max(...players.map((p) => p.intensity_score), 1);

    const byBids = [...players].sort((a, b) => b.total_bids - a.total_bids);
    const byEscRate = [...players].sort((a, b) => {
      const aDur = Math.max(new Date(a.last_bid_at).getTime() - new Date(a.first_bid_at).getTime(), 1000) / 1000;
      const bDur = Math.max(new Date(b.last_bid_at).getTime() - new Date(b.first_bid_at).getTime(), 1000) / 1000;
      return (b.escalation_pct / bDur) - (a.escalation_pct / aDur);
    });
    const bySurprise = [...players]
      .filter((p) => p.outcome === "sold" && p.base_price && p.final_amount)
      .sort((a, b) => {
        const aInf = (a.final_amount! / a.base_price!) - 1;
        const bInf = (b.final_amount! / b.base_price!) - 1;
        return bInf - aInf;
      });

    return {
      players,
      maxIntensity,
      spotlight: {
        mostWanted: byBids[0] ?? null,
        fastestEscalation: byEscRate[0] ?? null,
        biggestSurprise: bySurprise[0] ?? null,
      },
    };
  });

  res.json(payload);
});

// ─── Live Intel (poll-based, no cache) ────────────────────────────────────────

router.get("/intelligence/live/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [
    boundsResult,
    windowStatsResult,
    teamActivityResult,
    lastBidResult,
    hottestPlayerResult,
  ] = await Promise.all([
    pool.query(
      `SELECT MAX(timestamp) AS latest FROM auction_bid_events WHERE tournament_id = $1`,
      [tid],
    ),
    pool.query(
      `WITH bounds AS (
         SELECT MAX(timestamp) AS latest FROM auction_bid_events WHERE tournament_id = $1
       )
       SELECT
         COUNT(*)::int AS bids_in_window,
         COUNT(*) FILTER (
           WHERE abe.timestamp > b.latest - INTERVAL '1 minute'
         )::int AS bids_last_minute
       FROM auction_bid_events abe, bounds b
       WHERE abe.tournament_id = $1
         AND b.latest IS NOT NULL
         AND abe.timestamp > b.latest - INTERVAL '10 minutes'`,
      [tid],
    ),
    pool.query(
      `WITH bounds AS (
         SELECT MAX(timestamp) AS latest FROM auction_bid_events WHERE tournament_id = $1
       )
       SELECT abe.team_id, t.name AS team_name, t.color AS team_color, t.short_code,
              COUNT(*)::int AS recent_bids,
              AVG(abe.milliseconds_since_last_bid)
                FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id, bounds b
       WHERE abe.tournament_id = $1
         AND b.latest IS NOT NULL
         AND abe.timestamp > b.latest - INTERVAL '10 minutes'
       GROUP BY abe.team_id, t.name, t.color, t.short_code
       ORDER BY recent_bids DESC
       LIMIT 8`,
      [tid],
    ),
    pool.query(
      `SELECT abe.bid_amount, abe.timestamp, abe.milliseconds_since_last_bid,
              ape.player_name, t.name AS team_name, t.color AS team_color, t.short_code
       FROM auction_bid_events abe
       JOIN teams t ON t.id = abe.team_id
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name
         FROM auction_player_events ORDER BY player_id, tournament_id, id ASC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       WHERE abe.tournament_id = $1
       ORDER BY abe.timestamp DESC LIMIT 1`,
      [tid],
    ),
    pool.query(
      `WITH bounds AS (
         SELECT MAX(timestamp) AS latest FROM auction_bid_events WHERE tournament_id = $1
       )
       SELECT abe.player_id, MIN(ape.player_name) AS player_name,
              COUNT(*)::int AS recent_bids
       FROM auction_bid_events abe, bounds b
       LEFT JOIN (
         SELECT DISTINCT ON (player_id, tournament_id) player_id, tournament_id, player_name
         FROM auction_player_events ORDER BY player_id, tournament_id, id ASC
       ) ape ON ape.player_id = abe.player_id AND ape.tournament_id = abe.tournament_id
       WHERE abe.tournament_id = $1
         AND b.latest IS NOT NULL
         AND abe.timestamp > b.latest - INTERVAL '10 minutes'
       GROUP BY abe.player_id
       ORDER BY recent_bids DESC LIMIT 1`,
      [tid],
    ),
  ]);

  const latest = boundsResult.rows[0]?.latest ?? null;
  const windowStats = windowStatsResult.rows[0] ?? { bids_in_window: 0, bids_last_minute: 0 };
  const bidsPerMinute = windowStats.bids_in_window > 0
    ? Math.round((windowStats.bids_in_window / 10) * 10) / 10
    : 0;

  let intensityLevel: "idle" | "low" | "warm" | "hot" = "idle";
  if (windowStats.bids_last_minute >= 8 || bidsPerMinute >= 6) intensityLevel = "hot";
  else if (windowStats.bids_last_minute >= 4 || bidsPerMinute >= 3) intensityLevel = "warm";
  else if (windowStats.bids_in_window > 0) intensityLevel = "low";

  res.json({
    latestTimestamp: latest,
    windowMinutes: 10,
    bidsInWindow: windowStats.bids_in_window ?? 0,
    bidsLastMinute: windowStats.bids_last_minute ?? 0,
    bidsPerMinute,
    intensityLevel,
    activeTeams: teamActivityResult.rows,
    lastBid: lastBidResult.rows[0] ?? null,
    hottestPlayer: hottestPlayerResult.rows[0] ?? null,
  });
});

// ─── Intelligence Archives ────────────────────────────────────────────────────

router.get("/intelligence/archives", async (_req, res) => {
  const rows = await db
    .select()
    .from(intelligenceArchivesTable)
    .orderBy(desc(intelligenceArchivesTable.archivedAt));
  res.json(rows);
});

router.get("/intelligence/archives/:archiveId", async (req, res) => {
  const archiveId = parseInt(req.params.archiveId);
  if (isNaN(archiveId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [archive] = await db
    .select()
    .from(intelligenceArchivesTable)
    .where(drizzleEq(intelligenceArchivesTable.id, archiveId));

  if (!archive) { res.status(404).json({ error: "Archive not found" }); return; }

  const [bidSample, playerOutcomes] = await Promise.all([
    pool.query(
      `SELECT player_id, team_name, bid_amount, bid_sequence_number, timestamp
       FROM intelligence_archive_bid_events
       WHERE archive_id = $1 ORDER BY timestamp DESC LIMIT 20`,
      [archiveId],
    ),
    pool.query(
      `SELECT outcome, COUNT(*)::int AS cnt
       FROM intelligence_archive_player_events
       WHERE archive_id = $1 AND outcome != 'in_progress'
       GROUP BY outcome`,
      [archiveId],
    ),
  ]);

  res.json({
    archive,
    recentBids: bidSample.rows,
    outcomes: playerOutcomes.rows,
  });
});

// ─── Cross-Sport Intelligence ─────────────────────────────────────────────────

router.get("/intelligence/cross-sport", async (_req, res) => {
  const payload = await getCachedIntel("cross-sport:platform", async () => {
    const [liveBids, archiveBids, livePlayers, archivePlayers, archivesBySport] = await Promise.all([
      pool.query(
        `SELECT COALESCE(tor.sport, abe.sport) AS sport,
                COUNT(*)::int AS total_bids,
                COUNT(DISTINCT abe.tournament_id)::int AS tournaments,
                AVG(abe.milliseconds_since_last_bid)
                  FILTER (WHERE abe.milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
         FROM auction_bid_events abe
         JOIN tournaments tor ON tor.id = abe.tournament_id
         GROUP BY 1 ORDER BY total_bids DESC`,
      ),
      pool.query(
        `SELECT tournament_sport AS sport,
                COUNT(*)::int AS total_bids,
                COUNT(DISTINCT archive_id)::int AS tournaments,
                AVG(milliseconds_since_last_bid)
                  FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_response_ms
         FROM intelligence_archive_bid_events
         GROUP BY 1 ORDER BY total_bids DESC`,
      ),
      pool.query(
        `SELECT COALESCE(tor.sport, ape.sport) AS sport,
                COUNT(*) FILTER (WHERE ape.outcome = 'sold')::int AS sold,
                COUNT(*) FILTER (WHERE ape.outcome = 'unsold')::int AS unsold,
                AVG(ape.final_amount) FILTER (WHERE ape.outcome = 'sold')::int AS avg_sold,
                AVG(ape.total_bids_received)
                  FILTER (WHERE ape.outcome IN ('sold','unsold','deferred'))::numeric(6,1) AS avg_bids_per_player
         FROM auction_player_events ape
         JOIN tournaments tor ON tor.id = ape.tournament_id
         WHERE ape.outcome != 'in_progress'
         GROUP BY 1`,
      ),
      pool.query(
        `SELECT tournament_sport AS sport,
                COUNT(*) FILTER (WHERE outcome = 'sold')::int AS sold,
                COUNT(*) FILTER (WHERE outcome = 'unsold')::int AS unsold,
                AVG(final_amount) FILTER (WHERE outcome = 'sold')::int AS avg_sold,
                AVG(total_bids_received)
                  FILTER (WHERE outcome IN ('sold','unsold','deferred'))::numeric(6,1) AS avg_bids_per_player
         FROM intelligence_archive_player_events
         WHERE outcome != 'in_progress'
         GROUP BY 1`,
      ),
      pool.query(
        `SELECT tournament_sport AS sport, COUNT(*)::int AS archived_tournaments
         FROM intelligence_archives
         GROUP BY tournament_sport`,
      ),
    ]);

    type SportAgg = {
      sport: string;
      totalBids: number;
      tournaments: number;
      avgResponseMs: number | null;
      sold: number;
      unsold: number;
      avgSold: number | null;
      avgBidsPerPlayer: number | null;
      archivedTournaments: number;
    };

    const bySport = new Map<string, SportAgg>();

    const ensure = (sport: string): SportAgg => {
      const key = sport || "unknown";
      if (!bySport.has(key)) {
        bySport.set(key, {
          sport: key,
          totalBids: 0,
          tournaments: 0,
          avgResponseMs: null,
          sold: 0,
          unsold: 0,
          avgSold: null,
          avgBidsPerPlayer: null,
          archivedTournaments: 0,
        });
      }
      return bySport.get(key)!;
    };

    for (const r of liveBids.rows) {
      const s = ensure(r.sport);
      s.totalBids += r.total_bids;
      s.tournaments += r.tournaments;
      s.avgResponseMs = r.avg_response_ms;
    }
    for (const r of archiveBids.rows) {
      const s = ensure(r.sport);
      s.totalBids += r.total_bids;
      s.tournaments += r.tournaments;
      if (r.avg_response_ms != null) s.avgResponseMs = r.avg_response_ms;
    }
    for (const r of livePlayers.rows) {
      const s = ensure(r.sport);
      s.sold += r.sold ?? 0;
      s.unsold += r.unsold ?? 0;
      if (r.avg_sold != null) s.avgSold = r.avg_sold;
      if (r.avg_bids_per_player != null) s.avgBidsPerPlayer = parseFloat(r.avg_bids_per_player);
    }
    for (const r of archivePlayers.rows) {
      const s = ensure(r.sport);
      s.sold += r.sold ?? 0;
      s.unsold += r.unsold ?? 0;
      if (r.avg_sold != null) s.avgSold = r.avg_sold;
      if (r.avg_bids_per_player != null) s.avgBidsPerPlayer = parseFloat(r.avg_bids_per_player);
    }
    for (const r of archivesBySport.rows) {
      ensure(r.sport).archivedTournaments = r.archived_tournaments;
    }

    const sports = [...bySport.values()].sort((a, b) => b.totalBids - a.totalBids);
    return { sports, generatedAt: new Date().toISOString() };
  });

  res.json(payload);
});

// ─── AI Briefing (observations only) ──────────────────────────────────────────

router.get("/intelligence/briefing/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db
    .select({ name: tournamentsTable.name, sport: tournamentsTable.sport })
    .from(tournamentsTable)
    .where(drizzleEq(tournamentsTable.id, tid));

  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const filters = parseIntelFilters(req.query as Record<string, unknown>);
  const notes = await getCachedIntel(
    intelCacheKey("observations", tid, filters),
    async () => fetchObservationsForTournament(tid),
  ) as ObservationNote[];

  const briefing = await buildIntelligenceBriefing(tournament.name, tournament.sport, notes);
  res.json(briefing);
});

async function fetchObservationsForTournament(tid: number): Promise<ObservationNote[]> {
  const resp = await pool.query(
    `SELECT 1 FROM auction_bid_events WHERE tournament_id = $1 LIMIT 1`,
    [tid],
  );
  if (resp.rows.length === 0) {
    return [{
      type: "insight",
      headline: "Insufficient data to generate observations",
      detail: "Run at least one complete auction session to unlock behavioral intelligence.",
    }];
  }

  // Re-use observations route logic via internal HTTP-less duplicate: fetch from cache miss path
  // by delegating to the same SQL bundle used in observations handler.
  const notes: ObservationNote[] = [];
  const [
    catStats,
    roleStats,
    speedStats,
    inflationStats,
    unsoldStats,
    bidWarsResult,
    teamConc,
    catSaleStats,
    phaseStats,
    pursePhaseStats,
  ] = await Promise.all([
    pool.query(
      `SELECT c.name, AVG(ape.total_bids_received)::numeric(6,1) AS avg_bids, COUNT(*)::int AS player_count
       FROM auction_player_events ape
       LEFT JOIN categories c ON c.id = ape.category_id
       WHERE ape.tournament_id = $1 AND ape.outcome IN ('sold','unsold','deferred') AND c.name IS NOT NULL
       GROUP BY c.name ORDER BY avg_bids DESC`, [tid],
    ),
    pool.query(
      `SELECT player_role, AVG(total_bids_received)::numeric(6,1) AS avg_bids, COUNT(*)::int AS count
       FROM auction_player_events
       WHERE tournament_id = $1 AND outcome IN ('sold','unsold','deferred')
         AND player_role IS NOT NULL AND total_bids_received IS NOT NULL
       GROUP BY player_role ORDER BY avg_bids DESC LIMIT 3`, [tid],
    ),
    pool.query(
      `SELECT AVG(milliseconds_since_last_bid) FILTER (WHERE bid_sequence_number <= 2)::int AS early_avg_ms,
              AVG(milliseconds_since_last_bid) FILTER (WHERE bid_sequence_number > 5)::int AS late_avg_ms,
              COUNT(*)::int AS total_bids
       FROM auction_bid_events
       WHERE tournament_id = $1 AND milliseconds_since_last_bid IS NOT NULL`, [tid],
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE final_amount > base_price * 3 AND outcome = 'sold')::int AS high_inflation,
              COUNT(*) FILTER (WHERE outcome = 'sold')::int AS total_sold,
              AVG(final_amount) FILTER (WHERE outcome = 'sold')::int AS avg_sold
       FROM auction_player_events WHERE tournament_id = $1 AND base_price > 0`, [tid],
    ),
    pool.query(
      `SELECT player_role, COUNT(*) FILTER (WHERE outcome = 'unsold')::int AS unsold_count
       FROM auction_player_events WHERE tournament_id = $1 AND player_role IS NOT NULL
       GROUP BY player_role HAVING COUNT(*) FILTER (WHERE outcome = 'unsold') > 0
       ORDER BY unsold_count DESC LIMIT 1`, [tid],
    ),
    pool.query(
      `SELECT COUNT(DISTINCT player_id)::int AS players_with_wars FROM (
         SELECT player_id FROM auction_bid_events WHERE tournament_id = $1
         GROUP BY player_id HAVING COUNT(DISTINCT team_id) >= 3
       ) x`, [tid],
    ),
    pool.query(
      `SELECT t.name AS team_name, COUNT(*)::int AS bids,
              ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100)::int AS share_pct
       FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
       WHERE abe.tournament_id = $1 GROUP BY t.name ORDER BY bids DESC LIMIT 2`, [tid],
    ),
    pool.query(
      `SELECT c.name, AVG(ape.final_amount) FILTER (WHERE ape.outcome = 'sold')::int AS avg_sold
       FROM auction_player_events ape LEFT JOIN categories c ON c.id = ape.category_id
       WHERE ape.tournament_id = $1 AND c.name IS NOT NULL
       GROUP BY c.name HAVING COUNT(*) FILTER (WHERE ape.outcome = 'sold') >= 2
       ORDER BY avg_sold DESC NULLS LAST`, [tid],
    ),
    pool.query(
      `SELECT phase, AVG(milliseconds_since_last_bid)
         FILTER (WHERE milliseconds_since_last_bid IS NOT NULL)::int AS avg_ms,
         COUNT(*)::int AS bids
       FROM (
         SELECT abe.*, NTILE(3) OVER (ORDER BY abe.timestamp ASC) AS phase
         FROM auction_bid_events abe WHERE abe.tournament_id = $1
       ) phased GROUP BY phase ORDER BY phase`, [tid],
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE phase = 1)::int AS early_bids,
              COUNT(*) FILTER (WHERE phase = 3)::int AS late_bids,
              AVG(milliseconds_since_last_bid)
                FILTER (WHERE phase = 1 AND milliseconds_since_last_bid IS NOT NULL)::int AS early_avg_ms,
              AVG(milliseconds_since_last_bid)
                FILTER (WHERE phase = 3 AND milliseconds_since_last_bid IS NOT NULL)::int AS late_avg_ms
       FROM (
         SELECT abe.*, NTILE(3) OVER (PARTITION BY abe.team_id ORDER BY abe.timestamp ASC) AS phase
         FROM auction_bid_events abe JOIN teams t ON t.id = abe.team_id
         WHERE abe.tournament_id = $1 AND t.purse > 0 AND (t.purse_used::numeric / t.purse) >= 0.70
       ) team_phased`, [tid],
    ),
  ]);

  if (catStats.rows.length > 0) {
    const top = catStats.rows[0];
    const bottom = catStats.rows[catStats.rows.length - 1];
    notes.push({
      type: "pattern",
      headline: `${top.name} players generated the highest competition`,
      detail: `Average of ${parseFloat(top.avg_bids).toFixed(1)} bids per ${top.name} player.`,
    });
  }
  if (catSaleStats.rows.length >= 2) {
    const topSale = catSaleStats.rows[0];
    const bottomSale = catSaleStats.rows[catSaleStats.rows.length - 1];
    if (topSale?.avg_sold && bottomSale?.avg_sold && topSale.avg_sold > bottomSale.avg_sold * 1.5) {
      notes.push({
        type: "insight",
        headline: `${topSale.name} sold at a premium vs ${bottomSale.name}`,
        detail: `Average sale gap detected between top and bottom categories.`,
      });
    }
  }
  if (roleStats.rows.length > 0) {
    const topRole = roleStats.rows[0];
    notes.push({
      type: "insight",
      headline: `${topRole.player_role} attracted the most bidding interest`,
      detail: `Averaging ${parseFloat(topRole.avg_bids).toFixed(1)} bids per player.`,
    });
  }
  const sp = speedStats.rows[0];
  if (sp?.early_avg_ms && sp?.late_avg_ms && sp.total_bids > 10) {
    notes.push({
      type: "strategy",
      headline: "Teams react slower in extended bidding",
      detail: `Opening avg ${Math.round(sp.early_avg_ms / 1000)}s vs late ${Math.round(sp.late_avg_ms / 1000)}s.`,
    });
  }
  const phaseRows = phaseStats.rows;
  const early = phaseRows.find((r: { phase: number }) => r.phase === 1);
  const late = phaseRows.find((r: { phase: number }) => r.phase === 3);
  if (early?.avg_ms && late?.avg_ms && late.avg_ms > early.avg_ms * 1.4) {
    notes.push({
      type: "pattern",
      headline: "Auction pace slowed in the final third",
      detail: "Average bid response times increased toward the end.",
    });
  }
  const pursePhase = pursePhaseStats.rows[0];
  if (pursePhase?.late_bids > 0 && pursePhase.early_bids > 0) {
    notes.push({
      type: "strategy",
      headline: "High-spend teams turned conservative after 70% purse use",
      detail: "Budget pressure visibly changed late-phase bidding behavior.",
    });
  }
  const inf = inflationStats.rows[0];
  if (inf?.total_sold > 0) {
    const pct = Math.round((inf.high_inflation / inf.total_sold) * 100);
    if (pct > 0) {
      notes.push({
        type: "insight",
        headline: `${pct}% of sold players went above 3× base price`,
        detail: inf.avg_sold ? `Average sale ₹${(inf.avg_sold / 100000).toFixed(1)}L.` : "",
      });
    }
  }
  if (unsoldStats.rows.length > 0 && unsoldStats.rows[0].unsold_count > 0) {
    const u = unsoldStats.rows[0];
    notes.push({
      type: "warning",
      headline: `${u.player_role} positions had the highest unsold rate`,
      detail: `${u.unsold_count} players went unsold in this role.`,
    });
  }
  if (teamConc.rows.length > 0 && sp?.total_bids > 5) {
    const combined = teamConc.rows.slice(0, 2).reduce((s: number, r: { share_pct: number }) => s + r.share_pct, 0);
    if (combined > 55) {
      notes.push({
        type: "strategy",
        headline: "Bidding dominated by a small set of teams",
        detail: `Top two teams placed ${combined}% of all bids.`,
      });
    }
  }
  const warsCount = bidWarsResult.rows[0]?.players_with_wars ?? 0;
  if (warsCount > 0) {
    notes.push({
      type: "pattern",
      headline: `${warsCount} players triggered multi-team bid wars`,
      detail: "Three or more teams competed on these players.",
    });
  }

  return notes.length > 0 ? notes : [{
    type: "insight",
    headline: "Insufficient data to generate observations",
    detail: "Run at least one complete auction session to unlock behavioral intelligence.",
  }];
}

// ─── Training Export (CSV) ────────────────────────────────────────────────────

router.get("/intelligence/export/live/:tournamentId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const dataset = (req.query.dataset as ExportDataset) || "all";
  if (!["bids", "players", "timers", "all"].includes(dataset)) {
    res.status(400).json({ error: "Invalid dataset" }); return;
  }

  const [tournament] = await db
    .select({ name: tournamentsTable.name })
    .from(tournamentsTable)
    .where(drizzleEq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const safeName = tournament.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  await writeIntelligenceCsv(res, {
    filename: `intel-${safeName}-tid${tid}-${dataset}.csv`,
    dataset,
    source: "live",
    tournamentId: tid,
  });
});

router.get("/intelligence/export/archive/:archiveId", async (req, res) => {
  const archiveId = parseInt(req.params.archiveId);
  if (isNaN(archiveId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const dataset = (req.query.dataset as ExportDataset) || "all";
  if (!["bids", "players", "timers", "all"].includes(dataset)) {
    res.status(400).json({ error: "Invalid dataset" }); return;
  }

  const [archive] = await db
    .select({ tournamentName: intelligenceArchivesTable.tournamentName })
    .from(intelligenceArchivesTable)
    .where(drizzleEq(intelligenceArchivesTable.id, archiveId));
  if (!archive) { res.status(404).json({ error: "Archive not found" }); return; }

  const safeName = archive.tournamentName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  await writeIntelligenceCsv(res, {
    filename: `intel-archive-${safeName}-aid${archiveId}-${dataset}.csv`,
    dataset,
    source: "archive",
    archiveId,
  });
});

export default router;
