/**
 * Buzz Studio — Template Layout Registry (Phase 18)
 *
 * Default zone definitions per template + aspect ratio.
 * Designers replace visual style via background assets; zone specs
 * can be tuned here without changing template React logic.
 */

import { BuzzTemplateType } from "../registry/template-types";
import { templateBackgroundImageKey } from "./template-layout-schema";
import { TOP_BUYS_FEATURED_FRAMES_4_5 } from "../templates/top-buys/top-buys-frame-metadata";
import type { BuzzAspectRatio } from "./buzz-render-context";
import {
  backgroundImageKeyForRatio,
  type TemplateLayoutDefinition,
  type TemplateLayoutSchema,
} from "./template-layout-schema";

const ALL_RATIOS: BuzzAspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

function layoutForEachRatio(
  templateId: BuzzTemplateType,
  buildZones: (ratio: BuzzAspectRatio) => TemplateLayoutDefinition["zones"],
): TemplateLayoutDefinition[] {
  return ALL_RATIOS.map((aspectRatio) => ({
    templateId,
    aspectRatio,
    backgroundImageKey: backgroundImageKeyForRatio(aspectRatio),
    zones: buildZones(aspectRatio),
  }));
}

/** Player Spotlight — hero player on designer background */
const PLAYER_SPOTLIGHT_LAYOUTS: TemplateLayoutDefinition[] = layoutForEachRatio(
  BuzzTemplateType.PLAYER_SPOTLIGHT,
  (ratio) => {
    const landscape = ratio === "16:9";
    return {
      tournamentLogo: { flex: 0, minHeightRatio: landscape ? 0.14 : 0.12, align: "center" },
      tournamentName: { flex: 0, minHeightRatio: 0.04, align: "center" },
      playerPhoto: { flex: 1, align: "center", justify: "center" },
      playerName: { flex: 0, minHeightRatio: landscape ? 0.14 : 0.12, align: landscape ? "flex-start" : "center" },
      playerMeta: { flex: 0, minHeightRatio: 0.05, align: landscape ? "flex-start" : "center" },
      teamLogo: { flex: 0, minHeightRatio: 0.08, align: landscape ? "flex-start" : "center" },
      teamName: { flex: 0, minHeightRatio: 0.06, align: landscape ? "flex-start" : "center" },
      footerBranding: { flex: 0, minHeightRatio: 0.06, align: "center" },
    };
  },
);

/** Sold Player — sold status + price on designer background */
const SOLD_PLAYER_LAYOUTS: TemplateLayoutDefinition[] = layoutForEachRatio(
  BuzzTemplateType.SOLD_PLAYER,
  (ratio) => {
    const landscape = ratio === "16:9";
    return {
      tournamentLogo: { flex: 0, minHeightRatio: landscape ? 0.12 : 0.11, align: "center" },
      statusLabel: { flex: 0, minHeightRatio: 0.05, align: landscape ? "flex-start" : "center" },
      playerPhoto: { flex: 1, align: "center", justify: "center" },
      playerName: { flex: 0, minHeightRatio: 0.1, align: landscape ? "flex-start" : "center" },
      amount: { flex: 0, minHeightRatio: 0.1, align: landscape ? "flex-start" : "center" },
      teamLogo: { flex: 0, minHeightRatio: 0.07, align: landscape ? "flex-start" : "center" },
      teamName: { flex: 0, minHeightRatio: 0.06, align: landscape ? "flex-start" : "center" },
      footerBranding: { flex: 0, minHeightRatio: 0.06, align: "center" },
    };
  },
);

/** Top Buys — featured frame (4:5) or stack layout (other ratios / global bg) */
const TOP_BUYS_LAYOUTS: TemplateLayoutDefinition[] = ALL_RATIOS.map((aspectRatio) => {
  const landscape = aspectRatio === "16:9";
  if (aspectRatio === "4:5") {
    return {
      templateId: BuzzTemplateType.TOP_BUYS,
      aspectRatio,
      backgroundImageKey: backgroundImageKeyForRatio(aspectRatio),
      templateBackgroundImageKey: templateBackgroundImageKey(BuzzTemplateType.TOP_BUYS, aspectRatio),
      layoutMode: "absolute" as const,
      frames: TOP_BUYS_FEATURED_FRAMES_4_5.frames,
      zones: {},
    };
  }
  return {
    templateId: BuzzTemplateType.TOP_BUYS,
    aspectRatio,
    backgroundImageKey: backgroundImageKeyForRatio(aspectRatio),
    layoutMode: "stack" as const,
    zones: {
      tournamentLogo: { flex: 0, minHeightRatio: 0.1, align: "center" },
      title: { flex: 0, minHeightRatio: 0.08, align: "center" },
      subtitle: { flex: 0, minHeightRatio: 0.04, align: "center" },
      rank: { flex: 0, minHeightRatio: 0.04, align: landscape ? "flex-start" : "center" },
      playerPhoto: { flex: 0, minHeightRatio: landscape ? 0.35 : 0.22, align: "center", justify: "center" },
      playerName: { flex: 0, minHeightRatio: 0.08, align: "center" },
      amount: { flex: 0, minHeightRatio: 0.08, align: "center" },
      teamLogo: { flex: 0, minHeightRatio: 0.06, align: "center" },
      teamName: { flex: 0, minHeightRatio: 0.05, align: "center" },
      leaderboard: { flex: 1, align: "stretch", justify: "flex-start" },
      footerBranding: { flex: 0, minHeightRatio: 0.05, align: "center" },
    },
  };
});

/** Team Reveal — franchise reveal on designer background */
const TEAM_REVEAL_LAYOUTS: TemplateLayoutDefinition[] = layoutForEachRatio(
  BuzzTemplateType.TEAM_REVEAL,
  (ratio) => {
    const landscape = ratio === "16:9";
    return {
      tournamentLogo: { flex: 0, minHeightRatio: landscape ? 0.16 : 0.14, align: "center" },
      tournamentName: { flex: 0, minHeightRatio: 0.05, align: "center" },
      teamLogo: { flex: 1, align: "center", justify: "center" },
      teamName: { flex: 0, minHeightRatio: landscape ? 0.18 : 0.14, align: landscape ? "flex-start" : "center" },
      statsRow: { flex: 0, minHeightRatio: 0.15, align: landscape ? "flex-start" : "center" },
      footerBranding: { flex: 0, minHeightRatio: 0.06, align: "center" },
    };
  },
);

export const TEMPLATE_LAYOUT_SCHEMAS: TemplateLayoutSchema[] = [
  { templateId: BuzzTemplateType.PLAYER_SPOTLIGHT, layouts: PLAYER_SPOTLIGHT_LAYOUTS },
  { templateId: BuzzTemplateType.SOLD_PLAYER, layouts: SOLD_PLAYER_LAYOUTS },
  { templateId: BuzzTemplateType.TOP_BUYS, layouts: TOP_BUYS_LAYOUTS },
  { templateId: BuzzTemplateType.TEAM_REVEAL, layouts: TEAM_REVEAL_LAYOUTS },
];

const layoutIndex = new Map<string, TemplateLayoutDefinition>();
for (const schema of TEMPLATE_LAYOUT_SCHEMAS) {
  for (const layout of schema.layouts) {
    layoutIndex.set(`${layout.templateId}:${layout.aspectRatio}`, layout);
  }
}

export function getTemplateLayout(
  templateId: BuzzTemplateType,
  aspectRatio: BuzzAspectRatio,
): TemplateLayoutDefinition | undefined {
  return layoutIndex.get(`${templateId}:${aspectRatio}`);
}

export function getTemplateLayoutSchema(templateId: BuzzTemplateType): TemplateLayoutSchema | undefined {
  return TEMPLATE_LAYOUT_SCHEMAS.find((s) => s.templateId === templateId);
}
