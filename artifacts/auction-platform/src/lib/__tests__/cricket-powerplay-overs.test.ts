import { describe, expect, it } from "vitest";
import { formatPowerplayOvers, resolvePowerplayOvers } from "../cricket-powerplay-overs";

describe("resolvePowerplayOvers", () => {
  it("returns the configured overs when powerplay is on", () => {
    expect(
      resolvePowerplayOvers({ powerplayEnabled: true, powerplayOvers: [1, 2, 6, 6] }, 20),
    ).toEqual([1, 2, 6]);
  });

  it("drops overs past the match length", () => {
    expect(
      resolvePowerplayOvers({ powerplayEnabled: true, powerplayOvers: [1, 2, 8] }, 5),
    ).toEqual([1, 2]);
  });

  it("uses the standard opening block when powerplay is on but no overs were saved", () => {
    expect(resolvePowerplayOvers({ powerplayEnabled: true, powerplayOvers: [] }, 20)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(resolvePowerplayOvers({ powerplayEnabled: true }, 8)).toEqual([1, 2, 3]);
  });

  it("returns nothing when powerplay is off", () => {
    expect(
      resolvePowerplayOvers({ powerplayEnabled: false, powerplayOvers: [1, 2, 3] }, 20),
    ).toEqual([]);
  });
});

describe("formatPowerplayOvers", () => {
  it("lists every over", () => {
    expect(formatPowerplayOvers([1, 2, 3])).toBe("Powerplay: Ov 1, 2, 3");
  });

  it("returns null when there is no powerplay", () => {
    expect(formatPowerplayOvers([])).toBeNull();
  });
});
