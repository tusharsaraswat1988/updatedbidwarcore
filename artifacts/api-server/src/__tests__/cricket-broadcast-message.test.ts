import { describe, expect, it, beforeEach } from "vitest";
import {
  getCricketObsDirectorState,
  setCricketObsDirectorState,
  broadcastCricketObsDirector,
  type CricketBroadcastMessage,
} from "../lib/scoring-broadcast";

describe("Cricket OBS Broadcast Message - Server Director State & Broadcast", () => {
  const TOURNAMENT_ID = 999;

  beforeEach(() => {
    // Reset state for tournament 999
    setCricketObsDirectorState(TOURNAMENT_ID, "none", undefined, undefined, undefined, null);
  });

  it("Point 12: stores broadcastMessage in server director state", () => {
    const msg: CricketBroadcastMessage = {
      active: true,
      name: "Rahul Sharma",
      details: "Former India Player & Special Guest",
    };

    setCricketObsDirectorState(
      TOURNAMENT_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      msg,
    );

    const state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.broadcastMessage).toEqual(msg);
    expect(state.overlay).toBe("none");
  });

  it("Point 13 & 32: switching an 80% screen overlay preserves the active broadcast message state", () => {
    const msg: CricketBroadcastMessage = {
      active: true,
      name: "Suresh Raina",
      details: "Tournament Chief Guest",
    };

    // 1. Push broadcast message
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      messageType: "broadcast_message",
      broadcastMessage: msg,
    });

    let state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.broadcastMessage).toEqual(msg);

    // 2. Operator switches to Points Table overlay
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      overlay: "standings",
      stageOrGroup: "Group A",
    });

    state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.overlay).toBe("standings");
    expect(state.stageOrGroup).toBe("Group A");
    // Broadcast message must still remain active!
    expect(state.broadcastMessage).toEqual(msg);

    // 3. Operator switches to Sponsors showcase
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      overlay: "sponsors",
      sponsorName: "Title Sponsor",
    });

    state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.overlay).toBe("sponsors");
    expect(state.sponsorName).toBe("Title Sponsor");
    expect(state.broadcastMessage).toEqual(msg);

    // 4. Operator resets back to camera feed (overlay = none)
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      overlay: "none",
    });

    state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.overlay).toBe("none");
    expect(state.broadcastMessage).toEqual(msg);
  });

  it("Point 16 & 17: explicit close sets broadcastMessage active = false without affecting overlay", () => {
    // 1. Set active message + overlay
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      overlay: "scorecard",
      matchId: 42,
      broadcastMessage: {
        active: true,
        name: "Kapil Dev",
        details: "Legendary Captain & Guest of Honour",
      },
    });

    let state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.broadcastMessage?.active).toBe(true);
    expect(state.overlay).toBe("scorecard");

    // 2. Explicit close
    broadcastCricketObsDirector(TOURNAMENT_ID, {
      messageType: "broadcast_message",
      broadcastMessage: {
        active: false,
        name: "",
        details: "",
      },
    });

    state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.broadcastMessage?.active).toBe(false);
    expect(state.overlay).toBe("scorecard");
    expect(state.matchId).toBe(42);
  });

  it("Point 30: field length validation boundaries", () => {
    const validName = "A".repeat(100);
    const validDetails = "D".repeat(180);

    expect(validName.length).toBe(100);
    expect(validDetails.length).toBe(180);

    setCricketObsDirectorState(
      TOURNAMENT_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        active: true,
        name: validName,
        details: validDetails,
      },
    );

    const state = getCricketObsDirectorState(TOURNAMENT_ID);
    expect(state.broadcastMessage?.name).toBe(validName);
    expect(state.broadcastMessage?.details).toBe(validDetails);
  });
});
