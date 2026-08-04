import type { VariantCatalogEntry } from "../types.ts";
import { BADMINTON_VARIANTS } from "./badminton.ts";
import { CRICKET_VARIANTS } from "./cricket.ts";
import { FOOTBALL_VARIANTS } from "./football.ts";

export const VARIANT_CATALOG: readonly VariantCatalogEntry[] = [
  ...CRICKET_VARIANTS,
  ...BADMINTON_VARIANTS,
  ...FOOTBALL_VARIANTS,
];
