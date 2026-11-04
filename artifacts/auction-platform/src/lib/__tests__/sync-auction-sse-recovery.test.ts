import { describe, expect, it, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  applyAuctionSseMessage,
  getCachedVersion,
  resetCachedVersion,
  resetCachedVersionsForTests,
} from "../sync-auction-sse";
import { getGetAuctionStateQueryKey } from "@workspace/api-client-react";

describe("SSE Recovery & Client Cursor Reset (P1 Remediation)", () => {
  const TID = 42;
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
    resetCachedVersionsForTests();
  });

  it("resets client cursor and cache when receiving an authoritative snapshot after a future cursor", () => {
    // 1. Simulate client having a corrupt or future cursor (e.g. 99999)
    resetCachedVersion(TID, 99999);
    expect(getCachedVersion(TID)).toBe(99999);

    // 2. Authoritative snapshot frame arrives from server with revision/version 15
    const snapshotPayload = {
      type: "auction_state",
      version: 15,
      tournamentId: TID,
      state: {
        status: "active",
        currentBid: 150000,
        currentBidTeamId: 101,
        revision: 15,
        teamPurses: [
          { teamId: 101, teamName: "Alpha", purse: 1000000, purseUsed: 150000, maxPurse: 1000000 },
        ],
      },
      invalidate: [],
    };

    applyAuctionSseMessage(qc, TID, snapshotPayload as any);

    // 3. Assert client cursor was reset from 99999 down to authoritative version 15
    expect(getCachedVersion(TID)).toBe(15);

    // 4. Assert client React Query cache holds the authoritative state
    const cachedState = qc.getQueryData<any>(getGetAuctionStateQueryKey(TID));
    expect(cachedState).toBeDefined();
    expect(cachedState.status).toBe("active");
    expect(cachedState.currentBid).toBe(150000);
    expect(cachedState.eventVersion).toBe(15);
  });

  it("applies next valid delta exactly once without version regression", () => {
    // 1. Establish base state via snapshot at version 15
    resetCachedVersion(TID, 15);
    qc.setQueryData(getGetAuctionStateQueryKey(TID), {
      status: "active",
      currentBid: 150000,
      currentBidTeamId: 101,
      eventVersion: 15,
      timerEndsAt: "2026-11-04T12:00:10.000Z",
    });

    // 2. Next valid forward delta arrives with version 16
    const bidDelta16 = {
      type: "bid",
      version: 16,
      tournamentId: TID,
      playerId: 501,
      currentBid: 200000,
      currentBidTeamId: 102,
      currentBidTeamName: "Beta",
      timerEndsAt: "2026-11-04T12:00:25.000Z",
    };

    applyAuctionSseMessage(qc, TID, bidDelta16 as any);

    // 3. Assert delta applied and cursor advanced to 16
    expect(getCachedVersion(TID)).toBe(16);
    let state = qc.getQueryData<any>(getGetAuctionStateQueryKey(TID));
    expect(state.currentBid).toBe(200000);
    expect(state.currentBidTeamId).toBe(102);

    // 4. Duplicate delta arrives with version 16 (retry or duplicate broadcast)
    const duplicateDelta16 = {
      type: "bid",
      version: 16,
      tournamentId: TID,
      playerId: 501,
      currentBid: 200000,
      currentBidTeamId: 102,
      currentBidTeamName: "Beta",
      timerEndsAt: "2026-11-04T12:00:25.000Z",
    };

    applyAuctionSseMessage(qc, TID, duplicateDelta16 as any);
    expect(getCachedVersion(TID)).toBe(16);

    // 5. Stale older delta arrives with version 15 (out of order delivery)
    const staleDelta15 = {
      type: "bid",
      version: 15,
      tournamentId: TID,
      playerId: 501,
      currentBid: 175000,
      currentBidTeamId: 103,
      currentBidTeamName: "Gamma",
      timerEndsAt: "2026-11-04T12:00:15.000Z",
    };

    applyAuctionSseMessage(qc, TID, staleDelta15 as any);

    // 6. Assert cursor and state did not regress
    expect(getCachedVersion(TID)).toBe(16);
    state = qc.getQueryData<any>(getGetAuctionStateQueryKey(TID));
    expect(state.currentBid).toBe(200000);
    expect(state.currentBidTeamId).toBe(102);
  });
});
