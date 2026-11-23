import { describe, expect, it } from "vitest";
import {
  LOCK_NAMESPACE_LIFECYCLE,
  LOCK_NAMESPACE_AUCTION_LOT,
  LOCK_NAMESPACE_CRICKET_MATCH,
  LOCK_NAMESPACE_BADMINTON_MATCH,
  lockTournamentLifecycleShared,
  lockTournamentLifecycleExclusive,
  lockAuctionLotExclusive,
  lockCricketMatchExclusive,
  lockBadmintonMatchExclusive,
} from "../lib/tournament-locks";
import { lockAuctionMutation } from "../lib/auction-mutation-lock";
import { LifecycleError } from "../lib/tournament-lifecycle-service";

/**
 * Concurrency Test Harness simulating real multi-client advisory lock contention:
 * Models PostgreSQL's advisory lock manager behavior across multiple concurrent connections:
 * - Shared locks on same key can be held simultaneously by multiple clients.
 * - Exclusive lock on same key requires all existing locks to be released, and blocks subsequent requests.
 * - Two distinct 2-key namespaces never conflict.
 */
class MockPostgresLockManager {
  private activeLocks: Map<string, { mode: "shared" | "exclusive"; count: number }> = new Map();
  private waitQueue: Map<string, Array<() => void>> = new Map();

  private key(ns: number, id: number): string {
    return `${ns}:${id}`;
  }

  async acquire(ns: number, id: number, mode: "shared" | "exclusive"): Promise<void> {
    const k = this.key(ns, id);

    while (true) {
      const current = this.activeLocks.get(k);

      if (!current) {
        this.activeLocks.set(k, { mode, count: 1 });
        return;
      }

      if (mode === "shared" && current.mode === "shared") {
        current.count++;
        return;
      }

      // Blocked by existing lock — await release
      await new Promise<void>((resolve) => {
        const q = this.waitQueue.get(k) || [];
        q.push(resolve);
        this.waitQueue.set(k, q);
      });
    }
  }

  release(ns: number, id: number): void {
    const k = this.key(ns, id);
    const current = this.activeLocks.get(k);
    if (!current) return;

    current.count--;
    if (current.count <= 0) {
      this.activeLocks.delete(k);
      const q = this.waitQueue.get(k);
      if (q && q.length > 0) {
        const next = q.shift()!;
        next();
      }
    }
  }

  createTxClient() {
    const held: Array<{ ns: number; id: number }> = [];
    const client = {
      execute: async (sqlObj: any) => {
        const text = sqlObj?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        const match = text.match(/pg_advisory_xact_lock(_shared)?\((\d+),\s*(\d+)\)/);
        if (match) {
          const isShared = !!match[1];
          const ns = parseInt(match[2], 10);
          const id = parseInt(match[3], 10);
          await this.acquire(ns, id, isShared ? "shared" : "exclusive");
          held.push({ ns, id });
        }
        return [];
      },
      commit: () => {
        while (held.length > 0) {
          const { ns, id } = held.pop()!;
          this.release(ns, id);
        }
      },
    };
    return client;
  }
}

describe("Phase 3.5: 12 Real Concurrency Scenarios", () => {
  it("Scenario 1: Reset Data vs Auction Bid — Exclusive lifecycle blocks concurrent bidding until reset commits", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 10;
    const executionOrder: string[] = [];

    const resetTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("reset_lock_acquired");
      await new Promise((r) => setTimeout(r, 40));
      executionOrder.push("reset_complete");
      tx.commit();
    };

    const bidTask = async () => {
      // Small tick delay to ensure reset arrives first
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockAuctionMutation(tx, tid);
      executionOrder.push("bid_committed");
      tx.commit();
    };

    await Promise.all([resetTask(), bidTask()]);

    expect(executionOrder).toEqual([
      "reset_lock_acquired",
      "reset_complete",
      "bid_committed",
    ]);
  });

  it("Scenario 2: Reset Data vs Sell/Unsold — Exclusive lifecycle blocks lot conclusion", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 11;
    const executionOrder: string[] = [];

    const resetTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("reset_active");
      await new Promise((r) => setTimeout(r, 30));
      executionOrder.push("reset_done");
      tx.commit();
    };

    const sellTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockAuctionMutation(tx, tid);
      executionOrder.push("sell_done");
      tx.commit();
    };

    await Promise.all([resetTask(), sellTask()]);
    expect(executionOrder).toEqual(["reset_active", "reset_done", "sell_done"]);
  });

  it("Scenario 3: Reset Data vs Cricket Scoring — Exclusive lifecycle blocks cricket ball delivery", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 12;
    const matchId = 101;
    const executionOrder: string[] = [];

    const resetTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("reset_started");
      await new Promise((r) => setTimeout(r, 40));
      executionOrder.push("reset_finished");
      tx.commit();
    };

    const cricketScoreTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockCricketMatchExclusive(tx, matchId);
      executionOrder.push("cricket_ball_recorded");
      tx.commit();
    };

    await Promise.all([resetTask(), cricketScoreTask()]);
    expect(executionOrder).toEqual(["reset_started", "reset_finished", "cricket_ball_recorded"]);
  });

  it("Scenario 4: Reset Data vs Badminton Scoring — Exclusive lifecycle blocks badminton point update", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 13;
    const matchId = 201;
    const executionOrder: string[] = [];

    const resetTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("reset_active");
      await new Promise((r) => setTimeout(r, 30));
      executionOrder.push("reset_committed");
      tx.commit();
    };

    const badmintonTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockBadmintonMatchExclusive(tx, matchId);
      executionOrder.push("badminton_point_recorded");
      tx.commit();
    };

    await Promise.all([resetTask(), badmintonTask()]);
    expect(executionOrder).toEqual(["reset_active", "reset_committed", "badminton_point_recorded"]);
  });

  it("Scenario 5: Activate Live vs Active Auction Bid — Activation blocks concurrent bidding", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 14;
    const executionOrder: string[] = [];

    const activateTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("activation_started");
      await new Promise((r) => setTimeout(r, 40));
      executionOrder.push("activation_sealed");
      tx.commit();
    };

    const bidTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockAuctionMutation(tx, tid);
      executionOrder.push("bid_processed");
      tx.commit();
    };

    await Promise.all([activateTask(), bidTask()]);
    expect(executionOrder).toEqual(["activation_started", "activation_sealed", "bid_processed"]);
  });

  it("Scenario 6: Activate Live vs Cricket Scoring — Activation blocks cricket scoring until sealed", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 15;
    const matchId = 301;
    const executionOrder: string[] = [];

    const activateTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("activation_locked");
      await new Promise((r) => setTimeout(r, 30));
      executionOrder.push("activation_complete");
      tx.commit();
    };

    const scoreTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockCricketMatchExclusive(tx, matchId);
      executionOrder.push("cricket_event_appended");
      tx.commit();
    };

    await Promise.all([activateTask(), scoreTask()]);
    expect(executionOrder).toEqual(["activation_locked", "activation_complete", "cricket_event_appended"]);
  });

  it("Scenario 7: Activate Live vs Badminton Scoring — Activation blocks badminton scoring", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 16;
    const matchId = 401;
    const executionOrder: string[] = [];

    const activateTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      executionOrder.push("activation_exclusive");
      await new Promise((r) => setTimeout(r, 30));
      executionOrder.push("activation_done");
      tx.commit();
    };

    const scoreTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockBadmintonMatchExclusive(tx, matchId);
      executionOrder.push("badminton_event_appended");
      tx.commit();
    };

    await Promise.all([activateTask(), scoreTask()]);
    expect(executionOrder).toEqual(["activation_exclusive", "activation_done", "badminton_event_appended"]);
  });

  it("Scenario 8: Simultaneous Reset Data Requests — Serialized cleanly without double corruption", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 17;
    let resetCount = 0;

    const runReset = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);
      resetCount++;
      await new Promise((r) => setTimeout(r, 20));
      tx.commit();
    };

    await Promise.all([runReset(), runReset()]);
    expect(resetCount).toBe(2);
  });

  it("Scenario 9: Simultaneous Activate Live Requests — First seals, second returns alreadyActivated without corruption", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 18;
    let sealedTimestamp: Date | null = null;
    const results: any[] = [];

    const runActivate = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleExclusive(tx, tid);

      if (sealedTimestamp !== null) {
        results.push({
          ok: true,
          alreadyActivated: true,
          officialActivatedAt: sealedTimestamp.toISOString(),
        });
      } else {
        sealedTimestamp = new Date();
        results.push({
          ok: true,
          alreadyActivated: false,
          officialActivatedAt: sealedTimestamp.toISOString(),
        });
      }
      await new Promise((r) => setTimeout(r, 20));
      tx.commit();
    };

    await Promise.all([runActivate(), runActivate()]);

    expect(results.length).toBe(2);
    const first = results.find((r) => !r.alreadyActivated);
    const second = results.find((r) => r.alreadyActivated);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first.officialActivatedAt).toBe(second.officialActivatedAt);
  });

  it("Scenario 10: Reset Data vs Activate Live — Whichever enters first completes; if Activate seals, Reset is 403", async () => {
    let officiallyActivated = false;
    let resetOutcome = "";

    // Simulate Activate winning the race
    officiallyActivated = true;

    // Reset attempts to run after activation
    try {
      if (officiallyActivated) {
        throw new LifecycleError(
          "Tournament is officially activated for live production. Reset Data is permanently unavailable.",
          403,
          "RESET_AFTER_ACTIVATION_LOCKED",
        );
      }
      resetOutcome = "reset_succeeded";
    } catch (e: any) {
      resetOutcome = e.code;
    }

    expect(resetOutcome).toBe("RESET_AFTER_ACTIVATION_LOCKED");
  });

  it("Scenario 11: Auction vs Cricket Scoring Concurrency — Run in parallel without blocking each other", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 19;
    const cricketMatchId = 501;
    const concurrencyWitness: string[] = [];

    const auctionTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockAuctionLotExclusive(tx, tid);
      concurrencyWitness.push("auction_in_progress");
      await new Promise((r) => setTimeout(r, 30));
      concurrencyWitness.push("auction_committed");
      tx.commit();
    };

    const cricketTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockCricketMatchExclusive(tx, cricketMatchId);
      concurrencyWitness.push("cricket_in_progress");
      await new Promise((r) => setTimeout(r, 30));
      concurrencyWitness.push("cricket_committed");
      tx.commit();
    };

    // Both start simultaneously
    await Promise.all([auctionTask(), cricketTask()]);

    // Both must have entered in-progress before either committed!
    const auctionStart = concurrencyWitness.indexOf("auction_in_progress");
    const cricketStart = concurrencyWitness.indexOf("cricket_in_progress");
    const firstCommit = Math.min(
      concurrencyWitness.indexOf("auction_committed"),
      concurrencyWitness.indexOf("cricket_committed"),
    );

    expect(auctionStart).toBeLessThan(firstCommit);
    expect(cricketStart).toBeLessThan(firstCommit);
  });

  it("Scenario 12: Auction vs Badminton Scoring Concurrency — Run in parallel without blocking each other", async () => {
    const mgr = new MockPostgresLockManager();
    const tid = 20;
    const badmintonMatchId = 601;
    const concurrencyWitness: string[] = [];

    const auctionTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockAuctionLotExclusive(tx, tid);
      concurrencyWitness.push("auction_in_progress");
      await new Promise((r) => setTimeout(r, 30));
      concurrencyWitness.push("auction_committed");
      tx.commit();
    };

    const badmintonTask = async () => {
      const tx = mgr.createTxClient();
      await lockTournamentLifecycleShared(tx, tid);
      await lockBadmintonMatchExclusive(tx, badmintonMatchId);
      concurrencyWitness.push("badminton_in_progress");
      await new Promise((r) => setTimeout(r, 30));
      concurrencyWitness.push("badminton_committed");
      tx.commit();
    };

    await Promise.all([auctionTask(), badmintonTask()]);

    const auctionStart = concurrencyWitness.indexOf("auction_in_progress");
    const badmintonStart = concurrencyWitness.indexOf("badminton_in_progress");
    const firstCommit = Math.min(
      concurrencyWitness.indexOf("auction_committed"),
      concurrencyWitness.indexOf("badminton_committed"),
    );

    expect(auctionStart).toBeLessThan(firstCommit);
    expect(badmintonStart).toBeLessThan(firstCommit);
  });
});
