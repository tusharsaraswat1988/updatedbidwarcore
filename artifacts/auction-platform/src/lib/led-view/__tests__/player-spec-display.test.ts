import { describe, expect, it } from "vitest";

import { resolvePlayerSpecifications } from "../../player-spec-display";



describe("resolvePlayerSpecifications", () => {

  it("uses normalized specifications with sport-specific labels", () => {

    const specs = resolvePlayerSpecifications({

      specifications: [

        { specGroupId: 11, groupName: "Playing Hand", value: "Right Hand" },

        { specGroupId: 12, groupName: "Playing Style", value: "Attacking" },

      ],

    });

    expect(specs[0]?.label).toBe("Playing Hand");

    expect(specs[0]?.value).toBe("Right Hand");

    expect(specs.some((s) => s.label === "Bat")).toBe(false);

  });



  it("maps legacy columns to sport-specific labels from role_spec_groups", () => {

    const specs = resolvePlayerSpecifications(

      {

        battingStyle: "Right Hand",

        bowlingStyle: "Attacking",

      },

      { specGroupLabels: ["Playing Hand", "Playing Style"] },

    );

    expect(specs.map((s) => s.label)).toEqual(["Playing Hand", "Playing Style"]);

    expect(specs[0]?.value).toBe("Right Hand");

  });



  it("returns all configured role spec groups including empty slots", () => {

    const specs = resolvePlayerSpecifications(

      {

        battingStyle: "Right Hand",

        bowlingStyle: "Attacking",

        specialization: "Intermediate",

      },

      {

        specGroupLabels: [

          "Playing Hand",

          "Playing Style",

          "Experience",

          "Court Preference",

        ],

      },

    );

    expect(specs.map((s) => s.label)).toEqual([

      "Playing Hand",

      "Playing Style",

      "Experience",

      "Court Preference",

    ]);

    expect(specs[3]?.value).toBe("");

  });



  it("never uses hardcoded Batting Style label", () => {

    const specs = resolvePlayerSpecifications({

      battingStyle: "Right Hand Batsman",

      bowlingStyle: "Right Arm Medium",

      specialization: "All-Rounder",

    });

    expect(specs.every((s) => !/batting style/i.test(s.label))).toBe(true);

  });



  it("prefers specifications over legacy when both present", () => {

    const specs = resolvePlayerSpecifications({

      battingStyle: "Legacy Hand",

      specifications: [{ specGroupId: 11, groupName: "Playing Hand", value: "Left" }],

    });

    expect(specs).toHaveLength(1);

    expect(specs[0]?.value).toBe("Left");

  });

});


