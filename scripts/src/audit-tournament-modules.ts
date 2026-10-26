/**
 * BidWar Phase 1 - Tournament Module Read-Only Audit Script
 *
 * MANDATORY CONTRACT (PHASE 1):
 * - Strictly READ-ONLY. No database mutations, writes, or updates.
 * - Inspects existing tournaments and gathers evidence across auction and scoring tables.
 * - Applies Ground Truth rules:
 *   1. Cricket scoring was NEVER used in real production tournaments (all existing cricket scoring is test/dev data).
 *   2. Badminton scoring HAS real production history (e.g. VNBL 3.0) and must be preserved.
 *   3. Real auction history (bids, sold players, financial purse) must always be preserved.
 *   4. Explicit auction_enabled & scoring_enabled values take precedence over legacy licenseType.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/audit-tournament-modules.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  bidsTable,
  playersTable,
  auctionSessionsTable,
  scoringMatchesTable,
  badmintonCategoriesTable,
  badmintonFixturesTable,
} from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

export type AuditConfidence = "high" | "medium" | "low";
export type ProposedProductMode = "auction_only" | "scoring_only" | "both";

export interface TournamentAuditRecord {
  id: number;
  name: string;
  sport: string;
  status: string;
  licenseType: string | null;
  currentAuctionEnabled: boolean;
  currentScoringEnabled: boolean;
  evidence: {
    totalBids: number;
    soldPlayers: number;
    totalPlayers: number;
    hasAuctionSession: boolean;
    scoringMatchesCount: number;
    badmintonCategoriesCount: number;
    badmintonFixturesCount: number;
  };
  proposedMode: ProposedProductMode;
  proposedAuctionEnabled: boolean;
  proposedScoringEnabled: boolean;
  confidence: AuditConfidence;
  reason: string;
  productionNote?: string;
}

async function runAudit() {
  console.log("================================================================================");
  console.log("BIDWAR PHASE 1 — TOURNAMENT MODULE READ-ONLY AUDIT");
  console.log("================================================================================");
  console.log("MODE: STRICTLY READ-ONLY (No database mutations, no backfill applied)\n");

  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.id);

  console.log(`Found ${tournaments.length} tournament(s) to inspect.\n`);

  const auditRecords: TournamentAuditRecord[] = [];

  for (const t of tournaments) {
    // 1. Auction evidence
    const [bidCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bidsTable)
      .where(eq(bidsTable.tournamentId, t.id));
    const totalBids = bidCountRow?.count ?? 0;

    const [soldPlayersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playersTable)
      .where(sql`${playersTable.tournamentId} = ${t.id} AND ${playersTable.status} = 'sold'`);
    const soldPlayers = soldPlayersRow?.count ?? 0;

    const [totalPlayersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, t.id));
    const totalPlayers = totalPlayersRow?.count ?? 0;

    const [sessionRow] = await db
      .select({ id: auctionSessionsTable.id })
      .from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, t.id))
      .limit(1);
    const hasAuctionSession = !!sessionRow;

    // 2. Scoring evidence
    const [matchesRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scoringMatchesTable)
      .where(eq(scoringMatchesTable.tournamentId, t.id));
    const scoringMatchesCount = matchesRow?.count ?? 0;

    const [badmintonCatRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(badmintonCategoriesTable)
      .where(eq(badmintonCategoriesTable.tournamentId, t.id));
    const badmintonCategoriesCount = badmintonCatRow?.count ?? 0;

    const [badmintonFixRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(badmintonFixturesTable)
      .where(eq(badmintonFixturesTable.tournamentId, t.id));
    const badmintonFixturesCount = badmintonFixRow?.count ?? 0;

    const evidence = {
      totalBids,
      soldPlayers,
      totalPlayers,
      hasAuctionSession,
      scoringMatchesCount,
      badmintonCategoriesCount,
      badmintonFixturesCount,
    };

    const hasRealAuctionActivity = totalBids > 0 || soldPlayers > 0 || hasAuctionSession;
    const isBadminton = t.sport?.toLowerCase() === "badminton";
    const isCricket = t.sport?.toLowerCase() === "cricket";
    const hasBadmintonScoringActivity =
      isBadminton && (scoringMatchesCount > 0 || badmintonCategoriesCount > 0 || badmintonFixturesCount > 0);
    const hasCricketScoringActivity = isCricket && scoringMatchesCount > 0;

    let proposedMode: ProposedProductMode;
    let proposedAuctionEnabled: boolean;
    let proposedScoringEnabled: boolean;
    let confidence: AuditConfidence;
    let reason: string;
    let productionNote: string | undefined;

    // Apply ground truth heuristics:
    if (isBadminton && hasBadmintonScoringActivity) {
      if (hasRealAuctionActivity) {
        proposedMode = "both";
        proposedAuctionEnabled = true;
        proposedScoringEnabled = true;
        confidence = "high";
        reason = `Badminton tournament with both real auction activity (${totalBids} bids, ${soldPlayers} sold) and scoring activity (${scoringMatchesCount} matches, ${badmintonCategoriesCount} categories). Production hybrid mode.`;
      } else {
        proposedMode = "scoring_only";
        proposedAuctionEnabled = false;
        proposedScoringEnabled = true;
        confidence = "high";
        reason = `Real Badminton scoring tournament (${scoringMatchesCount} matches, ${badmintonCategoriesCount} categories, ${badmintonFixturesCount} fixtures) with no auction activity. Production scoring-only.`;
      }
    } else if (isCricket && hasCricketScoringActivity) {
      // Ground truth: Cricket scoring was NEVER used in a real production tournament.
      proposedMode = "auction_only";
      proposedAuctionEnabled = true;
      proposedScoringEnabled = false;
      confidence = "high";
      reason = `Cricket tournament has ${scoringMatchesCount} scoring matches, but per ground truth cricket scoring was never used in production (test data). Classified as auction_only.`;
      productionNote = `Historical cricket scoring matches detected (${scoringMatchesCount}). Flagged as test/staging data.`;
    } else if (hasRealAuctionActivity) {
      proposedMode = "auction_only";
      proposedAuctionEnabled = true;
      proposedScoringEnabled = false;
      confidence = "high";
      reason = `Real auction activity present (${totalBids} bids, ${soldPlayers} sold players, session: ${hasAuctionSession}) with no production scoring activity.`;
    } else {
      // No active bids or matches yet. Check configured flags / licenseType.
      const isScoringConfigured = t.scoringEnabled === true;
      if (isBadminton && isScoringConfigured) {
        proposedMode = "scoring_only";
        proposedAuctionEnabled = false;
        proposedScoringEnabled = true;
        confidence = "medium";
        reason = "Badminton tournament configured with scoringEnabled=true and 0 auction bids. Proposed as scoring_only.";
      } else {
        proposedMode = "auction_only";
        proposedAuctionEnabled = true;
        proposedScoringEnabled = false;
        confidence = "medium";
        reason = "No auction activity and no scoring activity recorded. Defaulting to auction_only.";
      }
    }

    auditRecords.push({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      licenseType: t.licenseType ?? null,
      currentAuctionEnabled: (t as any).auctionEnabled ?? true,
      currentScoringEnabled: t.scoringEnabled ?? false,
      evidence,
      proposedMode,
      proposedAuctionEnabled,
      proposedScoringEnabled,
      confidence,
      reason,
      productionNote,
    });
  }

  // Display report
  console.log("--------------------------------------------------------------------------------");
  console.log("AUDIT RESULTS TABLE");
  console.log("--------------------------------------------------------------------------------");
  console.table(
    auditRecords.map((r) => ({
      ID: r.id,
      Name: r.name.length > 25 ? r.name.substring(0, 22) + "..." : r.name,
      Sport: r.sport,
      "Cur Auction": r.currentAuctionEnabled,
      "Cur Scoring": r.currentScoringEnabled,
      "Prop Mode": r.proposedMode,
      "Prop Auction": r.proposedAuctionEnabled,
      "Prop Scoring": r.proposedScoringEnabled,
      Confidence: r.confidence,
    })),
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("DETAILED RATIONALE & EVIDENCE PER TOURNAMENT");
  console.log("--------------------------------------------------------------------------------");
  for (const r of auditRecords) {
    console.log(`[Tournament #${r.id}] "${r.name}" (${r.sport}, status: ${r.status})`);
    console.log(`  Current State:  auctionEnabled=${r.currentAuctionEnabled}, scoringEnabled=${r.currentScoringEnabled}, licenseType=${r.licenseType}`);
    console.log(`  Evidence:       Bids=${r.evidence.totalBids}, SoldPlayers=${r.evidence.soldPlayers}/${r.evidence.totalPlayers}, Session=${r.evidence.hasAuctionSession}, Matches=${r.evidence.scoringMatchesCount}, BadmintonCategories=${r.evidence.badmintonCategoriesCount}, BadmintonFixtures=${r.evidence.badmintonFixturesCount}`);
    console.log(`  Proposed State: productMode=${r.proposedMode} (auctionEnabled=${r.proposedAuctionEnabled}, scoringEnabled=${r.proposedScoringEnabled}) [Confidence: ${r.confidence.toUpperCase()}]`);
    console.log(`  Reason:         ${r.reason}`);
    if (r.productionNote) {
      console.log(`  Notice:         ${r.productionNote}`);
    }
    console.log("");
  }

  const candidateAuctionOnly = auditRecords.filter((r) => r.proposedMode === "auction_only").map((r) => r.id);
  const candidateScoringOnly = auditRecords.filter((r) => r.proposedMode === "scoring_only").map((r) => r.id);
  const candidateBoth = auditRecords.filter((r) => r.proposedMode === "both").map((r) => r.id);

  console.log("--------------------------------------------------------------------------------");
  console.log("CANDIDATE TOURNAMENT ID SUMMARY");
  console.log("--------------------------------------------------------------------------------");
  console.log(`- Proposed auction_only (${candidateAuctionOnly.length}): [${candidateAuctionOnly.join(", ")}]`);
  console.log(`- Proposed scoring_only (${candidateScoringOnly.length}): [${candidateScoringOnly.join(", ")}]`);
  console.log(`- Proposed both         (${candidateBoth.length}): [${candidateBoth.join(", ")}]`);

  console.log("\n================================================================================");
  console.log("VERIFICATION CONFIRMATION:");
  console.log("  - Zero database mutations performed.");
  console.log("  - Existing auction history was NOT modified.");
  console.log("  - Existing scoring history was NOT modified.");
  console.log("  - No production data was mutated.");
  console.log("================================================================================\n");
}

runAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Audit script failed with error:", err);
    process.exit(1);
  });
