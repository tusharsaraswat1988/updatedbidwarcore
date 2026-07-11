/**
 * Minimal deterministic reproduction of the P0 VNBL hang:
 * SSE applies newer leader → delayed HTTP ACK for older version overwrites
 * when the monotonic gate is disabled (pre-3702aa2 behavior).
 */

import { BID_ACK_TIMEOUT_MS } from "../../auction-bid-sync";
import { ClientAuctionCache, type AuctionSnapshot } from "./client-cache";
import { Timeline } from "./timeline";

export type VnblReproResult = {
  passed: boolean;
  failureMessage: string | null;
  firstPermanentLockAt: number | null;
  timeline: Timeline;
  clientLeader: number | null;
  serverLeader: number;
};

export function reproduceVnblStaleHttpAfterSse(): VnblReproResult {
  let now = 0;
  const timeline = new Timeline();
  const timerEndsAt = new Date(3_600_000).toISOString();

  const initial: AuctionSnapshot = {
    status: "active",
    currentPlayer: { id: 1, name: "Stress Player" },
    currentBid: 100_000,
    currentBidTeamId: null,
    currentBidTeamName: null,
    bidIncrement: 25_000,
    timerEndsAt,
    eventVersion: 0,
  };

  // Gate OFF = pre-fix blind HTTP apply
  const cache = new ClientAuctionCache(initial, 1, timeline, () => now, false);

  const tA = 1;
  const tB = 2;
  const ends1 = new Date(3_610_000).toISOString();
  const ends2 = new Date(3_620_000).toISOString();

  // 1) Team A commits v1 — SSE arrives first
  cache.applySseBid({
    version: 1,
    currentBid: 100_000,
    currentBidTeamId: tA,
    currentBidTeamName: "BLR",
    timerEndsAt: ends1,
  });
  timeline.record({
    t: now,
    kind: "sse_bid",
    teamId: tA,
    eventVersion: 1,
    detail: "A_sse_v1",
  });

  // 2) Team B commits v2 — SSE arrives; client correctly sees B leading
  now = 100;
  cache.applySseBid({
    version: 2,
    currentBid: 125_000,
    currentBidTeamId: tB,
    currentBidTeamName: "MUM",
    timerEndsAt: ends2,
  });
  timeline.record({
    t: now,
    kind: "isLeading",
    teamId: tB,
    value: true,
    eventVersion: 2,
    detail: "B_correct_leader",
  });

  // 3) Late HTTP ACK for A v1 arrives and blindly overwrites (VNBL hang class)
  now = 400;
  cache.applyHttpAck(
    {
      bidAck: true,
      eventVersion: 1,
      currentBid: 100_000,
      currentBidTeamId: tA,
      currentBidTeamName: "BLR",
      timerEndsAt: ends1,
    },
    tA,
  );
  timeline.record({
    t: now,
    kind: "http_ack",
    teamId: tA,
    eventVersion: 1,
    detail: "stale_A_http_after_B_sse",
  });

  const serverLeader = tB;
  const clientLeader = cache.snapshot.currentBidTeamId;

  // 4) No corrective SSE — wrong isLeading persists past ACK timeout
  now = 400 + BID_ACK_TIMEOUT_MS + 1;
  const wrong = clientLeader !== serverLeader;
  if (wrong) {
    timeline.record({
      t: now,
      kind: "permanent_lock",
      teamId: clientLeader ?? undefined,
      detail: `Wrong isLeading after stale HTTP (client=${clientLeader} server=${serverLeader}) held past BID_ACK_TIMEOUT_MS`,
      eventVersion: cache.cachedVersion,
    });
  }

  const failureMessage = wrong
    ? `VNBL repro: client leader ${clientLeader} != server ${serverLeader} after stale HTTP ACK (gate off)`
    : null;

  return {
    passed: !wrong,
    failureMessage,
    firstPermanentLockAt: timeline.firstPermanentLock?.t ?? null,
    timeline,
    clientLeader,
    serverLeader,
  };
}
