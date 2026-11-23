import type { Response } from "express";
import PDFDocument from "pdfkit";
import { pool } from "@workspace/db";

export interface MoneyballTeamEfficiency {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
  startingPurse: number;
  totalSpent: number;
  remainingPurse: number;
  playersBought: number;
  targetSquadSize: number;
  squadCompletionRate: number; // 0.0 to 1.0
  costPerPlayer: number;
  costPerPlayerDiff: number; // costPerPlayer - tournamentAvgCostPerPlayer
  costPerPlayerVariancePct: number; // percentage variance vs tournament avg
  budgetDeploymentRate: number; // totalSpent / startingPurse (0.0 to 1.0+)
  efficiencyScore: number; // 0 to 100
  rank: number;
  breakdown: {
    completionScore: number; // out of 40
    deploymentScore: number; // out of 30
    costEfficiencyScore: number; // out of 30
  };
}

export interface CategoryInflationBreakdown {
  categoryId: number | null;
  categoryName: string;
  colorCode: string | null;
  lotCount: number;
  soldCount: number;
  unsoldCount: number;
  totalSpent: number;
  averageBasePrice: number;
  averageSoldPrice: number;
  inflationPct: number;
}

export interface TournamentMarketOverview {
  totalTurnover: number;
  averageInflationPct: number;
  lotCount: number;
  soldCount: number;
  unsoldCount: number;
  soldRatio: number; // 0.0 to 1.0
  unsoldRatio: number; // 0.0 to 1.0
  tournamentAvgCostPerPlayer: number;
  categoryBreakdown: CategoryInflationBreakdown[];
}

export interface BargainStealHighlight {
  playerId: number;
  playerName: string;
  role: string | null;
  categoryId: number | null;
  categoryName: string | null;
  teamId: number | null;
  teamName: string | null;
  basePrice: number;
  finalAmount: number;
  multiplier: number;
  totalBids: number;
  savings: number;
}

export interface RecordBreakerHighlight {
  playerId: number;
  playerName: string;
  role: string | null;
  categoryId: number | null;
  categoryName: string | null;
  teamId: number | null;
  teamName: string | null;
  basePrice: number;
  finalAmount: number;
  escalation: number;
  inflationPct: number;
  totalBids: number;
}

export interface UnsoldCategorySummary {
  categoryId: number | null;
  categoryName: string;
  colorCode: string | null;
  unsoldCount: number;
  totalBasePrice: number;
  samplePlayers: Array<{
    id: number;
    name: string;
    role: string | null;
    basePrice: number;
  }>;
}

export interface MarqueeValueHighlights {
  topBargainSteals: BargainStealHighlight[];
  topRecordBreakers: RecordBreakerHighlight[];
  unsoldByCategory: UnsoldCategorySummary[];
}

export interface PostMortemReport {
  tournamentId: number;
  tournamentName: string;
  sport: string;
  status: string;
  generatedAt: string;
  moneyballIndex: MoneyballTeamEfficiency[];
  marketOverview: TournamentMarketOverview;
  highlights: MarqueeValueHighlights;
}

function csvEscape(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatInr(val: number): string {
  if (isNaN(val) || val == null) return "Rs. 0";
  if (val < 0) return `-${formatInr(-val)}`;
  if (val >= 10_000_000) return `Rs. ${(val / 10_000_000).toFixed(2)} Cr`;
  if (val >= 100_000) return `Rs. ${(val / 100_000).toFixed(2)} L`;
  if (val >= 1_000) return `Rs. ${(val / 1_000).toFixed(0)} K`;
  return `Rs. ${val.toLocaleString("en-IN")}`;
}

function cleanPdfText(val: unknown): string {
  if (val == null) return "";
  return String(val)
    .replace(/[★☆]/g, "*")
    .replace(/[⚡]/g, ">>")
    .replace(/[^\x20-\x7E\u00A0-\u00FF•]/g, "")
    .trim();
}

/**
 * Computes complete post-auction intelligence and Moneyball efficiency rankings.
 */
export async function computePostMortemReport(tournamentId: number): Promise<PostMortemReport> {
  // 1. Fetch tournament metadata and settings
  const tourneyRes = await pool.query(
    `SELECT id, name, sport, status, base_purse, min_bid, minimum_squad_size, maximum_squad_size
     FROM tournaments WHERE id = $1`,
    [tournamentId],
  );
  if (tourneyRes.rows.length === 0) {
    throw new Error("Tournament not found");
  }
  const tournament = tourneyRes.rows[0];
  const targetSquadSize = Math.max(1, tournament.minimum_squad_size || tournament.maximum_squad_size || 11);
  const basePurse = Number(tournament.base_purse) || 0;

  // 2. Fetch teams and their purse balances
  const teamsRes = await pool.query(
    `SELECT t.id, t.name, t.short_code, t.color, t.purse, t.purse_used,
            COALESCE(pb.booster_total, 0)::int AS booster_total
     FROM teams t
     LEFT JOIN (
       SELECT team_id, SUM(amount)::int AS booster_total
       FROM purse_boosters
       WHERE tournament_id = $1 AND status = 'active'
       GROUP BY team_id
     ) pb ON pb.team_id = t.id
     WHERE t.tournament_id = $1
     ORDER BY t.id ASC`,
    [tournamentId],
  );
  const teams = teamsRes.rows;

  // 3. Fetch categories
  const catRes = await pool.query(
    `SELECT id, name, color_code
     FROM categories
     WHERE tournament_id = $1
     ORDER BY id ASC`,
    [tournamentId],
  );
  const categories = catRes.rows;
  const categoryMap = new Map<number, { name: string; colorCode: string | null }>();
  for (const c of categories) {
    categoryMap.set(Number(c.id), { name: c.name, colorCode: c.color_code || null });
  }

  // 4. Fetch auction player events (with fallback to players table)
  const eventsRes = await pool.query(
    `SELECT DISTINCT ON (ape.player_id)
            ape.player_id, ape.player_name, ape.player_role, ape.category_id,
            c.name AS category_name, c.color_code,
            ape.base_price, ape.final_amount, ape.outcome,
            ape.sold_to_team_id, ape.sold_to_team_name,
            COALESCE(ape.total_bids_received, 0)::int AS total_bids
     FROM auction_player_events ape
     LEFT JOIN categories c ON c.id = ape.category_id
     WHERE ape.tournament_id = $1 AND ape.is_superseded = false AND ape.outcome != 'in_progress'
     ORDER BY ape.player_id, ape.id DESC`,
    [tournamentId],
  );

  let playerRows = eventsRes.rows;
  if (playerRows.length === 0) {
    const playersFallbackRes = await pool.query(
      `SELECT p.id AS player_id, p.name AS player_name, p.role AS player_role,
              p.category_id, c.name AS category_name, c.color_code,
              p.base_price, p.buy_price AS final_amount, p.status AS outcome,
              p.team_id AS sold_to_team_id, t.name AS sold_to_team_name,
              0 AS total_bids
       FROM players p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN teams t ON t.id = p.team_id
       WHERE p.tournament_id = $1
       ORDER BY p.id ASC`,
      [tournamentId],
    );
    playerRows = playersFallbackRes.rows;
  }

  // Fetch bid event counts per player for accurate competition metric
  const bidCountsRes = await pool.query(
    `SELECT player_id, COUNT(*)::int AS bid_count
     FROM auction_bid_events
     WHERE tournament_id = $1
     GROUP BY player_id`,
    [tournamentId],
  );
  const bidCountMap = new Map<number, number>();
  for (const b of bidCountsRes.rows) {
    bidCountMap.set(Number(b.player_id), Number(b.bid_count));
  }

  // Normalized player list
  interface NormalizedPlayer {
    playerId: number;
    playerName: string;
    role: string | null;
    categoryId: number | null;
    categoryName: string;
    colorCode: string | null;
    basePrice: number;
    finalAmount: number;
    outcome: string;
    soldToTeamId: number | null;
    soldToTeamName: string | null;
    totalBids: number;
  }

  const normalizedPlayers: NormalizedPlayer[] = playerRows.map((r: any) => {
    const pid = Number(r.player_id);
    const catId = r.category_id != null ? Number(r.category_id) : null;
    const catInfo = catId != null ? categoryMap.get(catId) : null;
    const catName = r.category_name || catInfo?.name || "General";
    const catColor = r.color_code || catInfo?.colorCode || null;
    const bidsFromMap = bidCountMap.get(pid) ?? 0;
    const bids = Math.max(Number(r.total_bids) || 0, bidsFromMap);

    return {
      playerId: pid,
      playerName: r.player_name || `Player #${pid}`,
      role: r.player_role || null,
      categoryId: catId,
      categoryName: catName,
      colorCode: catColor,
      basePrice: Math.max(0, Number(r.base_price) || 0),
      finalAmount: Math.max(0, Number(r.final_amount) || 0),
      outcome: (r.outcome || "").toLowerCase(),
      soldToTeamId: r.sold_to_team_id != null ? Number(r.sold_to_team_id) : null,
      soldToTeamName: r.sold_to_team_name || null,
      totalBids: bids,
    };
  });

  const soldLots = normalizedPlayers.filter((p) => p.outcome === "sold");
  const unsoldLots = normalizedPlayers.filter((p) => p.outcome === "unsold");

  const totalTurnover = soldLots.reduce((sum, p) => sum + p.finalAmount, 0);
  const lotCount = normalizedPlayers.length;
  const soldCount = soldLots.length;
  const unsoldCount = unsoldLots.length;
  const concludedCount = soldCount + unsoldCount;

  const soldRatio = concludedCount > 0 ? Number((soldCount / concludedCount).toFixed(4)) : 0;
  const unsoldRatio = concludedCount > 0 ? Number((unsoldCount / concludedCount).toFixed(4)) : 0;

  const tournamentAvgCostPerPlayer = soldCount > 0 ? Math.round(totalTurnover / soldCount) : 0;

  // Average inflation percentage across sold players with base price > 0
  const soldWithBase = soldLots.filter((p) => p.basePrice > 0);
  const totalInflation = soldWithBase.reduce((sum, p) => {
    const infl = ((p.finalAmount - p.basePrice) / p.basePrice) * 100;
    return sum + infl;
  }, 0);
  const averageInflationPct = soldWithBase.length > 0 ? Math.round(totalInflation / soldWithBase.length) : 0;

  // 5. Category Inflation Breakdown
  // Group all lots by category
  const categoryGroups = new Map<
    string,
    {
      categoryId: number | null;
      categoryName: string;
      colorCode: string | null;
      lots: NormalizedPlayer[];
    }
  >();

  // Ensure all configured categories are represented
  for (const c of categories) {
    categoryGroups.set(String(c.id), {
      categoryId: Number(c.id),
      categoryName: c.name,
      colorCode: c.color_code || null,
      lots: [],
    });
  }

  for (const p of normalizedPlayers) {
    const key = p.categoryId != null ? String(p.categoryId) : "uncategorized";
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, {
        categoryId: p.categoryId,
        categoryName: p.categoryName || "Uncategorized",
        colorCode: p.colorCode,
        lots: [],
      });
    }
    categoryGroups.get(key)!.lots.push(p);
  }

  const categoryBreakdown: CategoryInflationBreakdown[] = [];
  for (const group of Array.from(categoryGroups.values())) {
    const cLots = group.lots;
    const cSoldCount = cLots.filter((p) => p.outcome === "sold").length;
    const cUnsoldCount = cLots.filter((p) => p.outcome === "unsold").length;
    const cTotalSpent = cLots
      .filter((p) => p.outcome === "sold")
      .reduce((sum, p) => sum + p.finalAmount, 0);
    const soldWithBaseCat = cLots.filter((p) => p.outcome === "sold" && p.basePrice > 0);
    const avgBase =
      soldWithBaseCat.length > 0
        ? Math.round(soldWithBaseCat.reduce((sum, p) => sum + p.basePrice, 0) / soldWithBaseCat.length)
        : cLots.length > 0
          ? Math.round(cLots.reduce((sum, p) => sum + p.basePrice, 0) / cLots.length)
          : 0;
    const avgSold = cSoldCount > 0 ? Math.round(cTotalSpent / cSoldCount) : 0;
    const inflationPct = avgBase > 0 && avgSold > 0 ? Math.round(((avgSold - avgBase) / avgBase) * 100) : 0;

    categoryBreakdown.push({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      colorCode: group.colorCode,
      lotCount: cLots.length,
      soldCount: cSoldCount,
      unsoldCount: cUnsoldCount,
      totalSpent: cTotalSpent,
      averageBasePrice: avgBase,
      averageSoldPrice: avgSold,
      inflationPct,
    });
  }

  // 6. Moneyball Squad Efficiency Index
  const teamEfficiencies: MoneyballTeamEfficiency[] = [];

  for (const t of teams) {
    const teamId = Number(t.id);
    const effectivePurse = (Number(t.purse) || 0) + (Number(t.booster_total) || 0);
    const startingPurse = effectivePurse > 0 ? effectivePurse : basePurse;

    const teamSoldLots = soldLots.filter((p) => p.soldToTeamId === teamId);
    const playersBought = teamSoldLots.length;
    const spentFromLots = teamSoldLots.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalSpent = spentFromLots > 0 ? spentFromLots : Math.max(0, Number(t.purse_used) || 0);
    const remainingPurse = Math.max(0, startingPurse - totalSpent);

    const costPerPlayer = playersBought > 0 ? Math.round(totalSpent / playersBought) : 0;
    const costPerPlayerDiff = costPerPlayer - tournamentAvgCostPerPlayer;
    const costPerPlayerVariancePct =
      tournamentAvgCostPerPlayer > 0
        ? Math.round(((costPerPlayer - tournamentAvgCostPerPlayer) / tournamentAvgCostPerPlayer) * 100)
        : 0;

    const budgetDeploymentRate = startingPurse > 0 ? Number((totalSpent / startingPurse).toFixed(4)) : 0;
    const squadCompletionRate =
      targetSquadSize > 0 ? Number((Math.min(1, playersBought / targetSquadSize)).toFixed(4)) : 0;

    // Composite efficiency scoring (0–100):
    // 1. Squad completion (40 pts)
    const completionScore = Number((Math.min(1, playersBought / targetSquadSize) * 40).toFixed(1));

    // 2. Purse deployment (30 pts)
    let deploymentScore = 0;
    if (startingPurse === 0) {
      deploymentScore = 15;
    } else if (budgetDeploymentRate >= 0.8 && budgetDeploymentRate <= 1.0) {
      // 80% to 100% purse deployment is optimal moneyball execution
      deploymentScore = 30;
    } else if (budgetDeploymentRate < 0.8) {
      deploymentScore = Number(((budgetDeploymentRate / 0.8) * 30).toFixed(1));
    } else {
      // Overspent above 100%
      deploymentScore = Math.max(0, Number((30 - (budgetDeploymentRate - 1.0) * 50).toFixed(1)));
    }

    // 3. Cost-per-player efficiency vs market baseline (30 pts)
    let costEfficiencyScore = 0;
    if (playersBought === 0) {
      costEfficiencyScore = 0;
    } else if (tournamentAvgCostPerPlayer === 0) {
      costEfficiencyScore = 25;
    } else {
      const ratio = costPerPlayer / tournamentAvgCostPerPlayer;
      if (ratio <= 0.85) {
        costEfficiencyScore = 30; // Acquired squad at 15%+ discount
      } else if (ratio <= 1.0) {
        costEfficiencyScore = 27; // At or below market average
      } else if (ratio <= 1.25) {
        costEfficiencyScore = 22; // Modest premium
      } else if (ratio <= 1.5) {
        costEfficiencyScore = 16; // Moderate overpayment
      } else if (ratio <= 2.0) {
        costEfficiencyScore = 10;
      } else {
        costEfficiencyScore = Math.max(2, Math.round(30 - (ratio - 1.0) * 15));
      }
    }

    const rawTotal = completionScore + deploymentScore + costEfficiencyScore;
    const efficiencyScore =
      playersBought === 0 ? 0 : Math.min(100, Math.max(0, Math.round(rawTotal)));

    teamEfficiencies.push({
      teamId,
      teamName: t.name,
      shortCode: t.short_code || t.name.slice(0, 3).toUpperCase(),
      color: t.color || null,
      startingPurse,
      totalSpent,
      remainingPurse,
      playersBought,
      targetSquadSize,
      squadCompletionRate,
      costPerPlayer,
      costPerPlayerDiff,
      costPerPlayerVariancePct,
      budgetDeploymentRate,
      efficiencyScore,
      rank: 1, // calculated after sort
      breakdown: {
        completionScore,
        deploymentScore,
        costEfficiencyScore,
      },
    });
  }

  // Sort teams descending by efficiency score, then budget deployment, then players bought
  teamEfficiencies.sort((a, b) => {
    if (b.efficiencyScore !== a.efficiencyScore) {
      return b.efficiencyScore - a.efficiencyScore;
    }
    if (b.budgetDeploymentRate !== a.budgetDeploymentRate) {
      return b.budgetDeploymentRate - a.budgetDeploymentRate;
    }
    if (b.playersBought !== a.playersBought) {
      return b.playersBought - a.playersBought;
    }
    return a.costPerPlayer - b.costPerPlayer;
  });

  // Assign ranks
  teamEfficiencies.forEach((t, idx) => {
    t.rank = idx + 1;
  });

  // 7. Marquee & Value Highlights

  // Top 5 Bargain Steals (lowest multiplier above base price with competition/bids)
  const eligibleBargains = soldLots.filter((p) => p.finalAmount > 0 && p.basePrice > 0);
  eligibleBargains.sort((a, b) => {
    const multA = a.finalAmount / a.basePrice;
    const multB = b.finalAmount / b.basePrice;
    if (Math.abs(multA - multB) > 0.001) {
      return multA - multB; // lowest multiplier first
    }
    if (b.totalBids !== a.totalBids) {
      return b.totalBids - a.totalBids; // highest competition first
    }
    return a.finalAmount - b.finalAmount;
  });

  const topBargainSteals: BargainStealHighlight[] = eligibleBargains.slice(0, 5).map((p) => {
    const mult = Number((p.finalAmount / p.basePrice).toFixed(2));
    const savings = Math.max(0, tournamentAvgCostPerPlayer - p.finalAmount);
    return {
      playerId: p.playerId,
      playerName: p.playerName,
      role: p.role,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      teamId: p.soldToTeamId,
      teamName: p.soldToTeamName,
      basePrice: p.basePrice,
      finalAmount: p.finalAmount,
      multiplier: mult,
      totalBids: p.totalBids,
      savings,
    };
  });

  // Top 5 Record Breakers / Fiercest Bidding Wars (highest final amount & escalation)
  const eligibleWars = [...soldLots].filter((p) => p.finalAmount > 0);
  eligibleWars.sort((a, b) => {
    if (b.finalAmount !== a.finalAmount) {
      return b.finalAmount - a.finalAmount; // highest price first
    }
    if (b.totalBids !== a.totalBids) {
      return b.totalBids - a.totalBids; // most contested first
    }
    const escA = a.finalAmount - a.basePrice;
    const escB = b.finalAmount - b.basePrice;
    return escB - escA;
  });

  const topRecordBreakers: RecordBreakerHighlight[] = eligibleWars.slice(0, 5).map((p) => {
    const escalation = Math.max(0, p.finalAmount - p.basePrice);
    const inflationPct = p.basePrice > 0 ? Math.round(((p.finalAmount - p.basePrice) / p.basePrice) * 100) : 0;
    return {
      playerId: p.playerId,
      playerName: p.playerName,
      role: p.role,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      teamId: p.soldToTeamId,
      teamName: p.soldToTeamName,
      basePrice: p.basePrice,
      finalAmount: p.finalAmount,
      escalation,
      inflationPct,
      totalBids: p.totalBids,
    };
  });

  // Unsold Summary by category
  const unsoldByCategory: UnsoldCategorySummary[] = [];
  for (const group of Array.from(categoryGroups.values())) {
    const catUnsold = group.lots.filter((p) => p.outcome === "unsold");
    if (catUnsold.length > 0) {
      const totalBasePrice = catUnsold.reduce((sum, p) => sum + p.basePrice, 0);
      const samplePlayers = catUnsold.slice(0, 5).map((p) => ({
        id: p.playerId,
        name: p.playerName,
        role: p.role,
        basePrice: p.basePrice,
      }));

      unsoldByCategory.push({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        colorCode: group.colorCode,
        unsoldCount: catUnsold.length,
        totalBasePrice,
        samplePlayers,
      });
    }
  }

  // Sort unsold categories by unsold count descending
  unsoldByCategory.sort((a, b) => b.unsoldCount - a.unsoldCount);

  return {
    tournamentId: Number(tournament.id),
    tournamentName: tournament.name,
    sport: tournament.sport,
    status: tournament.status,
    generatedAt: new Date().toISOString(),
    moneyballIndex: teamEfficiencies,
    marketOverview: {
      totalTurnover,
      averageInflationPct,
      lotCount,
      soldCount,
      unsoldCount,
      soldRatio,
      unsoldRatio,
      tournamentAvgCostPerPlayer,
      categoryBreakdown,
    },
    highlights: {
      topBargainSteals,
      topRecordBreakers,
      unsoldByCategory,
    },
  };
}

/**
 * Formats structured post-mortem intelligence debrief into an executive CSV workbook.
 */
export function generatePostMortemCsv(report: PostMortemReport): string {
  const lines: string[] = [];

  // 1. Executive Summary
  lines.push("# ============================================================");
  lines.push("# TOURNAMENT MARKET EXECUTIVE SUMMARY");
  lines.push("# ============================================================");
  lines.push(
    [
      "Tournament",
      "Sport",
      "Status",
      "Total Turnover",
      "Average Inflation %",
      "Total Lots",
      "Sold Lots",
      "Unsold Lots",
      "Clearance Ratio",
      "Tournament Avg Cost/Player",
      "Report Generated At",
    ].map(csvEscape).join(","),
  );

  lines.push(
    [
      report.tournamentName,
      report.sport,
      report.status,
      report.marketOverview.totalTurnover,
      `${report.marketOverview.averageInflationPct}%`,
      report.marketOverview.lotCount,
      report.marketOverview.soldCount,
      report.marketOverview.unsoldCount,
      `${(report.marketOverview.soldRatio * 100).toFixed(1)}%`,
      report.marketOverview.tournamentAvgCostPerPlayer,
      report.generatedAt,
    ].map(csvEscape).join(","),
  );
  lines.push("");

  // 2. Moneyball Squad Efficiency Index Leaderboard
  lines.push("# ============================================================");
  lines.push("# MONEYBALL SQUAD EFFICIENCY INDEX LEADERBOARD");
  lines.push("# ============================================================");
  lines.push(
    [
      "Rank",
      "Team Name",
      "Short Code",
      "Starting Purse",
      "Total Spent",
      "Remaining Purse",
      "Players Bought",
      "Target Squad",
      "Squad Completion %",
      "Cost Per Player",
      "Cost Per Player Vs Avg",
      "Cost Variance %",
      "Budget Deployment Rate %",
      "Moneyball Score (0-100)",
    ].map(csvEscape).join(","),
  );

  for (const t of report.moneyballIndex) {
    lines.push(
      [
        t.rank,
        t.teamName,
        t.shortCode,
        t.startingPurse,
        t.totalSpent,
        t.remainingPurse,
        t.playersBought,
        t.targetSquadSize,
        `${(t.squadCompletionRate * 100).toFixed(1)}%`,
        t.costPerPlayer,
        t.costPerPlayerDiff,
        `${t.costPerPlayerVariancePct}%`,
        `${(t.budgetDeploymentRate * 100).toFixed(1)}%`,
        t.efficiencyScore,
      ].map(csvEscape).join(","),
    );
  }
  lines.push("");

  // 3. Category Market Breakdown
  lines.push("# ============================================================");
  lines.push("# CATEGORY MARKET BREAKDOWN & INFLATION");
  lines.push("# ============================================================");
  lines.push(
    [
      "Category",
      "Total Lots",
      "Sold Lots",
      "Unsold Lots",
      "Total Spent",
      "Avg Base Price",
      "Avg Sold Price",
      "Inflation %",
    ].map(csvEscape).join(","),
  );

  for (const c of report.marketOverview.categoryBreakdown) {
    lines.push(
      [
        c.categoryName,
        c.lotCount,
        c.soldCount,
        c.unsoldCount,
        c.totalSpent,
        c.averageBasePrice,
        c.averageSoldPrice,
        `${c.inflationPct}%`,
      ].map(csvEscape).join(","),
    );
  }
  lines.push("");

  // 4. Top 5 Bargain Steals
  lines.push("# ============================================================");
  lines.push("# TOP 5 BARGAIN STEALS (Lowest Multiplier with High Bids)");
  lines.push("# ============================================================");
  lines.push(
    [
      "Rank",
      "Player Name",
      "Role",
      "Category",
      "Winning Team",
      "Base Price",
      "Sold Price",
      "Price Multiplier",
      "Total Bids",
      "Savings vs Avg",
    ].map(csvEscape).join(","),
  );

  report.highlights.topBargainSteals.forEach((p, idx) => {
    lines.push(
      [
        idx + 1,
        p.playerName,
        p.role || "—",
        p.categoryName || "General",
        p.teamName || "—",
        p.basePrice,
        p.finalAmount,
        `${p.multiplier}x`,
        p.totalBids,
        p.savings,
      ].map(csvEscape).join(","),
    );
  });
  lines.push("");

  // 5. Top 5 Record Breakers
  lines.push("# ============================================================");
  lines.push("# TOP 5 RECORD BREAKERS & FIERCEST BIDDING WARS");
  lines.push("# ============================================================");
  lines.push(
    [
      "Rank",
      "Player Name",
      "Role",
      "Category",
      "Winning Team",
      "Base Price",
      "Final Amount",
      "Price Escalation",
      "Inflation %",
      "Total Bids",
    ].map(csvEscape).join(","),
  );

  report.highlights.topRecordBreakers.forEach((p, idx) => {
    lines.push(
      [
        idx + 1,
        p.playerName,
        p.role || "—",
        p.categoryName || "General",
        p.teamName || "—",
        p.basePrice,
        p.finalAmount,
        p.escalation,
        `${p.inflationPct}%`,
        p.totalBids,
      ].map(csvEscape).join(","),
    );
  });
  lines.push("");

  // 6. Unsold Summary
  lines.push("# ============================================================");
  lines.push("# UNSOLD LOTS SUMMARY BY CATEGORY");
  lines.push("# ============================================================");
  lines.push(
    [
      "Category",
      "Unsold Lots",
      "Total Unallocated Base Value",
      "Sample Unsold Players",
    ].map(csvEscape).join(","),
  );

  for (const u of report.highlights.unsoldByCategory) {
    const samples = u.samplePlayers.map((sp) => `${sp.name} (${sp.role || "Player"} - ${sp.basePrice})`).join("; ");
    lines.push(
      [
        u.categoryName,
        u.unsoldCount,
        u.totalBasePrice,
        samples,
      ].map(csvEscape).join(","),
    );
  }

  return lines.join("\n") + "\n";
}

/**
 * Generates an executive PDF report and streams it to the response.
 */
export async function streamPostMortemPdf(report: PostMortemReport, res: Response): Promise<void> {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const filename = `post-mortem-${report.tournamentId}-${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const cleanTournamentName = cleanPdfText(report.tournamentName);
  const cleanSport = cleanPdfText(report.sport).toUpperCase();

  // Brand header
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(20).text("BIDWAR EXECUTIVE POST-AUCTION DEBRIEF", { align: "left" });
  doc.fillColor("#475569").font("Helvetica").fontSize(10).text(`Tournament: ${cleanTournamentName} (${cleanSport})  •  Generated: ${new Date(report.generatedAt).toLocaleString("en-IN")}`);
  doc.moveDown(0.8);
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
  doc.moveDown(0.8);

  // Executive KPI summary box
  const startY = doc.y;
  doc.rect(36, startY, 523, 62).fillAndStroke("#f8fafc", "#e2e8f0");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("MARKET AT A GLANCE", 46, startY + 8);

  const colW = 125;
  const kpiY = startY + 24;

  doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("TOTAL TURNOVER", 46, kpiY);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(formatInr(report.marketOverview.totalTurnover), 46, kpiY + 11);

  doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("AVG INFLATION", 46 + colW, kpiY);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(`+${report.marketOverview.averageInflationPct}%`, 46 + colW, kpiY + 11);

  doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("CLEARANCE RATE", 46 + colW * 2, kpiY);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(`${(report.marketOverview.soldRatio * 100).toFixed(1)}% (${report.marketOverview.soldCount}/${report.marketOverview.lotCount})`, 46 + colW * 2, kpiY + 11);

  doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("AVG COST / PLAYER", 46 + colW * 3, kpiY);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(formatInr(report.marketOverview.tournamentAvgCostPerPlayer), 46 + colW * 3, kpiY + 11);

  doc.y = startY + 74;

  // Helper to draw leaderboard table header
  const drawTableHeader = (yPos: number) => {
    doc.rect(36, yPos, 523, 18).fill("#0f172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    doc.text("RANK", 42, yPos + 5);
    doc.text("TEAM", 80, yPos + 5);
    doc.text("SPENT / PURSE", 200, yPos + 5);
    doc.text("SQUAD", 320, yPos + 5);
    doc.text("AVG/PLAYER", 390, yPos + 5);
    doc.text("SCORE", 495, yPos + 5);
  };

  // Moneyball Efficiency Leaderboard
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("MONEYBALL SQUAD EFFICIENCY INDEX");
  doc.moveDown(0.4);

  let curY = doc.y;
  drawTableHeader(curY);
  curY += 20;

  if (report.moneyballIndex.length === 0) {
    doc.fillColor("#64748b").font("Helvetica-Oblique").fontSize(9).text("No teams registered in this tournament.", 46, curY + 4);
    curY += 24;
  } else {
    for (const t of report.moneyballIndex) {
      if (curY > 740) {
        doc.addPage();
        curY = 36;
        drawTableHeader(curY);
        curY += 20;
      }

      const isEven = t.rank % 2 === 0;
      if (isEven) {
        doc.rect(36, curY - 2, 523, 16).fill("#f1f5f9");
      }
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8);
      doc.text(`#${t.rank}`, 42, curY + 2);
      const cleanTeam = cleanPdfText(`${t.teamName} (${t.shortCode})`);
      doc.font("Helvetica").text(cleanTeam, 80, curY + 2, { width: 115, ellipsis: true });
      doc.text(`${formatInr(t.totalSpent)} / ${formatInr(t.startingPurse)}`, 200, curY + 2);
      doc.text(`${t.playersBought}/${t.targetSquadSize} (${(t.squadCompletionRate * 100).toFixed(0)}%)`, 320, curY + 2);
      doc.text(`${formatInr(t.costPerPlayer)}`, 390, curY + 2);

      const scoreColor = t.efficiencyScore >= 80 ? "#16a34a" : t.efficiencyScore >= 60 ? "#d97706" : "#dc2626";
      doc.fillColor(scoreColor).font("Helvetica-Bold").text(`${t.efficiencyScore}/100`, 495, curY + 2);

      curY += 16;
    }
  }

  doc.y = curY + 12;

  // Highlights Section
  if (doc.y > 600) {
    doc.addPage();
  }

  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("AUCTION MARQUEE HIGHLIGHTS");
  doc.moveDown(0.3);

  // Bargain Steals
  doc.fillColor("#0284c7").font("Helvetica-Bold").fontSize(10).text("* Top Bargain Steals (Value Picks)");
  doc.moveDown(0.2);
  if (report.highlights.topBargainSteals.length === 0) {
    doc.fillColor("#64748b").font("Helvetica-Oblique").fontSize(8.5).text("  No bargain steals recorded yet.");
  } else {
    for (const b of report.highlights.topBargainSteals) {
      if (doc.y > 730) doc.addPage();
      const pName = cleanPdfText(b.playerName);
      const pRole = cleanPdfText(b.role || "Player");
      const tName = cleanPdfText(b.teamName || "Unassigned");
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5).text(`• ${pName} (${pRole}) — ${tName}`);
      doc.fillColor("#475569").font("Helvetica").fontSize(8).text(`   Bought for ${formatInr(b.finalAmount)} (${b.multiplier}x base: ${formatInr(b.basePrice)}) after ${b.totalBids} bids.`);
    }
  }

  doc.moveDown(0.5);

  // Fiercest Bidding Wars
  if (doc.y > 680) doc.addPage();
  doc.fillColor("#e11d48").font("Helvetica-Bold").fontSize(10).text(">> Top Record Breakers & Bidding Duels");
  doc.moveDown(0.2);
  if (report.highlights.topRecordBreakers.length === 0) {
    doc.fillColor("#64748b").font("Helvetica-Oblique").fontSize(8.5).text("  No record breaking bids recorded yet.");
  } else {
    for (const w of report.highlights.topRecordBreakers) {
      if (doc.y > 730) doc.addPage();
      const pName = cleanPdfText(w.playerName);
      const pRole = cleanPdfText(w.role || "Player");
      const tName = cleanPdfText(w.teamName || "Unassigned");
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5).text(`• ${pName} (${pRole}) — ${tName}`);
      doc.fillColor("#475569").font("Helvetica").fontSize(8).text(`   Hammer fell at ${formatInr(w.finalAmount)} (+${w.inflationPct}% escalation: +${formatInr(w.escalation)}) with ${w.totalBids} bids.`);
    }
  }

  // Footer on bottom of current page
  doc.fontSize(8).fillColor("#94a3b8").text("BidWar Intelligence Engine  •  Automated Post-Auction Debrief", 36, 795, { align: "center", width: 523 });

  doc.end();
}
