import { describe, expect, it } from "vitest";
import { resolvePlayerSpecifications } from "@/lib/player-spec-display";

describe("LED sport-aware specs", () => {
  it("badminton player shows Playing Hand not BAT", () => {
    const specs = resolvePlayerSpecifications({
      role: "Doubles Player",
      specifications: [
        { specGroupId: 11, groupName: "Playing Hand", value: "Left Hand" },
        { specGroupId: 12, groupName: "Playing Style", value: "Attacking" },
      ],
    });

    expect(specs[0]?.label).toBe("Playing Hand");
    expect(specs.some((s) => s.label === "Bat" || s.label === "BAT")).toBe(false);
  });

  it("cricket player shows Batting Hand from specifications", () => {
    const specs = resolvePlayerSpecifications({
      specifications: [
        { specGroupId: 1, groupName: "Batting Hand", value: "Right Hand" },
      ],
    });

    expect(specs[0]?.label).toBe("Batting Hand");
    expect(specs[0]?.value).toBe("Right Hand");
  });

  it("badminton legacy battingStyle column uses Playing Hand label from role_spec_groups", () => {
    const specs = resolvePlayerSpecifications(
      { battingStyle: "Right Hand" },
      { specGroupLabels: ["Playing Hand", "Playing Style"] },
    );

    expect(specs[0]?.label).toBe("Playing Hand");
    expect(specs[0]?.value).toBe("Right Hand");
    expect(specs.some((s) => /batting style/i.test(s.label))).toBe(false);
  });

  it("cricket legacy battingStyle column uses Batting Hand label from role_spec_groups", () => {
    const specs = resolvePlayerSpecifications(
      { battingStyle: "Right Hand" },
      { specGroupLabels: ["Batting Hand", "Bowling Style", "Specialization"] },
    );

    expect(specs[0]?.label).toBe("Batting Hand");
  });
});
