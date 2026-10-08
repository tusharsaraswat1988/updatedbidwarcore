import { beforeEach, describe, expect, it } from "vitest";
import {
  broadcastCricketObsDirector,
  getCricketObsDirectorState,
  setCricketObsDirectorState,
} from "../lib/scoring-broadcast";
import { parseSponsorMediaCue } from "@workspace/scoring-core";

describe("sponsor media director cue", () => {
  const tournamentId = 44021;

  beforeEach(() => {
    setCricketObsDirectorState(tournamentId, "scorecard", 7, undefined, undefined, {
      active: false,
      name: "",
      details: "",
    });
  });

  it("stores a lightweight play cue without changing the cricket overlay", () => {
    const parsed = parseSponsorMediaCue({
      action: "play",
      slotId: 3,
      slotNumber: 1,
      version: 2,
      destination: "obs",
      cueId: "cue-director1",
    }, 5000);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    broadcastCricketObsDirector(tournamentId, {
      messageType: "sponsor_media",
      sponsorMedia: parsed.cue,
    });

    const state = getCricketObsDirectorState(tournamentId);
    expect(state.overlay).toBe("scorecard");
    expect(state.matchId).toBe(7);
    expect(state.sponsorMedia).toEqual(parsed.cue);
    expect(state.sponsorMedia && "broadcastUrl" in state.sponsorMedia).toBe(false);
  });

  it("keeps the sponsor cue when a later overlay command arrives", () => {
    const parsed = parseSponsorMediaCue({
      action: "stop",
      slotId: 3,
      slotNumber: 1,
      version: 2,
      destination: "both",
      cueId: "cue-director2",
    }, 6000);
    if (!parsed.ok) throw new Error(parsed.error);
    broadcastCricketObsDirector(tournamentId, { sponsorMedia: parsed.cue });
    broadcastCricketObsDirector(tournamentId, { overlay: "none" });
    const state = getCricketObsDirectorState(tournamentId);
    expect(state.overlay).toBe("none");
    expect(state.sponsorMedia?.action).toBe("stop");
  });
});
