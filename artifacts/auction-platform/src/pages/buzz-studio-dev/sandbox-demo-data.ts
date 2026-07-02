/**
 * Buzz Studio Developer Sandbox — Demo Data Map
 *
 * Maps each BuzzTemplateType to its primary demo contract.
 * When adding a new template to the registry, add a demo entry here
 * alongside the component registration in template-registry.ts.
 *
 * No switch statements — lookup by template id only.
 */

import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import { DEMO_FULL_IMAGES } from "@/features/buzz-studio/templates/player-spotlight/demo-data";
import { demoFullData } from "@/features/buzz-studio/templates/sold-player/demo-data";
import { demoTop5 } from "@/features/buzz-studio/templates/top-buys/demo-data";
import { demoFullCricket } from "@/features/buzz-studio/templates/team-reveal/demo-data";

const SANDBOX_DEMO_DATA: Readonly<Partial<Record<BuzzTemplateType, unknown>>> = {
  [BuzzTemplateType.PLAYER_SPOTLIGHT]: DEMO_FULL_IMAGES,
  [BuzzTemplateType.SOLD_PLAYER]: demoFullData,
  [BuzzTemplateType.TOP_BUYS]: demoTop5,
  [BuzzTemplateType.TEAM_REVEAL]: demoFullCricket,
};

export function getSandboxDemoData(
  templateId: BuzzTemplateType,
): unknown {
  return SANDBOX_DEMO_DATA[templateId];
}
