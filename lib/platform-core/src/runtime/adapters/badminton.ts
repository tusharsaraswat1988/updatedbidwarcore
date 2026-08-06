import type { ResolvedRuleSnapshot } from "../../catalog/resolve/types.ts";
import type {
  BadmintonMatchFormatDto,
  RuntimeAdapter,
  RuntimeAdapterResult,
} from "../contracts/types.ts";

function num(snapshot: ResolvedRuleSnapshot, id: string, fallback: number): number {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "number" ? entry.resolvedValue : fallback;
}

function bool(snapshot: ResolvedRuleSnapshot, id: string, fallback: boolean): boolean {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "boolean" ? entry.resolvedValue : fallback;
}

function str(snapshot: ResolvedRuleSnapshot, id: string, fallback: string): string {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "string" ? entry.resolvedValue : fallback;
}

/**
 * Translates ResolvedRuleSnapshot → badminton match-format DTO.
 * Does not call badminton-core; numbers mirror current presets.
 */
export const BadmintonRuntimeAdapter: RuntimeAdapter<BadmintonMatchFormatDto> = {
  sportId: "badminton",
  translate(snapshot: ResolvedRuleSnapshot): RuntimeAdapterResult<BadmintonMatchFormatDto> {
    if (snapshot.runtimeBinding.runtimeBindingType !== "badminton_match_format") {
      return {
        ok: false,
        error: `Unexpected binding type ${snapshot.runtimeBinding.runtimeBindingType}`,
      };
    }
    const presetId = snapshot.runtimeBinding.runtimeBindingId || str(
      snapshot,
      "badminton.tournament.preset_id",
      "standard_bwf",
    );
    return {
      ok: true,
      dto: {
        presetId,
        format: {
          totalGames: num(snapshot, "badminton.match.total_games", 3),
          pointsPerGame: num(snapshot, "badminton.match.points_per_game", 21),
          deuceAt: num(snapshot, "badminton.match.deuce_at", 20),
          maxPoints: num(snapshot, "badminton.match.max_points", 30),
          midGameSideChange: bool(snapshot, "badminton.match.mid_game_side_change", true),
        },
      },
    };
  },
};
