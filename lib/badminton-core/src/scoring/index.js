import { doublesScoringEngine, mixedDoublesScoringEngine, } from "./doubles-engine";
import { singlesScoringEngine } from "./singles-engine";
const ENGINE_MAP = {
    singles: singlesScoringEngine,
    doubles: doublesScoringEngine,
    mixed_doubles: mixedDoublesScoringEngine,
};
export function getScoringEngine(matchKind) {
    return ENGINE_MAP[matchKind];
}
export function isDoublesMatchKind(matchKind) {
    return matchKind === "doubles" || matchKind === "mixed_doubles";
}
export * from "./types";
export * from "./doubles-court";
export * from "./singles-engine";
export * from "./doubles-engine";
export * from "./display-utils";
export * from "./bwf-doubles-oracle";
export * from "./doubles-replay-derive";
export * from "./singles-replay-derive";
export * from "./scorer-assistance";
export * from "./venue-audio-cues";
