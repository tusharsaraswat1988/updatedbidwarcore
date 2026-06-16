import type { BadmintonMatchKind } from "../types";
import type { BadmintonScoringEngine } from "./types";
import {
  doublesScoringEngine,
  mixedDoublesScoringEngine,
} from "./doubles-engine";
import { singlesScoringEngine } from "./singles-engine";

const ENGINE_MAP: Record<BadmintonMatchKind, BadmintonScoringEngine> = {
  singles: singlesScoringEngine,
  doubles: doublesScoringEngine,
  mixed_doubles: mixedDoublesScoringEngine,
};

export function getScoringEngine(matchKind: BadmintonMatchKind): BadmintonScoringEngine {
  return ENGINE_MAP[matchKind];
}

export function isDoublesMatchKind(matchKind: BadmintonMatchKind | string): boolean {
  return matchKind === "doubles" || matchKind === "mixed_doubles";
}

export * from "./types";
export * from "./doubles-court";
export * from "./singles-engine";
export * from "./doubles-engine";
export * from "./display-utils";
export * from "./bwf-doubles-oracle";
