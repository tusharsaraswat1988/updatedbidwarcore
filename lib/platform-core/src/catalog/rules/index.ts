import type { RuleProfileCatalogEntry } from "../types.ts";
import { BADMINTON_RULE_PROFILES } from "./badminton/standard.ts";
import { CRICKET_BOX_RULE_PROFILES } from "./cricket/box.ts";
import { CRICKET_CUSTOM_RULE_PROFILES } from "./cricket/custom.ts";
import { CRICKET_INDOOR_RULE_PROFILES } from "./cricket/indoor.ts";
import { CRICKET_OUTDOOR_RULE_PROFILES } from "./cricket/outdoor.ts";
import { CRICKET_TENNIS_BALL_RULE_PROFILES } from "./cricket/tennis-ball.ts";
import { FOOTBALL_RULE_PROFILES } from "./football/standard.ts";
import { LEGACY_RULE_PROFILES } from "./legacy.ts";

/** Internal aggregate — consumers must use CatalogRegistry only. */
export const RULE_PROFILE_CATALOG: readonly RuleProfileCatalogEntry[] = [
  ...CRICKET_OUTDOOR_RULE_PROFILES,
  ...CRICKET_BOX_RULE_PROFILES,
  ...CRICKET_TENNIS_BALL_RULE_PROFILES,
  ...CRICKET_INDOOR_RULE_PROFILES,
  ...CRICKET_CUSTOM_RULE_PROFILES,
  ...BADMINTON_RULE_PROFILES,
  ...FOOTBALL_RULE_PROFILES,
  ...LEGACY_RULE_PROFILES,
];
