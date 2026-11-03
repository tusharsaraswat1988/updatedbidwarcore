import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import path from "path";

async function loadNormalized(relPath: string) {
  const fullPath = path.resolve(__dirname, relPath);
  const raw = await readFile(fullPath, "utf8");
  return raw.replace(/\r\n/g, "\n");
}

describe("SEC-2026-01: Auction Transaction Lock Detachment", () => {
  it("verifies POST /auction/bid uses tx.update instead of global db.update inside transaction", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    // Extract the /auction/bid handler
    const bidHandlerStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/bid"');
    expect(bidHandlerStart).toBeGreaterThan(0);
    const bidHandlerEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/sell"', bidHandlerStart);
    const bidHandlerCode = src.slice(bidHandlerStart, bidHandlerEnd);

    // Verify advisory transaction lock is called with tx
    expect(bidHandlerCode).toContain("await lockAuctionMutation(tx, tid);");
    // Verify tx.update(auctionSessionsTable) is used (not db.update)
    expect(bidHandlerCode).toContain("return tx\n      .update(auctionSessionsTable)");
    expect(bidHandlerCode).not.toContain("return db\n    .update(auctionSessionsTable)");
    expect(bidHandlerCode).not.toContain("return db\n      .update(auctionSessionsTable)");
  });

  it("verifies optimistic concurrency CAS revision check is enforced on tx.update", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    const bidHandlerStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/bid"');
    const bidHandlerEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/sell"', bidHandlerStart);
    const bidHandlerCode = src.slice(bidHandlerStart, bidHandlerEnd);

    expect(bidHandlerCode).toContain("sql`COALESCE(${auctionSessionsTable.revision}, 0) = ${currentRevision}`");
    expect(bidHandlerCode).toContain("if (committed.length === 0)");
    expect(bidHandlerCode).toContain("hint: \"stale_bid\"");
  });
});

describe("SEC-2026-02: Manual-Sell Squad Capacity & Status Enforcement", () => {
  it("verifies manual-sell enforces maximumSquadSize and category limits", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    const manualSellStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/manual-sell"');
    const manualSellEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/unsold"', manualSellStart);
    const manualSellCode = src.slice(manualSellStart, manualSellEnd);

    // Maximum squad size checks
    expect(manualSellCode).toContain("if (maximumSquadSize > 0)");
    expect(manualSellCode).toContain("Maximum squad size reached");

    // Category limits checks
    expect(manualSellCode).toContain("cat?.maxPlayers && cat.maxPlayers > 0");
    expect(manualSellCode).toContain("Category limit reached");
  });

  it("verifies manual-sell requires player to be currently 'available' in tx.update", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    const manualSellStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/manual-sell"');
    const manualSellEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/unsold"', manualSellStart);
    const manualSellCode = src.slice(manualSellStart, manualSellEnd);

    // Atomic status check within transaction
    expect(manualSellCode).toContain('eq(playersTable.status, "available")');
    expect(manualSellCode).toContain('throw new ManualSellTransactionAbortError("player_not_available")');
    expect(manualSellCode).toContain('hint: "already_sold"');
  });
});

describe("SEC-2026-03: ₹0 Manual Sale Undo Stack & Bids Durability", () => {
  it("verifies bidsTable record is always inserted for manual sell even when amount is 0", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    const manualSellStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/manual-sell"');
    const manualSellEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/unsold"', manualSellStart);
    const manualSellCode = src.slice(manualSellStart, manualSellEnd);

    // Bids record insertion must NOT be guarded by `if (amount > 0)`
    expect(manualSellCode).toContain("await tx.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });");
    
    // Only purse decrement is guarded by amount > 0
    const purseUpdateIdx = manualSellCode.indexOf("if (amount > 0)");
    const bidsInsertIdx = manualSellCode.indexOf("await tx.insert(bidsTable)");
    expect(purseUpdateIdx).toBeGreaterThan(0);
    expect(bidsInsertIdx).toBeGreaterThan(0);
  });

  it("verifies undo handler cleanly handles ₹0 sales and sequential LIFO reversals", async () => {
    const src = await loadNormalized("../routes/auction.ts");

    const undoStart = src.indexOf('router.post("/tournaments/:tournamentId/auction/undo"');
    const undoEnd = src.indexOf('router.post("/tournaments/:tournamentId/auction/display-overlay"', undoStart);
    const undoCode = src.slice(undoStart, undoEnd);

    // Bids ordering is LIFO by desc timestamp
    expect(undoCode).toContain("orderBy(desc(bidsTable.timestamp))");
    expect(undoCode).toContain("GREATEST(0, COALESCE(purse_used, 0) - ${bid.amount})");
    expect(undoCode).toContain("await tx.delete(bidsTable).where(eq(bidsTable.id, bid.id))");
  });
});

describe("SEC-2026-04: Existing Player Profile Takeover Protection", () => {
  it("verifies unauthenticated public registration fails closed on existing mobile without leaking PII", async () => {
    const src = await loadNormalized("../routes/players.ts");

    const handleRegStart = src.indexOf("async function handlePublicPlayerRegistration");
    expect(handleRegStart).toBeGreaterThan(0);
    const handleRegCode = src.slice(handleRegStart);

    expect(handleRegCode).toContain("const existingDup = await findDuplicatePlayerMobile(tid, mobileNumber);");
    expect(handleRegCode).toContain("const isOrganizer = await canAccessPrivateTournamentData(req, tid);");
    expect(handleRegCode).toContain("if (!isOrganizer)");
    expect(handleRegCode).toContain('code: "PLAYER_ALREADY_REGISTERED"');
    expect(handleRegCode).toContain("This mobile number is already registered in this tournament");
    
    // Ensure no name or id leakage in the error response
    expect(handleRegCode).not.toContain("${existingDup.name}");
    expect(handleRegCode).not.toContain("${existing.name}");
  });
});

describe("SEC-2026-05: Scorer Zero-Assignment Global Access Bypass Removal", () => {
  it("assertScorerMayAccessTournament removes zero-assignment bypass and requires assignment", async () => {
    const src = await loadNormalized("../lib/scorer-auth.ts");

    const fnStart = src.indexOf("export async function assertScorerMayAccessTournament");
    expect(fnStart).toBeGreaterThan(0);
    const fnSlice = src.slice(fnStart, fnStart + 600);

    // The dangerous short circuit must be absent
    expect(fnSlice).not.toContain("assignedCount === 0");
    expect(fnSlice).not.toContain("if (assignedCount === 0) return;");
    
    // Strict assignment check must be present
    expect(fnSlice).toContain("const ok = await isScorerAssignedToTournament(scorerId, tournamentId);");
    expect(fnSlice).toContain("throw new ScorerAuthError(");
    expect(fnSlice).toContain('"TOURNAMENT_NOT_ASSIGNED"');
  });

  it("verifies ScorerAuthError class structure and properties in scorer-auth.ts", async () => {
    const src = await loadNormalized("../lib/scorer-auth.ts");
    expect(src).toContain("export class ScorerAuthError extends Error");
    expect(src).toContain("public readonly code: string");
    expect(src).toContain("public readonly status: number");
    expect(src).toContain('this.name = "ScorerAuthError"');
  });
});
