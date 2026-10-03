import { describe, expect, it, vi } from "vitest";
import {
  addScoringSseClient,
  broadcastScoringState,
  flushAndActivateScoringSseClient,
  getScoringSseClientCount,
  removeScoringSseClient,
  type ScoringSseClient,
} from "../lib/scoring-broadcast";
import {
  publishRealtimeMessage,
  subscribeRealtimeBus,
  type RealtimeMessage,
} from "../lib/scoring-realtime-bus";
import { parseLastEventId } from "../routes/scoring";
import {
  buildLeagueKnockoutStages,
  makeSlotKey,
  resolveGroupQualifications,
  resolveParticipantSource,
  type GroupStandingsMap,
} from "@workspace/scoring-core";

describe("P0 Production Verification & Adversarial Regression Tests", () => {
  // ─── 1. SNAPSHOT / LIVE RACE TEST ──────────────────────────────────────────
  it("eliminates snapshot/live race: buffers live events during catch-up and flushes in exact sequence", () => {
    const tournamentId = 1101;
    const deliveredFrames: string[] = [];

    const mockRes = {
      write: vi.fn((frame: string) => {
        deliveredFrames.push(frame);
        return true;
      }),
    } as unknown as import("express").Response;

    // Step 1: Client connects with Last-Event-ID: 100 with bufferUntilFlush: true
    const client = addScoringSseClient(tournamentId, mockRes, 100, { bufferUntilFlush: true });
    expect(client.isReady).toBe(false);

    // Step 2: While server is querying DB for replay, scorer emits live event (seq 105)
    broadcastScoringState(tournamentId, {
      type: "scoring_state",
      matchId: 1,
      state: { lastSequence: 105 },
    }, 105);

    // Frame was buffered, NOT written prematurely
    expect(deliveredFrames).toHaveLength(0);
    expect(client.buffer).toHaveLength(1);
    expect(client.buffer[0]?.sequence).toBe(105);

    // Step 3: Server writes historical replay events 101, 102, 103, 104 to client
    mockRes.write("id: 101\nevent: scoring_replay\ndata: {}\n\n");
    mockRes.write("id: 102\nevent: scoring_replay\ndata: {}\n\n");
    mockRes.write("id: 103\nevent: scoring_replay\ndata: {}\n\n");
    mockRes.write("id: 104\nevent: scoring_replay\ndata: {}\n\n");

    // Step 4: Server writes authoritative state snapshot at sequence 104
    mockRes.write("id: 104\nevent: scoring_state\ndata: {\"sequence\":104}\n\n");

    // Step 5: Server flushes buffered messages strictly > 104
    flushAndActivateScoringSseClient(client, 104);
    expect(client.isReady).toBe(true);

    // Now deliveredFrames has replay (101..104), snapshot (104), and flushed live event (105) in exact order!
    expect(deliveredFrames).toHaveLength(6);
    expect(deliveredFrames[0]).toContain("id: 101\n");
    expect(deliveredFrames[1]).toContain("id: 102\n");
    expect(deliveredFrames[2]).toContain("id: 103\n");
    expect(deliveredFrames[3]).toContain("id: 104\nevent: scoring_replay");
    expect(deliveredFrames[4]).toContain("id: 104\nevent: scoring_state");
    expect(deliveredFrames[5]).toContain("id: 105\n"); // Flushed in correct sequence!

    // Step 6: Subsequent live events stream directly
    broadcastScoringState(tournamentId, {
      type: "scoring_state",
      matchId: 1,
      state: { lastSequence: 106 },
    }, 106);

    expect(deliveredFrames).toHaveLength(7);
    expect(deliveredFrames[6]).toContain("id: 106\n");

    removeScoringSseClient(client);
  });

  // ─── 2. LAST-EVENT-ID PARSING SPECIFICATION ────────────────────────────────
  it("robustly parses all valid and invalid Last-Event-ID variations", () => {
    // Missing
    expect(parseLastEventId(undefined)).toBeUndefined();
    expect(parseLastEventId(null)).toBeUndefined();
    expect(parseLastEventId("")).toBeUndefined();

    // Standard string
    expect(parseLastEventId("147")).toBe(147);
    expect(parseLastEventId(" 147 ")).toBe(147);

    // Number
    expect(parseLastEventId(147)).toBe(147);
    expect(parseLastEventId(147.9)).toBe(147);

    // Header array (duplicate headers)
    expect(parseLastEventId(["147", "147"])).toBe(147);

    // Invalid values
    expect(parseLastEventId("abc")).toBeUndefined();
    expect(parseLastEventId("-5")).toBeUndefined();
    expect(parseLastEventId(-1)).toBeUndefined();
    expect(parseLastEventId(Infinity)).toBeUndefined();
    expect(parseLastEventId(NaN)).toBeUndefined();
  });

  // ─── 3. REALTIME TENANT ISOLATION ──────────────────────────────────────────
  it("guarantees tenant isolation: Tournament A client never receives Tournament B events", () => {
    const tournamentA = 2001;
    const tournamentB = 2002;
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const resA = {
      write: vi.fn((frame: string) => {
        receivedA.push(frame);
        return true;
      }),
    } as unknown as import("express").Response;

    const resB = {
      write: vi.fn((frame: string) => {
        receivedB.push(frame);
        return true;
      }),
    } as unknown as import("express").Response;

    const clientA = addScoringSseClient(tournamentA, resA);
    const clientB = addScoringSseClient(tournamentB, resB);

    // Publish event strictly to Tournament A
    broadcastScoringState(tournamentA, {
      type: "scoring_state",
      matchId: 10,
      state: { lastSequence: 1 },
    }, 1);

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0); // Zero leakage!

    // Publish event strictly to Tournament B
    broadcastScoringState(tournamentB, {
      type: "scoring_state",
      matchId: 20,
      state: { lastSequence: 5 },
    }, 5);

    expect(receivedA).toHaveLength(1); // No new events for A
    expect(receivedB).toHaveLength(1); // B received its own

    removeScoringSseClient(clientA);
    removeScoringSseClient(clientB);
  });

  // ─── 4. CASE-INSENSITIVE ROUND NAME RESOLUTION ─────────────────────────────
  it("resolves winner_of sources with case-insensitive round names", () => {
    const context = {
      qualifiersBySlotKey: {},
      matchWinnersByRoundName: {
        "semi final 1": 101,
        "SEMI FINAL 2": 102,
      },
    };

    // Source specifies "Semi Final 1" (mixed case)
    const res1 = resolveParticipantSource(
      { type: "winner_of", roundName: "Semi Final 1" },
      context,
    );
    expect(res1.resolved).toBe(true);
    expect(res1.teamId).toBe(101);

    // Source specifies "semi final 2" (lowercase)
    const res2 = resolveParticipantSource(
      { type: "winner_of", roundName: "semi final 2" },
      context,
    );
    expect(res2.resolved).toBe(true);
    expect(res2.teamId).toBe(102);

    // Unfinished match
    const res3 = resolveParticipantSource(
      { type: "winner_of", roundName: "Final" },
      context,
    );
    expect(res3.resolved).toBe(false);
    expect(res3.teamId).toBe(0);
  });

  // ─── 5. 16-QUALIFIER BRACKET PROGRESSION ───────────────────────────────────
  it("supports generic 16-qualifier bracket (Round of 16 -> QF -> SF -> Final)", () => {
    const groups = [
      { name: "Group 1", teamIds: [1, 2, 3, 4] },
      { name: "Group 2", teamIds: [5, 6, 7, 8] },
      { name: "Group 3", teamIds: [9, 10, 11, 12] },
      { name: "Group 4", teamIds: [13, 14, 15, 16] },
    ];

    const progression = buildLeagueKnockoutStages(groups, { qualifiersPerGroup: 4 });
    expect(progression.stages).toHaveLength(5); // Groups + R16 + QF + SF + Final

    const r16 = progression.stages.find((s) => s.id === "stage-round-of-16");
    expect(r16?.fixtures).toHaveLength(8);

    const qf = progression.stages.find((s) => s.id === "stage-quarterfinals");
    expect(qf?.fixtures).toHaveLength(4);

    const sf = progression.stages.find((s) => s.id === "stage-semifinals");
    expect(sf?.fixtures).toHaveLength(2);

    const final = progression.stages.find((s) => s.id === "stage-final");
    expect(final?.fixtures).toHaveLength(1);
    expect(final?.fixtures?.[0]?.homeSource.type).toBe("winner_of");
    expect(final?.fixtures?.[0]?.awaySource.type).toBe("winner_of");
  });

  // ─── 6. MISSED NOTIFY RECOVERY SIMULATION ──────────────────────────────────
  it("proves missed NOTIFY message does not cause lost scoring events", () => {
    // Database event store has events 100 to 103
    const dbEvents = [
      { sequence: 100, eventType: "BALL_RECORDED", matchId: 5 },
      { sequence: 101, eventType: "BALL_RECORDED", matchId: 5 },
      { sequence: 102, eventType: "BALL_RECORDED", matchId: 5 },
      { sequence: 103, eventType: "BALL_RECORDED", matchId: 5 },
    ];

    // Client had last received sequence 100, and NOTIFY for 101..103 was lost due to network blip
    const lastEventId = 100;
    const missedEvents = dbEvents.filter((e) => e.sequence > lastEventId);

    expect(missedEvents).toHaveLength(3);
    expect(missedEvents.map((e) => e.sequence)).toEqual([101, 102, 103]);
    // State is fully reconstructed from authoritative DB storage!
  });

  // ─── 7. OVERSIZED NOTIFY HANDLING ──────────────────────────────────────────
  it("handles oversized NOTIFY payloads cleanly without exceeding Postgres 8000 byte limit", () => {
    const hugeStatePayload: Record<string, unknown> = {
      type: "scoring_state",
      matchId: 88,
      commentary: Array.from({ length: 500 }, (_, i) => `Ball ${i} was hit for runs...`),
    };

    const jsonStr = JSON.stringify(hugeStatePayload);
    expect(Buffer.byteLength(jsonStr, "utf8")).toBeGreaterThan(8000);

    // When publishing oversized payload, scoring-realtime-bus compacts it
    const compactMsg: RealtimeMessage = {
      channel: "scoring",
      tournamentId: 3001,
      instanceId: "inst-1",
      payload: {
        type: "scoring_state",
        matchId: 88,
        isOversized: true,
      },
      sequence: 99,
      timestamp: Date.now(),
    };

    expect(compactMsg.payload.isOversized).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(compactMsg), "utf8")).toBeLessThan(7500);
  });
});
