import { describe, expect, it } from "vitest";
import {
  broadcastSpecLabel,
  buildPortraitInfoRows,
  portraitSpecGridClass,
  resolveSmartPlayerStats,
} from "../portrait-footer-stats";

describe("broadcastSpecLabel", () => {
  it("abbreviates known badminton labels", () => {
    expect(broadcastSpecLabel("Playing Hand")).toBe("HAND");
    expect(broadcastSpecLabel("Playing Style")).toBe("STYLE");
    expect(broadcastSpecLabel("Experience")).toBe("EXP");
    expect(broadcastSpecLabel("Court Preference")).toBe("COURT");
  });

  it("abbreviates unknown multi-word labels via acronym", () => {
    expect(broadcastSpecLabel("Preferred Footwork")).toBe("PF");
  });
});

describe("buildPortraitInfoRows", () => {
  it("includes age and all specs with no cap", () => {
    const rows = buildPortraitInfoRows(48, [
      { label: "Playing Hand", value: "Right Hand" },
      { label: "Playing Style", value: "Attacking" },
      { label: "Experience", value: "Intermediate" },
      { label: "Court Preference", value: "Back Court" },
    ]);

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.shortLabel)).toEqual([
      "AGE",
      "HAND",
      "STYLE",
      "EXP",
      "COURT",
    ]);
    expect(rows[4]?.value).toBe("Back Court");
  });

  it("shows configured specs with em dash when value is empty", () => {
    const rows = buildPortraitInfoRows(30, [
      { label: "Playing Hand", value: "Left Hand" },
      { label: "Court Preference", value: "  " },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.shortLabel).toBe("COURT");
    expect(rows[2]?.value).toBe("—");
  });

  it("uses single column grid for 1–2 rows", () => {
    expect(portraitSpecGridClass(1)).toBe("grid-cols-1");
    expect(portraitSpecGridClass(2)).toBe("grid-cols-1");
  });

  it("uses two column grid for 3+ rows", () => {
    expect(portraitSpecGridClass(3)).toBe("grid-cols-2");
    expect(portraitSpecGridClass(7)).toBe("grid-cols-2");
  });
});

describe("resolveSmartPlayerStats", () => {
  it("strictly omits missing age and city and never produces em-dash", () => {
    const stats = resolveSmartPlayerStats({
      age: null,
      city: "  ",
      specs: [
        { label: "Batting Hand", value: "Right-hand" },
        { label: "Bowling Style", value: "Medium" },
      ],
    });

    expect(stats).toHaveLength(2);
    expect(stats.map((s) => s.shortLabel)).toEqual(["BAT", "BOWL"]);
    expect(stats.map((s) => s.value)).toEqual(["RIGHT-HAND", "MEDIUM"]);
    for (const s of stats) {
      expect(s.value).not.toBe("—");
      expect(s.value).not.toBe("-");
    }
  });

  it("includes valid age and city when present", () => {
    const stats = resolveSmartPlayerStats({
      age: 28,
      city: "Surat",
      specs: [
        { label: "Batting Hand", value: "Left-hand" },
        { label: "Bowling Style", value: "Spin" },
      ],
    });

    expect(stats).toHaveLength(4);
    expect(stats.map((s) => s.shortLabel)).toEqual(["BAT", "BOWL", "AGE", "CITY"]);
    expect(stats.find((s) => s.shortLabel === "AGE")?.value).toBe("28 YRS");
    expect(stats.find((s) => s.shortLabel === "CITY")?.value).toBe("SURAT");
  });

  it("filters out empty spec values", () => {
    const stats = resolveSmartPlayerStats({
      age: 0,
      city: null,
      specs: [
        { label: "Batting Hand", value: "Right-hand" },
        { label: "Bowling Style", value: "—" },
        { label: "Specialization", value: "   " },
      ],
    });

    // Batting Hand is valid (length=1). With length<=1 and options, it pairs nicely
    expect(stats[0]?.shortLabel).toBe("BAT");
    expect(stats[0]?.value).toBe("RIGHT-HAND");
    expect(stats.some((s) => s.shortLabel === "BOWL")).toBe(false);
  });

  it("promotes category if specs are sparse", () => {
    const stats = resolveSmartPlayerStats({
      age: null,
      city: null,
      categoryName: "Diamond",
      specs: [{ label: "Batting Hand", value: "Right-hand" }],
    });

    expect(stats).toHaveLength(2);
    expect(stats[0]?.shortLabel).toBe("BAT");
    expect(stats[1]?.shortLabel).toBe("TIER");
    expect(stats[1]?.value).toBe("DIAMOND");
  });
});

