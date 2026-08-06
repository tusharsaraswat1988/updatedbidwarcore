import type { RuleDefinitionEntry } from "../types.ts";
import { BADMINTON_RULE_DEFINITIONS } from "./badminton.ts";
import { CRICKET_RULE_DEFINITIONS } from "./cricket.ts";
import { FOOTBALL_RULE_DEFINITIONS } from "./football.ts";

/** Internal aggregate — consumers must use CatalogRegistry only. */
export const RULE_DEFINITION_CATALOG: readonly RuleDefinitionEntry[] = [
  ...CRICKET_RULE_DEFINITIONS,
  ...BADMINTON_RULE_DEFINITIONS,
  ...FOOTBALL_RULE_DEFINITIONS,
];

export { value } from "./helpers.ts";
