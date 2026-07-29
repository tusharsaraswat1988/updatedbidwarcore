import { describe, expect, it } from "vitest";
import {
  BADMINTON_FORMAT_PRESETS,
  badmintonFormatFromPreset,
  inferBadmintonFormatPresetId,
  isBadmintonFormatPresetId,
  parseBadmintonMatchFormat,
} from "./match-format";
import { gamesNeededToWin } from "./reducer/state";
import { BEST_OF_5_FORMAT } from "./types";

describe("best_of_5 preset", () => {
  it("gamesNeededToWin(5) === 3", () => {
    expect(gamesNeededToWin(5)).toBe(3);
  });

  it("resolves best_of_5 preset to totalGames 5", () => {
    expect(isBadmintonFormatPresetId("best_of_5")).toBe(true);
    expect(BADMINTON_FORMAT_PRESETS.best_of_5).toEqual(BEST_OF_5_FORMAT);
    expect(BADMINTON_FORMAT_PRESETS.best_of_5.totalGames).toBe(5);

    const fromPreset = badmintonFormatFromPreset("best_of_5");
    expect(fromPreset.totalGames).toBe(5);
    expect(fromPreset).toEqual(BEST_OF_5_FORMAT);

    const parsed = parseBadmintonMatchFormat(BEST_OF_5_FORMAT);
    expect(parsed?.totalGames).toBe(5);
    expect(inferBadmintonFormatPresetId(parsed!)).toBe("best_of_5");
  });
});
