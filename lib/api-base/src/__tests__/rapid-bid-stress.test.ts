import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BID_ACK_TIMEOUT_MS, decideBidMutationApply } from "../auction-bid-sync";
import { runRapidBidStress, STRESS_SEED } from "./rapid-bid-stress/harness";
import { reproduceVnblStaleHttpAfterSse } from "./rapid-bid-stress/vnbl-repro";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = join(HERE, "../../../../artifacts");
const TIMELINE_JSON = join(ARTIFACT_DIR, "rapid-bid-stress-timeline.json");
const TIMELINE_MD = join(ARTIFACT_DIR, "rapid-bid-stress-timeline.md");

function writeArtifacts(
  label: string,
  result: {
    passed: boolean;
    seed?: number;
    teamCount?: number;
    bidEvents?: number;
    committedBids?: number;
    conflicts409?: number;
    staleHttpRejected?: number;
    unlockReasons?: Record<string, number>;
    firstPermanentLockAt: number | null;
    failureMessage: string | null;
    finalClientLeader?: number | null;
    finalServerLeader?: number | null;
    finalVersion?: number;
    timeline: {
      events: unknown[];
      firstPermanentLock: unknown;
      sliceAround: (t: number, w?: number) => unknown;
      toMarkdown: () => string;
    };
  },
): void {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const first = result.timeline.firstPermanentLock as { t: number } | null;
  const payload = {
    label,
    passed: result.passed,
    seed: result.seed,
    teamCount: result.teamCount,
    bidEvents: result.bidEvents,
    committedBids: result.committedBids,
    conflicts409: result.conflicts409,
    staleHttpRejected: result.staleHttpRejected,
    unlockReasons: result.unlockReasons,
    firstPermanentLockAt: result.firstPermanentLockAt,
    failureMessage: result.failureMessage,
    finalClientLeader: result.finalClientLeader,
    finalServerLeader: result.finalServerLeader,
    finalVersion: result.finalVersion,
    bidAckTimeoutMs: BID_ACK_TIMEOUT_MS,
    firstPermanentLock: first,
    windowAroundFirstLock: first ? result.timeline.sliceAround(first.t, 2_500) : [],
    eventCount: result.timeline.events.length,
  };
  writeFileSync(TIMELINE_JSON, JSON.stringify(payload, null, 2), "utf8");

  const md = [
    `# Rapid bid stress timeline (${label})`,
    "",
    `- passed: **${result.passed}**`,
    result.seed != null ? `- seed: \`${result.seed}\` (0x${result.seed.toString(16)})` : null,
    result.failureMessage
      ? `\n## Failure\n\n${result.failureMessage}\n`
      : "\n## Result\n\nNo permanent lock.\n",
    first
      ? `## Window around first permanent lock (t=${first.t})\n\n\`\`\`json\n${JSON.stringify(
          result.timeline.sliceAround(first.t, 2_500),
          null,
          2,
        )}\n\`\`\`\n`
      : null,
    "## Full timeline\n",
    result.timeline.toMarkdown(),
    "",
  ]
    .filter((line) => line != null)
    .join("\n");
  writeFileSync(TIMELINE_MD, md, "utf8");
}

describe("VNBL rapid-bid stress harness", () => {
  it(
    "production monotonic gate: 8–12 teams × 1000 bids never permanently locks",
    async () => {
      const result = await runRapidBidStress({
        seed: STRESS_SEED,
        bidEvents: 1000,
        useMonotonicGate: true,
        minLatencyMs: 50,
        maxLatencyMs: 500,
        outOfOrderHttpProb: 0.45,
        ownerBidRatio: 0.5,
      });

      writeArtifacts("production_gate_on", result);

      expect(result.teamCount).toBeGreaterThanOrEqual(8);
      expect(result.teamCount).toBeLessThanOrEqual(12);
      expect(result.bidEvents).toBe(1000);
      expect(result.passed, result.failureMessage ?? "permanent lock").toBe(true);
      expect(result.firstPermanentLockAt).toBeNull();
      expect(result.finalClientLeader).toBe(result.finalServerLeader);
      expect(result.conflicts409 + result.staleHttpRejected).toBeGreaterThan(0);
    },
    120_000,
  );

  it("REPRO mode (gate off): stale HTTP after SSE permanently wrong isLeading", () => {
    const result = reproduceVnblStaleHttpAfterSse();
    writeArtifacts("reproduce_vnbl_stale_http", {
      passed: result.passed,
      firstPermanentLockAt: result.firstPermanentLockAt,
      failureMessage: result.failureMessage,
      finalClientLeader: result.clientLeader,
      finalServerLeader: result.serverLeader,
      timeline: result.timeline,
    });

    expect(result.passed).toBe(false);
    expect(result.firstPermanentLockAt).not.toBeNull();
    expect(result.clientLeader).toBe(1);
    expect(result.serverLeader).toBe(2);
    expect(result.failureMessage ?? "").toMatch(/stale HTTP|leader/i);
  });

  it("production gate rejects the same stale HTTP race the REPRO demonstrates", () => {
    const decision = decideBidMutationApply(2, {
      bidAck: true,
      eventVersion: 1,
      currentBid: 100_000,
      currentBidTeamId: 1,
    });
    expect(decision).toEqual({
      action: "reject_stale",
      reason: "http_event_version_behind_sse",
    });
  });
});
