import { describe, expect, it, vi } from "vitest";
import {
  addScoringSseClient,
  broadcastScoringState,
  getScoringSseClientCount,
  removeScoringSseClient,
} from "../lib/scoring-broadcast";
import {
  publishRealtimeMessage,
  subscribeRealtimeBus,
  type RealtimeMessage,
} from "../lib/scoring-realtime-bus";

describe("P0-C: Multi-Instance Realtime SSE & Bus", () => {
  it("delivers messages across multi-instance bus subscribers", () => {
    const instanceBMessages: RealtimeMessage[] = [];
    const instanceCMessages: RealtimeMessage[] = [];

    // Simulate Instance B subscriber (OBS)
    const unsubB = subscribeRealtimeBus((msg) => {
      instanceBMessages.push(msg);
    });

    // Simulate Instance C subscriber (Fan)
    const unsubC = subscribeRealtimeBus((msg) => {
      instanceCMessages.push(msg);
    });

    const testTournamentId = 9991;

    // Simulate Scorer on Instance A submitting FOUR
    publishRealtimeMessage(testTournamentId, "scoring", {
      type: "scoring_state",
      matchId: 10,
      sequence: 42,
      broadcastEvent: {
        id: "evt-42",
        type: "cricket_four",
        sequence: 42,
        runs: 4,
      },
    }, 42);

    expect(instanceBMessages).toHaveLength(1);
    expect(instanceBMessages[0]?.tournamentId).toBe(testTournamentId);
    expect(instanceBMessages[0]?.sequence).toBe(42);
    expect(instanceBMessages[0]?.payload.type).toBe("scoring_state");

    expect(instanceCMessages).toHaveLength(1);
    expect(instanceCMessages[0]?.sequence).toBe(42);

    unsubB();
    unsubC();
  });

  it("handles cricket event types across instances (FOUR, SIX, WICKET, NO BALL, WIDE)", () => {
    const receivedEvents: string[] = [];
    const unsub = subscribeRealtimeBus((msg) => {
      const bEvent = (msg.payload as { broadcastEvent?: { type?: string } })?.broadcastEvent;
      if (bEvent?.type) receivedEvents.push(bEvent.type);
    });

    const cricketEvents = [
      { type: "cricket_run", seq: 101 },
      { type: "cricket_four", seq: 102 },
      { type: "cricket_six", seq: 103 },
      { type: "cricket_no_ball", seq: 104 },
      { type: "cricket_free_hit", seq: 105 },
      { type: "cricket_wide", seq: 106 },
      { type: "cricket_wicket", seq: 107 },
      { type: "cricket_over_complete", seq: 108 },
      { type: "cricket_innings_complete", seq: 109 },
      { type: "cricket_match_won", seq: 110 },
    ];

    for (const ev of cricketEvents) {
      publishRealtimeMessage(8881, "scoring", {
        type: "scoring_state",
        matchId: 5,
        sequence: ev.seq,
        broadcastEvent: { type: ev.type, sequence: ev.seq },
      }, ev.seq);
    }

    expect(receivedEvents).toEqual([
      "cricket_run",
      "cricket_four",
      "cricket_six",
      "cricket_no_ball",
      "cricket_free_hit",
      "cricket_wide",
      "cricket_wicket",
      "cricket_over_complete",
      "cricket_innings_complete",
      "cricket_match_won",
    ]);

    unsub();
  });

  it("SSE client registry adds clients, writes frames, and cleans up dead connections without blocking others", () => {
    const tournamentId = 7771;
    const receivedFramesA: string[] = [];
    const receivedFramesB: string[] = [];

    // Client A (healthy)
    const mockResA = {
      write: vi.fn((frame: string) => {
        receivedFramesA.push(frame);
        return true;
      }),
    } as unknown as import("express").Response;

    // Client B (slow/disconnected client whose write fails)
    const mockResB = {
      write: vi.fn((_frame: string) => {
        return false; // Backpressured / disconnected socket
      }),
    } as unknown as import("express").Response;

    const clientA = addScoringSseClient(tournamentId, mockResA);
    const clientB = addScoringSseClient(tournamentId, mockResB);

    expect(getScoringSseClientCount(tournamentId)).toBe(2);

    // Broadcast state
    broadcastScoringState(tournamentId, {
      type: "scoring_state",
      matchId: 1,
      state: { lastSequence: 50 },
    }, 50);

    // Healthy client received frame
    expect(receivedFramesA).toHaveLength(1);
    expect(receivedFramesA[0]).toContain("id: 50\n");
    expect(receivedFramesA[0]).toContain("event: scoring_state\n");

    // Client B write failed, so it was automatically removed from registry
    expect(getScoringSseClientCount(tournamentId)).toBe(1);

    // Cleanup Client A
    removeScoringSseClient(clientA);
    expect(getScoringSseClientCount(tournamentId)).toBe(0);
  });
});
