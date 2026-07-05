import { describe, expect, it } from "vitest";
import {
  applySpecificationsToSelections,
  buildSpecificationsPayload,
} from "../player-specifications";

describe("buildSpecificationsPayload", () => {
  const badmintonGroups = [
    { id: 42, groupName: "Playing Hand", displayOrder: 1 },
    { id: 43, groupName: "Playing Style", displayOrder: 2 },
    { id: 44, groupName: "Experience", displayOrder: 3 },
    { id: 45, groupName: "Court Preference", displayOrder: 4 },
  ];

  it("includes Court Preference (4th spec) in save payload", () => {
    const specs = buildSpecificationsPayload(
      badmintonGroups,
      {
        battingStyle: "Right Hand",
        bowlingStyle: "Attacking",
        specialization: "Advanced",
      },
      { 45: "Back Court Specialist" },
    );

    expect(specs).toEqual([
      { specGroupId: 42, value: "Right Hand" },
      { specGroupId: 43, value: "Attacking" },
      { specGroupId: 44, value: "Advanced" },
      { specGroupId: 45, value: "Back Court Specialist" },
    ]);
  });

  it("round-trips Court Preference through applySpecificationsToSelections", () => {
    const input = [
      { specGroupId: 42, value: "Right Hand" },
      { specGroupId: 45, value: "Singles Court" },
    ];
    const { legacyForm, extraSelections } = applySpecificationsToSelections(
      badmintonGroups,
      input,
      {},
    );

    expect(legacyForm.battingStyle).toBe("Right Hand");
    expect(extraSelections[45]).toBe("Singles Court");

    const resaved = buildSpecificationsPayload(badmintonGroups, legacyForm, extraSelections);
    expect(resaved.find((s) => s.specGroupId === 45)?.value).toBe("Singles Court");
  });
});
