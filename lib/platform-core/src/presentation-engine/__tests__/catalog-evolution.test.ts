import { describe, expect, it } from "vitest";
import { PRESENTATION_PROFILE_CATALOG } from "../../catalog/presentation/index.ts";
import { PresentationEngine } from "../engine.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "../versions.ts";

function pickVariant(profile: (typeof PRESENTATION_PROFILE_CATALOG)[number]): string {
  const first = profile.supportedVariants[0];
  if (!first || first === "*") {
    if (profile.sportId === "cricket") return "cricket.outdoor";
    if (profile.sportId === "badminton") return "badminton.standard";
    if (profile.sportId === "football") return "football.standard";
    return `${profile.sportId}.standard`;
  }
  return first;
}

function pickCompetition(profile: (typeof PRESENTATION_PROFILE_CATALOG)[number]): string {
  const first = profile.supportedCompetitionTypes[0];
  return first && first !== "*" ? first : "auction";
}

describe("Catalog evolution — all presentation packs resolve and compile", () => {
  it("every catalog presentation profile resolves + compiles successfully", () => {
    const failures: string[] = [];

    for (const profile of PRESENTATION_PROFILE_CATALOG) {
      if (profile.status === "deprecated" || profile.status === "legacy") continue;

      const result = PresentationEngine.resolve({
        inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
        snapshot: null,
        context: {
          sportId: profile.sportId,
          variantId: pickVariant(profile),
          competitionTypeId: pickCompetition(profile),
          presentationProfile: { id: profile.id, version: profile.version },
          resolutionMode: "CREATE",
        },
        compilationMode: "REQUIRED",
      });

      if (!result.ok || !result.resolvedPresentationContract) {
        failures.push(
          `${profile.id}@${profile.version}: ${result.diagnostics.issues
            .map((i) => i.code)
            .join(",")}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
