import { db as defaultDb } from "@workspace/db";
import {
  playersTable,
  tournamentsTable,
  teamsTable,
  globalPlayersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { parseIndianMobile } from "@workspace/api-base/mobile";

export interface PlayerAuctionHistoryRecord {
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: string;
  soldPrice: number;
  buyingTeamName?: string | null;
  buyingTeamColor?: string | null;
  isTop5: boolean;
  top5BadgeText?: string;
  tournamentDate?: string | null;
  auctionUnit?: string | null;
}

export interface PlayerAuctionHistorySummary {
  records: PlayerAuctionHistoryRecord[];
  totalSoldAppearances: number;
  bestSoldRecord: PlayerAuctionHistoryRecord | null;
  lastSoldRecord: PlayerAuctionHistoryRecord | null;
  hasTop5Badge: boolean;
  isBestTop5: boolean;
}

export interface CandidateHistoricalRow {
  playerId: number;
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: string;
  soldPrice: number;
  buyingTeamName?: string | null;
  buyingTeamColor?: string | null;
  tournamentDate?: string | null;
  auctionUnit?: string | null;
}

export interface TournamentSoldPlayerRankEntry {
  playerId: number;
  soldPrice: number;
}

/**
 * Standard competition ranking (1224 ranking / SQL RANK() equivalent).
 * Returns a map of playerId -> rank (1-indexed).
 * Players tied at the 5th-highest price will both receive rank 5.
 */
export function computeTournamentSoldRanks(
  players: TournamentSoldPlayerRankEntry[],
): Map<number, number> {
  const validPlayers = players
    .filter((p) => typeof p.soldPrice === "number" && p.soldPrice > 0)
    .sort((a, b) => b.soldPrice - a.soldPrice);

  const ranks = new Map<number, number>();
  let currentRank = 1;

  for (let i = 0; i < validPlayers.length; i++) {
    const current = validPlayers[i]!;
    if (i > 0 && current.soldPrice < validPlayers[i - 1]!.soldPrice) {
      currentRank = i + 1;
    }
    ranks.set(current.playerId, currentRank);
  }

  return ranks;
}

/**
 * Resolves whether a given sold player was among the Top 5 in their tournament.
 */
export function isPlayerTop5InTournament(
  playerId: number,
  tournamentSoldPlayers: TournamentSoldPlayerRankEntry[],
): boolean {
  const ranks = computeTournamentSoldRanks(tournamentSoldPlayers);
  const playerRank = ranks.get(playerId);
  return typeof playerRank === "number" && playerRank <= 5;
}

/**
 * Filter, deduplicate, sort, and select top 3 historical records.
 * - Excludes currently active tournament.
 * - Deduplicates by tournament (keeps highest sold price if duplicate exists).
 * - Sorts by sold price DESC.
 * - Takes up to 3 records.
 */
export function processHistoricalAuctionCandidates(
  candidates: CandidateHistoricalRow[],
  currentTournamentId: number,
  maxCount: number = 3,
): CandidateHistoricalRow[] {
  // Exclude current tournament
  const valid = candidates.filter(
    (c) => c.tournamentId !== currentTournamentId && c.soldPrice > 0,
  );

  // Deduplicate per tournament: keep the one with highest sold price, or highest id
  const byTournament = new Map<number, CandidateHistoricalRow>();
  for (const row of valid) {
    const existing = byTournament.get(row.tournamentId);
    if (!existing) {
      byTournament.set(row.tournamentId, row);
    } else if (
      row.soldPrice > existing.soldPrice ||
      (row.soldPrice === existing.soldPrice && row.playerId > existing.playerId)
    ) {
      byTournament.set(row.tournamentId, row);
    }
  }

  // Sort by sold price descending (best auction performance first)
  const sorted = Array.from(byTournament.values()).sort((a, b) => {
    if (b.soldPrice !== a.soldPrice) {
      return b.soldPrice - a.soldPrice;
    }
    return b.playerId - a.playerId;
  });

  return sorted.slice(0, maxCount);
}

/**
 * Filter, deduplicate, sort, and assemble full historical auction performance summary.
 * Computes:
 * - records: Top 3 previous sold appearances sorted by soldPrice DESC
 * - bestSoldRecord: Historically highest sold record (top3[0])
 * - lastSoldRecord: Chronologically most recent tournament sale (from all tournaments, NOT top 3)
 * - hasTop5Badge / isBestTop5: Whether top 5 recognition applies
 */
export function processHistoricalAuctionSummary(
  candidates: CandidateHistoricalRow[],
  currentTournamentId: number,
  top5Map: Map<number, boolean> = new Map(),
  maxCount: number = 3,
): PlayerAuctionHistorySummary {
  const valid = candidates.filter(
    (c) => c.tournamentId !== currentTournamentId && c.soldPrice > 0,
  );

  if (valid.length === 0) {
    return {
      records: [],
      totalSoldAppearances: 0,
      bestSoldRecord: null,
      lastSoldRecord: null,
      hasTop5Badge: false,
      isBestTop5: false,
    };
  }

  // Deduplicate per tournament: keep the one with highest sold price, or highest id
  const byTournament = new Map<number, CandidateHistoricalRow>();
  for (const row of valid) {
    const existing = byTournament.get(row.tournamentId);
    if (!existing) {
      byTournament.set(row.tournamentId, row);
    } else if (
      row.soldPrice > existing.soldPrice ||
      (row.soldPrice === existing.soldPrice && row.playerId > existing.playerId)
    ) {
      byTournament.set(row.tournamentId, row);
    }
  }

  const allDeduped = Array.from(byTournament.values());

  // Top records by sold price descending (best auction performance first)
  const sortedByPrice = [...allDeduped].sort((a, b) => {
    if (b.soldPrice !== a.soldPrice) {
      return b.soldPrice - a.soldPrice;
    }
    return b.playerId - a.playerId;
  });
  const topRecords = sortedByPrice.slice(0, maxCount);

  // Chronologically latest record (most recent previous tournament sale)
  const sortedChronological = [...allDeduped].sort((a, b) => {
    if (a.tournamentDate && b.tournamentDate) {
      const tA = new Date(a.tournamentDate).getTime();
      const tB = new Date(b.tournamentDate).getTime();
      if (!isNaN(tA) && !isNaN(tB) && tB !== tA) {
        return tB - tA;
      }
    }
    if (b.tournamentId !== a.tournamentId) {
      return b.tournamentId - a.tournamentId;
    }
    return b.playerId - a.playerId;
  });
  const lastSoldCandidate = sortedChronological[0] || null;

  const mapToRecord = (rec: CandidateHistoricalRow): PlayerAuctionHistoryRecord => {
    const isTop5 = top5Map.get(rec.playerId) ?? false;
    return {
      tournamentId: rec.tournamentId,
      tournamentName: rec.tournamentName,
      tournamentStatus: rec.tournamentStatus,
      soldPrice: rec.soldPrice,
      buyingTeamName: rec.buyingTeamName ?? null,
      buyingTeamColor: rec.buyingTeamColor ?? null,
      isTop5,
      top5BadgeText: isTop5 ? "🏆 TOP 5 STAR" : undefined,
      tournamentDate: rec.tournamentDate ?? null,
      auctionUnit: rec.auctionUnit ?? null,
    };
  };

  const records = topRecords.map(mapToRecord);
  const bestSoldRecord = records[0] || null;
  const lastSoldRecord = lastSoldCandidate ? mapToRecord(lastSoldCandidate) : null;
  const hasTop5Badge = records.some((r) => r.isTop5) || Boolean(lastSoldRecord?.isTop5);
  const isBestTop5 = Boolean(bestSoldRecord?.isTop5);

  return {
    records,
    totalSoldAppearances: allDeduped.length,
    bestSoldRecord,
    lastSoldRecord,
    hasTop5Badge,
    isBestTop5,
  };
}

export interface GetAuctionHistoryParams {
  currentTournamentId: number;
  playerId?: number;
  globalPlayerId?: string | null;
  mobileNumber?: string | null;
  dbClient?: typeof defaultDb;
}

export async function getPlayerAuctionPerformanceSummary({
  currentTournamentId,
  playerId,
  globalPlayerId,
  mobileNumber,
  dbClient = defaultDb,
}: GetAuctionHistoryParams): Promise<PlayerAuctionHistorySummary | null> {
  let targetGlobalPlayerId: string | null = globalPlayerId ?? null;
  let targetMobileNumber: string | null = null;

  if (mobileNumber) {
    const parsed = parseIndianMobile(mobileNumber);
    if (parsed.ok) {
      targetMobileNumber = parsed.normalized;
    } else {
      const digits = mobileNumber.replace(/\D/g, "");
      if (digits.length >= 10) {
        targetMobileNumber = digits.slice(-10);
      }
    }
  }

  // 1. If playerId is provided, load the tournament player row
  if (typeof playerId === "number" && !isNaN(playerId)) {
    const [playerRow] = await dbClient
      .select({
        id: playersTable.id,
        tournamentId: playersTable.tournamentId,
        globalPlayerId: playersTable.globalPlayerId,
        mobileNumber: playersTable.mobileNumber,
      })
      .from(playersTable)
      .where(eq(playersTable.id, playerId))
      .limit(1);

    if (!playerRow) {
      return null;
    }

    if (playerRow.globalPlayerId && !targetGlobalPlayerId) {
      targetGlobalPlayerId = playerRow.globalPlayerId;
    }

    if (playerRow.mobileNumber && !targetMobileNumber) {
      const parsed = parseIndianMobile(playerRow.mobileNumber);
      if (parsed.ok) {
        targetMobileNumber = parsed.normalized;
      } else {
        const digits = playerRow.mobileNumber.replace(/\D/g, "");
        if (digits.length >= 10) {
          targetMobileNumber = digits.slice(-10);
        }
      }
    }
  }

  // 2. Strict identity requirement: DO NOT match by name alone!
  // If neither globalPlayerId nor valid mobileNumber is available, return empty summary.
  if (!targetGlobalPlayerId && !targetMobileNumber) {
    return {
      records: [],
      totalSoldAppearances: 0,
      bestSoldRecord: null,
      lastSoldRecord: null,
      hasTop5Badge: false,
      isBestTop5: false,
    };
  }

  // 3. Bidirectional global_players identity linking enrichment
  if (targetGlobalPlayerId && !targetMobileNumber) {
    const [gp] = await dbClient
      .select({ mobileNumber: globalPlayersTable.mobileNumber })
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, targetGlobalPlayerId))
      .limit(1);
    if (gp?.mobileNumber) {
      const parsed = parseIndianMobile(gp.mobileNumber);
      if (parsed.ok) {
        targetMobileNumber = parsed.normalized;
      } else {
        const d = gp.mobileNumber.replace(/\D/g, "");
        if (d.length >= 10) targetMobileNumber = d.slice(-10);
      }
    }
  } else if (targetMobileNumber && !targetGlobalPlayerId) {
    const [gp] = await dbClient
      .select({ id: globalPlayersTable.id })
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, targetMobileNumber))
      .limit(1);
    if (gp?.id) {
      targetGlobalPlayerId = gp.id;
    }
  }

  // 4. Query candidate historical SOLD records
  // Must be SOLD, sold_price > 0, status = 'sold', and tournament != currentTournamentId.
  const queryResult = await dbClient.execute(sql`
    SELECT
      p.id AS "playerId",
      p.tournament_id AS "tournamentId",
      p.sold_price AS "soldPrice",
      t.name AS "tournamentName",
      t.status AS "tournamentStatus",
      t.auction_unit AS "auctionUnit",
      t.auction_date AS "tournamentDate",
      tm.name AS "buyingTeamName",
      tm.color AS "buyingTeamColor"
    FROM players p
    INNER JOIN tournaments t ON t.id = p.tournament_id
    LEFT JOIN teams tm ON tm.id = p.team_id
    WHERE p.tournament_id != ${currentTournamentId}
      AND p.status = 'sold'
      AND p.sold_price IS NOT NULL
      AND p.sold_price > 0
      AND (
        (${targetGlobalPlayerId}::text IS NOT NULL AND p.global_player_id = ${targetGlobalPlayerId})
        OR
        (${targetMobileNumber}::text IS NOT NULL AND (
          p.mobile_number = ${targetMobileNumber}
          OR p.mobile_number LIKE ${"%" + targetMobileNumber}
        ))
      )
  `);

  const rawRows = (queryResult.rows || []) as Array<{
    playerId: number;
    tournamentId: number;
    soldPrice: number;
    tournamentName: string;
    tournamentStatus: string;
    auctionUnit: string | null;
    tournamentDate: string | null;
    buyingTeamName: string | null;
    buyingTeamColor: string | null;
  }>;

  const candidates: CandidateHistoricalRow[] = rawRows.map((r) => ({
    playerId: Number(r.playerId),
    tournamentId: Number(r.tournamentId),
    soldPrice: Number(r.soldPrice),
    tournamentName: String(r.tournamentName),
    tournamentStatus: String(r.tournamentStatus),
    auctionUnit: r.auctionUnit,
    tournamentDate: r.tournamentDate,
    buyingTeamName: r.buyingTeamName,
    buyingTeamColor: r.buyingTeamColor,
  }));

  const initialSummary = processHistoricalAuctionSummary(candidates, currentTournamentId, new Map(), 3);
  if (initialSummary.totalSoldAppearances === 0) {
    return initialSummary;
  }

  // 5. Calculate Top 5 Special Recognition for all relevant tournaments
  const relevantTournaments = new Set<number>();
  for (const r of initialSummary.records) {
    relevantTournaments.add(r.tournamentId);
  }
  if (initialSummary.lastSoldRecord) {
    relevantTournaments.add(initialSummary.lastSoldRecord.tournamentId);
  }

  const relevantCandidates = candidates.filter((c) => relevantTournaments.has(c.tournamentId));
  const tournamentIds = Array.from(relevantTournaments);
  const playerIds = relevantCandidates.map((c) => c.playerId);

  const top5QueryResult = await dbClient.execute(sql`
    WITH tournament_sold_ranks AS (
      SELECT
        p.id AS player_id,
        p.tournament_id,
        p.sold_price,
        RANK() OVER (
          PARTITION BY p.tournament_id
          ORDER BY p.sold_price DESC
        ) AS rank
      FROM players p
      WHERE p.tournament_id IN (${sql.join(tournamentIds.map((id) => sql`${id}`), sql`, `)})
        AND p.status = 'sold'
        AND p.sold_price IS NOT NULL
        AND p.sold_price > 0
    )
    SELECT
      player_id,
      tournament_id,
      rank,
      (rank <= 5) AS is_top_5
    FROM tournament_sold_ranks
    WHERE player_id IN (${sql.join(playerIds.map((id) => sql`${id}`), sql`, `)})
  `);

  const top5Map = new Map<number, boolean>();
  for (const row of (top5QueryResult.rows || []) as Array<{
    player_id: number;
    is_top_5: boolean;
  }>) {
    top5Map.set(Number(row.player_id), Boolean(row.is_top_5));
  }

  return processHistoricalAuctionSummary(candidates, currentTournamentId, top5Map, 3);
}

export async function getPlayerAuctionPerformanceHistory(
  params: GetAuctionHistoryParams,
): Promise<PlayerAuctionHistoryRecord[] | null> {
  const summary = await getPlayerAuctionPerformanceSummary(params);
  if (summary === null) return null;
  return summary.records;
}
