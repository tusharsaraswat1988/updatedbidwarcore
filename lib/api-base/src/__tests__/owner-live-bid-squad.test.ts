import { describe, expect, it } from "vitest";
import {
  ownerSquadMaxSubline,
  ownerSquadMinSubline,
  resolveOwnerPlayingSquadTotal,
  resolveOwnerSquadRequirement,
} from "../purse-protection-expect";

const SETTINGS = { minimumSquadSize: 12, maximumSquadSize: 13 };

describe("resolveOwnerSquadRequirement", () => {
  it("A: 0 players → minDue 12, maxDue 13", () => {
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: 0 })).toEqual({
      totalInSquad: 0,
      minDue: 12,
      maxDue: 13,
    });
  });

  it("B: 2 retained + 0 bought → minDue 10, maxDue 11", () => {
    const totalInSquad = 2; // retained only; playersBought is sold+retained
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad })).toEqual({
      totalInSquad: 2,
      minDue: 10,
      maxDue: 11,
    });
  });

  it("C: 2 retained + 2 bought → minDue 8, maxDue 9 (total 4, not 2 or 6)", () => {
    const retained = 2;
    const bought = 2;
    const totalInSquad = retained + bought;
    expect(totalInSquad).toBe(4);
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad })).toEqual({
      totalInSquad: 4,
      minDue: 8,
      maxDue: 9,
    });
  });

  it("D: 12 total → minDue 0, maxDue 1", () => {
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: 12 })).toEqual({
      totalInSquad: 12,
      minDue: 0,
      maxDue: 1,
    });
  });

  it("E: 13 total → minDue 0, maxDue 0", () => {
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: 13 })).toEqual({
      totalInSquad: 13,
      minDue: 0,
      maxDue: 0,
    });
  });

  it("F: non-playing members do not affect either due", () => {
    const playingSquad = 4;
    const nonPlaying = 3;
    const wrongIfCounted = playingSquad + nonPlaying;
    const due = resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: playingSquad });
    expect(due.minDue).toBe(8);
    expect(due.maxDue).toBe(9);
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: wrongIfCounted }).minDue).not.toBe(
      due.minDue,
    );
  });

  it("G: minimum = 0 → no misleading minimum requirement", () => {
    const due = resolveOwnerSquadRequirement({
      minimumSquadSize: 0,
      maximumSquadSize: 13,
      totalInSquad: 2,
    });
    expect(due.minDue).toBeNull();
    expect(due.maxDue).toBe(11);
  });

  it("H: maximum = 0 → no misleading maximum capacity", () => {
    const due = resolveOwnerSquadRequirement({
      minimumSquadSize: 12,
      maximumSquadSize: 0,
      totalInSquad: 2,
    });
    expect(due.minDue).toBe(10);
    expect(due.maxDue).toBeNull();
  });

  it("does not invent numbers when squad count is unknown", () => {
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: null })).toEqual({
      totalInSquad: null,
      minDue: null,
      maxDue: null,
    });
  });

  it("never returns negative dues past the cap", () => {
    expect(resolveOwnerSquadRequirement({ ...SETTINGS, totalInSquad: 20 })).toEqual({
      totalInSquad: 20,
      minDue: 0,
      maxDue: 0,
    });
  });
});

describe("resolveOwnerPlayingSquadTotal", () => {
  it("Owner panel example: min 12 / max 13 with 2 retained + 2 bought → 8 / 9", () => {
    const totalInSquad = resolveOwnerPlayingSquadTotal({ playersBought: 4 });
    expect(
      resolveOwnerSquadRequirement({
        minimumSquadSize: 12,
        maximumSquadSize: 13,
        totalInSquad,
      }),
    ).toEqual({ totalInSquad: 4, minDue: 8, maxDue: 9 });
  });

  it("uses playersBought as the complete playing squad (sold + retained), not bought-only", () => {
    expect(
      resolveOwnerPlayingSquadTotal({
        playersBought: 4,
        retainedPlayingCount: 2,
        boughtPlayingCount: 2,
        rosterLoaded: true,
      }),
    ).toBe(4);
  });

  it("does not add retainedCount on top of playersBought (would yield 6 instead of 4)", () => {
    const playersBought = 4; // 2 retained + 2 sold in the snapshot
    const retainedCount = 2;
    const wrongDoubleCount = playersBought + retainedCount;
    expect(wrongDoubleCount).toBe(6);
    expect(resolveOwnerPlayingSquadTotal({ playersBought, retainedPlayingCount: retainedCount })).toBe(4);
  });

  it("falls back to retained + bought playing lists when the snapshot count is missing", () => {
    expect(
      resolveOwnerPlayingSquadTotal({
        playersBought: null,
        retainedPlayingCount: 2,
        boughtPlayingCount: 2,
        rosterLoaded: true,
      }),
    ).toBe(4);
  });

  it("does not invent a squad count before the roster is loaded", () => {
    expect(
      resolveOwnerPlayingSquadTotal({
        playersBought: null,
        retainedPlayingCount: 0,
        boughtPlayingCount: 0,
        rosterLoaded: false,
      }),
    ).toBeNull();
  });

  it("F: non-playing members are excluded from the playing lists used as fallback", () => {
    const retainedPlaying = 2;
    const boughtPlaying = 2;
    const nonPlaying = 3;
    expect(
      resolveOwnerPlayingSquadTotal({
        playersBought: null,
        retainedPlayingCount: retainedPlaying,
        boughtPlayingCount: boughtPlaying,
        rosterLoaded: true,
      }),
    ).toBe(4);
    expect(retainedPlaying + boughtPlaying + nonPlaying).toBe(7);
  });
});

describe("owner squad sublines", () => {
  it("uses Minimum reached / Squad full at zero remaining", () => {
    expect(ownerSquadMinSubline(0)).toBe("Minimum reached");
    expect(ownerSquadMaxSubline(0)).toBe("Squad full");
    expect(ownerSquadMinSubline(8)).toBe("8 more needed");
    expect(ownerSquadMaxSubline(9)).toBe("9 slots left");
    expect(ownerSquadMaxSubline(1)).toBe("1 slot left");
  });
});
