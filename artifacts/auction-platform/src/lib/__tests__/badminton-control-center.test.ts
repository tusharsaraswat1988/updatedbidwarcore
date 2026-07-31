import { describe, expect, it } from "vitest";
import {
  findCourtScheduleConflicts,
  suggestCourtScheduleTimes,
  type ControlFixture,
} from "../badminton-control-center";

function fixture(
  partial: Partial<ControlFixture> & Pick<ControlFixture, "id">,
): ControlFixture {
  return {
    categoryId: 1,
    status: "unscheduled",
    ...partial,
  };
}

describe("suggestCourtScheduleTimes", () => {
  it("suggests slots after an existing match without conflict", () => {
    const date = "2026-07-29";
    const fixtures: ControlFixture[] = [
      fixture({
        id: 1,
        slotNumber: 1,
        courtId: 10,
        scheduledAt: new Date(`${date}T09:00:00`).toISOString(),
        status: "scheduled",
      }),
    ];

    const suggestions = suggestCourtScheduleTimes(fixtures, {
      courtId: 10,
      date,
      excludeFixtureId: 2,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.time).toBe("10:00");
    expect(suggestions[0]?.label).toContain("Match 1");

    for (const s of suggestions) {
      const conflicts = findCourtScheduleConflicts(fixtures, {
        courtId: 10,
        scheduledAtIso: new Date(`${date}T${s.time}:00`).toISOString(),
        excludeFixtureId: 2,
      });
      expect(conflicts).toHaveLength(0);
    }
  });

  it("suggests morning slots when the court is empty", () => {
    const suggestions = suggestCourtScheduleTimes([], {
      courtId: 10,
      date: "2026-07-29",
    });

    expect(suggestions.map((s) => s.time)).toEqual(["09:00", "09:45", "10:30", "11:15"]);
  });
});
