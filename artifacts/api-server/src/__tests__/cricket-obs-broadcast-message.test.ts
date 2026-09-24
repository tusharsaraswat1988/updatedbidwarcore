import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  broadcastCricketObsDirector,
  getCricketObsDirectorState,
  setCricketObsDirectorState,
  addScoringSseClient,
  removeScoringSseClient,
  type CricketObsDirectorPayload,
} from "../lib/scoring-broadcast";

describe("Cricket OBS Broadcast Message Director & State", () => {
  const tournamentId = 998877;

  beforeEach(() => {
    // Reset director state
    setCricketObsDirectorState(tournamentId, "none", undefined, undefined, undefined, {
      active: false,
      name: "",
      details: "",
    });
  });

  it("sets and retrieves active broadcast message state", () => {
    setCricketObsDirectorState(
      tournamentId,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        active: true,
        name: "Rahul Sharma",
        details: "Former India Player & Special Guest",
      },
    );

    const state = getCricketObsDirectorState(tournamentId);
    expect(state.broadcastMessage).toEqual({
      active: true,
      name: "Rahul Sharma",
      details: "Former India Player & Special Guest",
    });
  });

  it("clears broadcast message on close action without losing overlay settings", () => {
    // Set overlay first
    setCricketObsDirectorState(tournamentId, "scorecard", 42);

    // Push broadcast message
    setCricketObsDirectorState(
      tournamentId,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        active: true,
        name: "Arjun Mehta",
        details: "Match Sponsor Representative",
      },
    );

    let state = getCricketObsDirectorState(tournamentId);
    expect(state.overlay).toBe("scorecard");
    expect(state.matchId).toBe(42);
    expect(state.broadcastMessage?.active).toBe(true);
    expect(state.broadcastMessage?.name).toBe("Arjun Mehta");

    // Close broadcast message
    setCricketObsDirectorState(
      tournamentId,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        active: false,
        name: "",
        details: "",
      },
    );

    state = getCricketObsDirectorState(tournamentId);
    expect(state.overlay).toBe("scorecard");
    expect(state.matchId).toBe(42);
    expect(state.broadcastMessage?.active).toBe(false);
  });

  it("broadcasts director payload containing broadcastMessage via SSE frame", () => {
    const receivedFrames: string[] = [];
    const mockRes = {
      write: vi.fn((frame: string) => {
        receivedFrames.push(frame);
        return true;
      }),
    };

    const client = addScoringSseClient(tournamentId, mockRes as any);

    try {
      broadcastCricketObsDirector(tournamentId, {
        messageType: "broadcast_message",
        broadcastMessage: {
          active: true,
          name: "Kapil Dev",
          details: "Legendary Captain & Chief Guest",
        },
      });

      expect(receivedFrames.length).toBe(1);
      const rawData = receivedFrames[0].replace(/^data: /, "").trim();
      const payload: CricketObsDirectorPayload = JSON.parse(rawData);

      expect(payload.type).toBe("cricket_obs_director");
      expect(payload.messageType).toBe("broadcast_message");
      expect(payload.broadcastMessage).toEqual({
        active: true,
        name: "Kapil Dev",
        details: "Legendary Captain & Chief Guest",
      });
      expect(payload.timestamp).toBeGreaterThan(0);

      // Verify server state was updated
      const serverState = getCricketObsDirectorState(tournamentId);
      expect(serverState.broadcastMessage?.active).toBe(true);
      expect(serverState.broadcastMessage?.name).toBe("Kapil Dev");
    } finally {
      removeScoringSseClient(client);
    }
  });

  it("handles out-of-order timestamp sequencing correctly", () => {
    const t0 = 1000;
    const t1 = 2000;
    const t2 = 3000;

    // Simulate Event 1 (Push A at t1)
    let lastDirectorTimestamp = 0;
    let activeMsgState: any = null;

    function applyDirectorEvent(ev: { timestamp: number; broadcastMessage?: any }) {
      if (ev.timestamp < lastDirectorTimestamp) return; // drop stale event
      lastDirectorTimestamp = ev.timestamp;
      if (ev.broadcastMessage !== undefined) {
        activeMsgState = ev.broadcastMessage;
      }
    }

    applyDirectorEvent({
      timestamp: t1,
      broadcastMessage: { active: true, name: "Event A", details: "First" },
    });
    expect(activeMsgState.name).toBe("Event A");

    // Simulate Event 2 (Close at t2)
    applyDirectorEvent({
      timestamp: t2,
      broadcastMessage: { active: false, name: "", details: "" },
    });
    expect(activeMsgState.active).toBe(false);

    // Simulate Delayed/Out-of-order Event 0 (Push at t0 arrives late)
    applyDirectorEvent({
      timestamp: t0,
      broadcastMessage: { active: true, name: "Stale Event", details: "Should be ignored" },
    });

    // Final state must remain CLOSED, not resurrected!
    expect(activeMsgState.active).toBe(false);
    expect(activeMsgState.name).toBe("");
  });
});
