/**
 * Deterministic VNBL rapid-bid stress harness.
 *
 * Real production logic:
 *   @workspace/api-base auction-bid-sync (monotonic gate, phase machine, timeouts)
 *   computeNextBidAmount
 *   Owner lifecycle control flow (useBidLifecycle)
 *   Operator bidGateLocked control flow (auction-operator handleBid)
 *
 * Mocked infrastructure only:
 *   Network latency, SSE transport, Database CAS, Timers (virtual clock)
 */

import { BID_ACK_TIMEOUT_MS, type BidMutationPayload } from "../../auction-bid-sync";
import { computeNextBidAmount } from "../../auction-bid";
import { ClientAuctionCache, type AuctionSnapshot } from "./client-cache";
import { OwnerBidLifecycle } from "./owner-lifecycle";
import { OperatorBidGate } from "./operator-gate";
import { createPrng, intBetween } from "./prng";
import { Timeline } from "./timeline";

/** Fixed seed — "VNBL" as hex. */
export const STRESS_SEED = 0x564e424c;

export type StressOptions = {
  seed?: number;
  teamCount?: number;
  bidEvents?: number;
  /** Production gate on (default). Set false to reproduce pre-fix VNBL hang. */
  useMonotonicGate?: boolean;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  /** Probability that HTTP ACK is scheduled after SSE (out-of-order). */
  outOfOrderHttpProb?: number;
  /** Fraction of taps that use owner lifecycle (rest use operator gate). */
  ownerBidRatio?: number;
};

export type StressResult = {
  passed: boolean;
  seed: number;
  teamCount: number;
  bidEvents: number;
  committedBids: number;
  conflicts409: number;
  staleHttpRejected: number;
  unlockReasons: Record<string, number>;
  timeline: Timeline;
  firstPermanentLockAt: number | null;
  failureMessage: string | null;
  finalClientLeader: number | null;
  finalServerLeader: number | null;
  finalVersion: number;
};

type QueuedTask = { at: number; seq: number; run: () => void };

class VirtualClock {
  now = 0;
  private seq = 0;
  private queue: QueuedTask[] = [];

  schedule(delayMs: number, fn: () => void): { cancel: () => void } {
    const task: QueuedTask = { at: this.now + Math.max(0, delayMs), seq: ++this.seq, run: fn };
    this.queue.push(task);
    this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
    return {
      cancel: () => {
        const i = this.queue.indexOf(task);
        if (i >= 0) this.queue.splice(i, 1);
      },
    };
  }

  async drain(until?: number): Promise<void> {
    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      if (until != null && next.at > until) {
        this.now = until;
        return;
      }
      this.queue.shift();
      this.now = next.at;
      next.run();
      // Flush promise reactions (.then / finally) scheduled by delivery handlers
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
  }

  advanceTo(t: number): void {
    this.now = Math.max(this.now, t);
  }
}

type ServerState = {
  revision: number;
  eventVersion: number;
  currentBid: number;
  currentBidTeamId: number | null;
  currentBidTeamName: string | null;
  bidIncrement: number;
  timerEndsAt: string;
};

const TEAM_NAMES = ["BLR", "MUM", "DEL", "KOL", "CHE", "HYD", "PUN", "RAJ", "GOA", "KER", "ASM", "BEN"];

export async function runRapidBidStress(options: StressOptions = {}): Promise<StressResult> {
  const seed = options.seed ?? STRESS_SEED;
  const rng = createPrng(seed);
  const teamCount = options.teamCount ?? intBetween(rng, 8, 12);
  const bidEvents = options.bidEvents ?? 1000;
  const useMonotonicGate = options.useMonotonicGate ?? true;
  const minLatency = options.minLatencyMs ?? 50;
  const maxLatency = options.maxLatencyMs ?? 500;
  const outOfOrderHttpProb = options.outOfOrderHttpProb ?? 0.45;

  const clock = new VirtualClock();
  // Far-future timer so canBid stays true for the whole war.
  const timerEndsAt = new Date(clock.now + 3_600_000).toISOString();
  const timeline = new Timeline();

  const teams = Array.from({ length: teamCount }, (_, i) => ({
    id: i + 1,
    name: TEAM_NAMES[i] ?? `T${i + 1}`,
  }));

  const server: ServerState = {
    revision: 1,
    eventVersion: 0,
    currentBid: 100_000,
    currentBidTeamId: null,
    currentBidTeamName: null,
    bidIncrement: 25_000,
    timerEndsAt,
  };

  const initial: AuctionSnapshot = {
    status: "active",
    currentPlayer: { id: 1, name: "Stress Player" },
    currentBid: server.currentBid,
    currentBidTeamId: null,
    currentBidTeamName: null,
    bidIncrement: server.bidIncrement,
    timerEndsAt,
    eventVersion: 0,
  };

  const cache = new ClientAuctionCache(
    initial,
    1,
    timeline,
    () => clock.now,
    useMonotonicGate,
  );

  const leadingPrev = new Map<number, boolean>();
  const canBidPrev = new Map<number, boolean>();
  let staleHttpRejected = 0;
  let conflicts409 = 0;
  let committedBids = 0;
  const unlockReasons: Record<string, number> = {};

  const recordUnlock = (reason: string) => {
    unlockReasons[reason] = (unlockReasons[reason] ?? 0) + 1;
  };

  const schedule = (delayMs: number, fn: () => void) => clock.schedule(delayMs, fn);

  const gate = new OperatorBidGate(1, timeline, () => clock.now, schedule, () => {
    snapshotTransitions();
  });

  const owners = new Map<number, OwnerBidLifecycle>();
  for (const team of teams) {
    owners.set(
      team.id,
      new OwnerBidLifecycle(1, team.id, timeline, () => clock.now, schedule, 0, 0),
    );
    leadingPrev.set(team.id, false);
    canBidPrev.set(team.id, true);
  }

  function snapshotTransitions(): void {
    for (const team of teams) {
      const owner = owners.get(team.id)!;
      const leading = cache.isLeading(team.id);
      const can = cache.canBid(team.id, {
        bidGateLocked: gate.locked,
        ownerBusy: owner.bidding,
      });
      if (leadingPrev.get(team.id) !== leading) {
        timeline.record({
          t: clock.now,
          kind: "isLeading",
          teamId: team.id,
          value: leading,
          eventVersion: cache.cachedVersion,
        });
        leadingPrev.set(team.id, leading);
      }
      if (canBidPrev.get(team.id) !== can) {
        timeline.record({
          t: clock.now,
          kind: "canBid",
          teamId: team.id,
          value: can,
          eventVersion: cache.cachedVersion,
          detail: gate.locked ? "gate_locked" : owner.bidding ? "owner_busy" : "",
        });
        canBidPrev.set(team.id, can);
      }
    }
  }

  function checkPermanentLocks(context: string): string | null {
    const lockedFor = gate.lockedForMs();
    if (lockedFor != null && lockedFor > BID_ACK_TIMEOUT_MS) {
      timeline.record({
        t: clock.now,
        kind: "permanent_lock",
        detail: `bidGateLocked held ${lockedFor}ms > ${BID_ACK_TIMEOUT_MS}ms (${context})`,
        value: lockedFor,
      });
      return `Operator bidGateLocked held ${lockedFor}ms beyond BID_ACK_TIMEOUT_MS at t=${clock.now} (${context})`;
    }
    for (const team of teams) {
      const owner = owners.get(team.id)!;
      if (owner.bidding) {
        // Owner busy only while phase===submitting; must clear by ACK timeout.
        // We detect via timeline: if still busy after timeout window from last submit,
        // the harness marks permanent_lock when advancing past timeout without unlock.
      }
    }
    return null;
  }

  type Inflight = {
    teamId: number;
    expectedRevision: number;
    amount: number;
    lockAt: number;
  };

  const ownerBusySince = new Map<number, number>();

  function trackOwnerBusy(): void {
    for (const team of teams) {
      const owner = owners.get(team.id)!;
      if (owner.bidding) {
        if (!ownerBusySince.has(team.id)) ownerBusySince.set(team.id, clock.now);
        const since = ownerBusySince.get(team.id)!;
        if (clock.now - since > BID_ACK_TIMEOUT_MS) {
          timeline.record({
            t: clock.now,
            kind: "permanent_lock",
            teamId: team.id,
            detail: `owner submitting held ${clock.now - since}ms > ${BID_ACK_TIMEOUT_MS}ms`,
            value: clock.now - since,
          });
        }
      } else {
        ownerBusySince.delete(team.id);
      }
    }
  }

  function deliverHttp(
    inflight: Inflight,
    payload: BidMutationPayload | { status: 409; error: string },
  ): void {
    const httpAckAt = clock.now;
    if ("status" in payload && payload.status === 409) {
      conflicts409 += 1;
      timeline.record({
        t: httpAckAt,
        kind: "http_409",
        teamId: inflight.teamId,
        detail: payload.error,
        httpAckAt,
      });
      return;
    }
    const ack = payload as BidMutationPayload;
    timeline.record({
      t: httpAckAt,
      kind: "http_ack",
      teamId: inflight.teamId,
      eventVersion: ack.eventVersion,
      value: ack.currentBid as number,
      httpAckAt,
      detail: `ack_latency_from_lock=${httpAckAt - inflight.lockAt}`,
    });
    const applied = cache.applyHttpAck(ack, inflight.teamId);
    if (applied === "rejected_stale") staleHttpRejected += 1;
    snapshotTransitions();
  }

  function deliverSse(msg: {
    version: number;
    currentBid: number;
    currentBidTeamId: number;
    currentBidTeamName: string;
    timerEndsAt: string;
    scheduledAt: number;
  }): void {
    timeline.record({
      t: clock.now,
      kind: "sse_bid",
      teamId: msg.currentBidTeamId,
      eventVersion: msg.version,
      value: msg.currentBid,
      sseAt: clock.now,
      detail: `sse_latency_from_commit=${clock.now - msg.scheduledAt}`,
    });
    cache.applySseBid(msg);
    snapshotTransitions();
  }

  /**
   * Mock DB CAS + dual delivery (HTTP ACK + SSE) with independent latencies.
   * Returns a promise that settles when HTTP completes (for owner/operator await).
   */
  function mockPlaceBid(teamId: number, amount: number): Promise<"success" | "leading" | "error"> {
    const lockAt = clock.now;
    const expectedRevision = server.revision;
    const inflight: Inflight = { teamId, expectedRevision, amount, lockAt };

    const sseLatency = intBetween(rng, minLatency, maxLatency);
    let httpLatency = intBetween(rng, minLatency, maxLatency);
    if (rng() < outOfOrderHttpProb) {
      // Force HTTP after SSE (classic stale-ACK race).
      httpLatency = sseLatency + intBetween(rng, 20, 200);
    } else if (rng() < 0.25) {
      // Force HTTP before SSE.
      httpLatency = Math.max(minLatency, sseLatency - intBetween(rng, 20, 150));
    }

    return new Promise((resolve) => {
      // Commit attempt runs at "network start" immediately; responses delayed.
      const commitNow = () => {
        if (server.revision !== expectedRevision) {
          schedule(httpLatency, () => {
            deliverHttp(inflight, { status: 409, error: "stale_bid" });
            resolve("error");
          });
          return;
        }
        // CAS success — extend timer like production bid path (enables equal-amount apply).
        server.revision += 1;
        server.eventVersion += 1;
        server.currentBid = amount;
        server.currentBidTeamId = teamId;
        server.currentBidTeamName = teams.find((t) => t.id === teamId)?.name ?? null;
        server.timerEndsAt = new Date(clock.now + 3_600_000).toISOString();
        committedBids += 1;
        const version = server.eventVersion;
        const commitAt = clock.now;
        const teamName = server.currentBidTeamName ?? "";
        const endsAt = server.timerEndsAt;

        const ackPayload: BidMutationPayload = {
          bidAck: true,
          eventVersion: version,
          currentBid: amount,
          currentBidTeamId: teamId,
          currentBidTeamName: teamName,
          timerEndsAt: endsAt,
        };

        schedule(sseLatency, () => {
          deliverSse({
            version,
            currentBid: amount,
            currentBidTeamId: teamId,
            currentBidTeamName: teamName,
            timerEndsAt: endsAt,
            scheduledAt: commitAt,
          });
        });

        schedule(httpLatency, () => {
          deliverHttp(inflight, ackPayload);
          // If client leader matches this team after apply, treat as leading.
          const leading = cache.isLeading(teamId);
          resolve(leading ? "leading" : "success");
        });
      };

      // Tiny processing delay (1ms) so concurrent taps can race revisions.
      schedule(1, commitNow);
    });
  }

  let failureMessage: string | null = null;
  let attempts = 0;
  let nextAttemptAt = 0;
  let wrongLeaderSince: number | null = null;
  /** Owner-heavy war matches VNBL cross-team owner clients (default 0.45 operator). */
  const ownerBidRatio = options.ownerBidRatio ?? 0.45;

  function checkWrongLeadingHang(context: string): string | null {
    const clientLeader = cache.snapshot.currentBidTeamId;
    const serverLeader = server.currentBidTeamId;
    if (
      clientLeader != null &&
      serverLeader != null &&
      clientLeader !== serverLeader
    ) {
      if (wrongLeaderSince == null) wrongLeaderSince = clock.now;
      const held = clock.now - wrongLeaderSince;
      if (held > BID_ACK_TIMEOUT_MS) {
        const msg =
          `Wrong isLeading held ${held}ms > ${BID_ACK_TIMEOUT_MS}ms ` +
          `(client=${clientLeader} server=${serverLeader}) at t=${clock.now} (${context})`;
        timeline.record({
          t: clock.now,
          kind: "permanent_lock",
          teamId: clientLeader,
          detail: msg,
          eventVersion: cache.cachedVersion,
          value: held,
        });
        return msg;
      }
    } else {
      wrongLeaderSince = null;
    }
    return null;
  }

  // Drive 1000 rapid bid attempts; spacing 5–40ms between taps (war conditions).
  while (attempts < bidEvents && !failureMessage) {
    if (clock.now < nextAttemptAt) {
      await clock.drain(nextAttemptAt);
    }

    trackOwnerBusy();
    failureMessage = checkPermanentLocks("mid_war") ?? checkWrongLeadingHang("mid_war");
    if (failureMessage) break;
    if (timeline.firstPermanentLock) {
      failureMessage = timeline.firstPermanentLock.detail ?? "permanent_lock";
      break;
    }

    // Prefer a team that canBid; else pick any non-leading for gate/busy coverage.
    const eligible = teams.filter((t) =>
      cache.canBid(t.id, {
        bidGateLocked: gate.locked,
        ownerBusy: owners.get(t.id)!.bidding,
      }),
    );
    const pool = eligible.length > 0 ? eligible : teams.filter((t) => !cache.isLeading(t.id));
    const team = pool.length > 0 ? pool[intBetween(rng, 0, pool.length - 1)]! : teams[intBetween(rng, 0, teams.length - 1)]!;

    const amount = computeNextBidAmount({
      currentBid: cache.snapshot.currentBid,
      bidIncrement: cache.snapshot.bidIncrement,
      currentBidTeamId: cache.snapshot.currentBidTeamId,
    });

    const useOperator = rng() >= ownerBidRatio;
    attempts += 1;
    timeline.record({
      t: clock.now,
      kind: "bid_attempt",
      teamId: team.id,
      value: amount,
      detail: useOperator ? "operator" : "owner",
      eventVersion: cache.cachedVersion,
    });

    if (useOperator) {
      if (gate.locked) {
        timeline.record({
          t: clock.now,
          kind: "bid_blocked",
          teamId: team.id,
          detail: "bidGateLocked",
        });
      } else {
        gate.lock(team.id, amount);
        snapshotTransitions();
        // Fire-and-forget like production mutateAsync + finally
        void mockPlaceBid(team.id, amount)
          .then((result) => {
            if (result === "success" || result === "leading") recordUnlock("success");
            else recordUnlock("finally");
          })
          .catch(() => {
            recordUnlock("finally");
          })
          .finally(() => {
            gate.unlockFromFinally(team.id);
            snapshotTransitions();
          });
      }
    } else {
      const owner = owners.get(team.id)!;
      const can = cache.canBid(team.id, {
        bidGateLocked: gate.locked,
        ownerBusy: false,
      });
      void owner
        .runBid(amount, (amt) => mockPlaceBid(team.id, amt), can && !gate.locked)
        .then((result) => {
          if (result === "blocked") return;
          if (result === "success" || result === "leading") recordUnlock("success");
          else if (result === "error") recordUnlock("finally");
          snapshotTransitions();
        });
    }

    nextAttemptAt = clock.now + intBetween(rng, 5, 40);
    // Process any due deliveries before next tap.
    await clock.drain(Math.min(nextAttemptAt, clock.now + 1));
    trackOwnerBusy();
  }

  // Drain remaining network / unlock timers far enough to cover ACK timeout.
  const drainUntil = clock.now + BID_ACK_TIMEOUT_MS + 2_000;
  while (clock.now < drainUntil) {
    const before = clock.now;
    await clock.drain(Math.min(drainUntil, clock.now + 100));
    trackOwnerBusy();
    if (!failureMessage) {
      failureMessage = checkPermanentLocks("drain") ?? checkWrongLeadingHang("drain");
    }
    if (timeline.firstPermanentLock && !failureMessage) {
      failureMessage = timeline.firstPermanentLock.detail ?? "permanent_lock";
    }
    if (clock.now === before) {
      clock.advanceTo(Math.min(drainUntil, clock.now + 100));
    }
  }
  await clock.drain();

  // Post-settle invariant: client leader must match server (VNBL stuck HIGHEST BIDDER).
  if (!failureMessage) {
    if (cache.snapshot.currentBidTeamId !== server.currentBidTeamId) {
      failureMessage =
        `Client leader ${cache.snapshot.currentBidTeamId} != server leader ${server.currentBidTeamId} ` +
        `(version client=${cache.cachedVersion} server=${server.eventVersion}) — permanent wrong isLeading`;
      timeline.record({
        t: clock.now,
        kind: "permanent_lock",
        teamId: cache.snapshot.currentBidTeamId ?? undefined,
        detail: failureMessage,
        eventVersion: cache.cachedVersion,
      });
    }
  }

  if (!failureMessage && gate.locked) {
    failureMessage = `bidGateLocked still true after drain at t=${clock.now}`;
    timeline.record({
      t: clock.now,
      kind: "permanent_lock",
      detail: failureMessage,
      value: true,
    });
  }

  for (const team of teams) {
    const owner = owners.get(team.id)!;
    if (owner.bidding && !failureMessage) {
      failureMessage = `Owner team ${team.id} still submitting after drain`;
      timeline.record({
        t: clock.now,
        kind: "permanent_lock",
        teamId: team.id,
        detail: failureMessage,
      });
    }
  }

  timeline.record({
    t: clock.now,
    kind: "invariant",
    detail: failureMessage ? `FAIL: ${failureMessage}` : "PASS: no permanent lock",
    eventVersion: cache.cachedVersion,
    value: server.currentBidTeamId,
  });

  return {
    passed: !failureMessage && !timeline.firstPermanentLock,
    seed,
    teamCount,
    bidEvents: attempts,
    committedBids,
    conflicts409,
    staleHttpRejected,
    unlockReasons,
    timeline,
    firstPermanentLockAt: timeline.firstPermanentLock?.t ?? null,
    failureMessage: failureMessage ?? (timeline.firstPermanentLock?.detail ?? null),
    finalClientLeader: cache.snapshot.currentBidTeamId,
    finalServerLeader: server.currentBidTeamId,
    finalVersion: cache.cachedVersion,
  };
}
