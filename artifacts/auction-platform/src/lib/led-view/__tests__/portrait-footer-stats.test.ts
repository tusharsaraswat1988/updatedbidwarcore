import { describe, expect, it } from "vitest";
import {
  broadcastSpecLabel,
  buildPortraitInfoRows,
  portraitSpecGridClass,
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
