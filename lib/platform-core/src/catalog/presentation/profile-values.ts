import { pvalue } from "./helpers.ts";
import type { PresentationProfileValueEntry } from "../types.ts";

/** Standard pack values documenting current production defaults (dark-launch feedstock). */
export function standardPresentationValues(input?: {
  animation?: boolean;
  ticker?: boolean;
}): readonly PresentationProfileValueEntry[] {
  return [
    pvalue("presentation.feature.sponsor_strip", true),
    pvalue("presentation.feature.clock", true),
    pvalue("presentation.feature.primary_score", true),
    pvalue("presentation.feature.ticker", input?.ticker ?? true),
    pvalue("presentation.feature.animation", input?.animation ?? false),
    pvalue("presentation.feature.player_card", true),
    pvalue("presentation.token.color.primary", "color.primary"),
    pvalue("presentation.token.font.score", "font.score"),
  ];
}
