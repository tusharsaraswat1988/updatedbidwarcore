import type { PresentationProfileCatalogEntry } from "../types.ts";
import { BADMINTON_PRESENTATION } from "./badminton/standard.ts";
import { CRICKET_CORPORATE_BOX_PRESENTATION } from "./cricket/corporate-box.ts";
import { CRICKET_CUSTOM_PRESENTATION } from "./cricket/custom.ts";
import { CRICKET_INDOOR_BOX_PRESENTATION } from "./cricket/indoor-box.ts";
import { CRICKET_OUTDOOR_PRESENTATION } from "./cricket/outdoor.ts";
import { CRICKET_SOCIETY_PRESENTATION } from "./cricket/society.ts";
import { FOOTBALL_PRESENTATION } from "./football/standard.ts";

export { PRESENTATION_DEFINITION_CATALOG, getPresentationDefinition } from "./definitions/index.ts";
export {
  PRESENTATION_CAPABILITY_PROFILE_CATALOG,
  getCapabilityProfile,
} from "./capabilities/index.ts";

/** Internal aggregate — consumers must use CatalogRegistry only. */
export const PRESENTATION_PROFILE_CATALOG: readonly PresentationProfileCatalogEntry[] = [
  ...CRICKET_OUTDOOR_PRESENTATION,
  ...CRICKET_CORPORATE_BOX_PRESENTATION,
  ...CRICKET_INDOOR_BOX_PRESENTATION,
  ...CRICKET_SOCIETY_PRESENTATION,
  ...CRICKET_CUSTOM_PRESENTATION,
  ...BADMINTON_PRESENTATION,
  ...FOOTBALL_PRESENTATION,
];
