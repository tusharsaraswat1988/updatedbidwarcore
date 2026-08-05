import type { PresentationCapabilityProfileEntry } from "../../types.ts";

export const PRESENTATION_CAPABILITY_PROFILE_CATALOG: readonly PresentationCapabilityProfileEntry[] =
  [
    {
      kind: "presentation_capability_profile",
      id: "capability.obs.v1",
      version: "1.0.0",
      displayName: "OBS v1",
      description: "OBS overlay consumer capabilities.",
      supportedCompetitionTypes: ["*"],
      supportedVariants: ["*"],
      status: "active",
      optionalCapabilities: [
        "presentation.feature.animation",
        "presentation.feature.ticker",
      ],
      requiredCapabilities: [
        "presentation.feature.primary_score",
        "presentation.feature.clock",
      ],
    },
    {
      kind: "presentation_capability_profile",
      id: "capability.led.v1",
      version: "1.0.0",
      displayName: "LED v1",
      description: "LED display consumer capabilities.",
      supportedCompetitionTypes: ["*"],
      supportedVariants: ["*"],
      status: "active",
      optionalCapabilities: ["presentation.feature.animation"],
      requiredCapabilities: [
        "presentation.feature.primary_score",
        "presentation.feature.sponsor_strip",
      ],
    },
    {
      kind: "presentation_capability_profile",
      id: "capability.mobile.v1",
      version: "1.0.0",
      displayName: "Mobile v1",
      description: "Mobile UI consumer capabilities.",
      supportedCompetitionTypes: ["*"],
      supportedVariants: ["*"],
      status: "active",
      optionalCapabilities: [
        "presentation.feature.animation",
        "presentation.feature.player_card",
      ],
      requiredCapabilities: ["presentation.feature.primary_score"],
    },
  ];

export function getCapabilityProfile(
  id: string,
  version?: string | null,
): PresentationCapabilityProfileEntry | null {
  const matches = PRESENTATION_CAPABILITY_PROFILE_CATALOG.filter((p) => p.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((p) => p.version === version) ?? null;
  return [...matches].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}
