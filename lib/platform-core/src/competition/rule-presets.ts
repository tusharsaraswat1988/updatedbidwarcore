/**
 * Cricket Rule Presets Summary & Resolution (EPIC-Rule-Presets).
 *
 * Resolves effective rule parameters (overs, wickets, squad size, etc.)
 * by combining:
 * 1. Base Rule Profile from catalog (e.g. cricket.box.bpl_kids -> 5 overs, 6 wickets, 7 players)
 * 2. Overrides from preset.ruleOverridesJson (checking both structured values and legacy flat keys)
 * 3. Fallback defaults based on cricket variant.
 */

import { CatalogRegistry } from "../catalog/registry.ts";

export type CricketRulePresetLike = {
  name?: string | null;
  variantId?: string | null;
  ruleProfileId?: string | null;
  ruleProfileVersion?: string | null;
  ruleOverridesJson?: Record<string, unknown> | null;
  squadRulesJson?: Record<string, unknown> | null;
  isDefault?: boolean | null;
};

export type CricketRulePresetSummary = {
  overs: number;
  wickets: number;
  squadSize: number;
  ballsPerOver: number;
  ballType: string;
};

/**
 * Resolves the effective parameters of a rule preset.
 */
export function resolveCricketRulePresetSummary(
  preset?: CricketRulePresetLike | null,
): CricketRulePresetSummary {
  if (!preset) {
    return {
      overs: 20,
      wickets: 10,
      squadSize: 11,
      ballsPerOver: 6,
      ballType: "leather",
    };
  }

  // 1. Resolve rule profile baseline from catalog
  let profile = null;
  if (preset.ruleProfileId) {
    profile =
      CatalogRegistry.getRuleProfile(
        preset.ruleProfileId,
        preset.ruleProfileVersion,
      ) ?? CatalogRegistry.getRuleProfile(preset.ruleProfileId);
  }

  const baseline: Record<string, unknown> = {};
  if (profile?.values) {
    for (const entry of profile.values) {
      if (entry.value !== "inherit" && entry.value !== undefined) {
        baseline[entry.definitionId] = entry.value;
      }
    }
  }

  // 2. Extract overrides & squad rules
  const rawOverrides = (preset.ruleOverridesJson ?? {}) as Record<string, any>;
  const nestedValues = (
    rawOverrides.values &&
    typeof rawOverrides.values === "object" &&
    !Array.isArray(rawOverrides.values)
      ? rawOverrides.values
      : {}
  ) as Record<string, any>;
  const rawSquadRules = (preset.squadRulesJson ?? {}) as Record<string, any>;

  // 3. Fallback defaults by variant
  const isBox = preset.variantId === "cricket.box";
  const defaultOvers = isBox ? 6 : 20;
  const defaultWickets = 10;
  const defaultSquadSize = isBox ? 8 : 11;
  const defaultBallType = isBox ? "tennis" : "leather";

  // 4. Resolve overs
  const overs =
    typeof nestedValues["cricket.match.overs_per_innings"] === "number" &&
    nestedValues["cricket.match.overs_per_innings"] > 0
      ? nestedValues["cricket.match.overs_per_innings"]
      : typeof rawOverrides.overs === "number" && rawOverrides.overs > 0
        ? rawOverrides.overs
        : typeof baseline["cricket.match.overs_per_innings"] === "number" &&
          baseline["cricket.match.overs_per_innings"] > 0
          ? (baseline["cricket.match.overs_per_innings"] as number)
          : defaultOvers;

  // 5. Resolve wickets
  const wickets =
    typeof nestedValues["cricket.match.max_wickets"] === "number" &&
    nestedValues["cricket.match.max_wickets"] > 0
      ? nestedValues["cricket.match.max_wickets"]
      : typeof nestedValues["cricket.match.wickets_per_innings"] === "number" &&
        nestedValues["cricket.match.wickets_per_innings"] > 0
        ? nestedValues["cricket.match.wickets_per_innings"]
        : typeof rawOverrides.maxWickets === "number" &&
          rawOverrides.maxWickets > 0
          ? rawOverrides.maxWickets
          : typeof rawOverrides.wickets === "number" && rawOverrides.wickets > 0
            ? rawOverrides.wickets
            : typeof baseline["cricket.match.max_wickets"] === "number" &&
              baseline["cricket.match.max_wickets"] > 0
              ? (baseline["cricket.match.max_wickets"] as number)
              : defaultWickets;

  // 6. Resolve squad size (Playing XI)
  const squadSize =
    typeof nestedValues["cricket.match.playing_squad_size"] === "number" &&
    nestedValues["cricket.match.playing_squad_size"] > 0
      ? nestedValues["cricket.match.playing_squad_size"]
      : typeof rawOverrides.playingSquadSize === "number" &&
        rawOverrides.playingSquadSize > 0
        ? rawOverrides.playingSquadSize
        : typeof rawOverrides.squadSize === "number" && rawOverrides.squadSize > 0
          ? rawOverrides.squadSize
          : typeof rawSquadRules.playingSquadSize === "number" &&
            rawSquadRules.playingSquadSize > 0
            ? rawSquadRules.playingSquadSize
            : typeof baseline["cricket.match.playing_squad_size"] === "number" &&
              baseline["cricket.match.playing_squad_size"] > 0
              ? (baseline["cricket.match.playing_squad_size"] as number)
              : defaultSquadSize;

  // 7. Resolve balls per over
  const ballsPerOver =
    typeof nestedValues["cricket.match.balls_per_over"] === "number" &&
    nestedValues["cricket.match.balls_per_over"] > 0
      ? nestedValues["cricket.match.balls_per_over"]
      : typeof rawOverrides.ballsPerOver === "number" &&
        rawOverrides.ballsPerOver > 0
        ? rawOverrides.ballsPerOver
        : typeof baseline["cricket.match.balls_per_over"] === "number" &&
          baseline["cricket.match.balls_per_over"] > 0
          ? (baseline["cricket.match.balls_per_over"] as number)
          : 6;

  // 8. Resolve ball type
  const ballType =
    typeof nestedValues["cricket.match.ball_type"] === "string" &&
    nestedValues["cricket.match.ball_type"].trim() !== ""
      ? nestedValues["cricket.match.ball_type"]
      : typeof rawOverrides.ballType === "string" &&
        rawOverrides.ballType.trim() !== ""
        ? rawOverrides.ballType
        : typeof baseline["cricket.match.ball_type"] === "string" &&
          (baseline["cricket.match.ball_type"] as string).trim() !== ""
          ? (baseline["cricket.match.ball_type"] as string)
          : defaultBallType;

  return {
    overs,
    wickets,
    squadSize,
    ballsPerOver,
    ballType,
  };
}

/**
 * Formats a clean descriptive label for dropdowns and selectors.
 * e.g. "BPL LEAGUE MATCHES — 5 Overs · 7 Wkts · 7 Players"
 */
export function formatCricketRulePresetLabel(
  preset: CricketRulePresetLike,
  options?: { isDefault?: boolean },
): string {
  const summary = resolveCricketRulePresetSummary(preset);
  const defaultSuffix =
    options?.isDefault ?? preset.isDefault ? " (Tournament Default)" : "";
  const name = preset.name || "Match Rules";
  return `${name}${defaultSuffix} — ${summary.overs} Overs · ${summary.wickets} Wkts · ${summary.squadSize} Players`;
}
