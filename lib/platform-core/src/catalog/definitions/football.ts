import { def } from "./helpers.ts";

export const FOOTBALL_RULE_DEFINITIONS = [
  def({
    id: "football.match.duration_minutes",
    name: "Match duration (minutes)",
    description: "Placeholder regulation match duration for future football packs.",
    categoryId: "match",
    sportId: "football",
    type: "integer",
    defaultValue: 90,
    validation: { min: 1, max: 120 },
    status: "beta",
  }),
] as const;
