import type { ResolvedRuleSnapshot } from "../../catalog/resolve/types.ts";
import type {
  CricketPlatformDefaultsDto,
  RuntimeAdapter,
  RuntimeAdapterResult,
} from "../contracts/types.ts";

function num(
  snapshot: ResolvedRuleSnapshot,
  id: string,
  fallback: number,
): number {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "number"
    ? entry.resolvedValue
    : fallback;
}

function bool(
  snapshot: ResolvedRuleSnapshot,
  id: string,
  fallback: boolean,
): boolean {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "boolean"
    ? entry.resolvedValue
    : fallback;
}

function str(
  snapshot: ResolvedRuleSnapshot,
  id: string,
  fallback: string,
): string {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  return typeof entry?.resolvedValue === "string"
    ? entry.resolvedValue
    : fallback;
}

function nullableNum(
  snapshot: ResolvedRuleSnapshot,
  id: string,
): number | null {
  const entry = snapshot.values.find((v) => v.definitionId === id);
  if (entry?.resolvedValue === null) return null;
  return typeof entry?.resolvedValue === "number" ? entry.resolvedValue : null;
}

/** Documents current cricket defaults — preview/translate only. */
export const CricketRuntimeAdapter: RuntimeAdapter<CricketPlatformDefaultsDto> =
  {
    sportId: "cricket",
    translate(
      snapshot: ResolvedRuleSnapshot,
    ): RuntimeAdapterResult<CricketPlatformDefaultsDto> {
      if (
        snapshot.runtimeBinding.runtimeBindingType !==
        "cricket_platform_defaults"
      ) {
        return {
          ok: false,
          error: `Unexpected binding type ${snapshot.runtimeBinding.runtimeBindingType}`,
        };
      }
      return {
        ok: true,
        dto: {
          oversLimit: num(snapshot, "cricket.match.overs_per_innings", 20),
          maxWickets: num(snapshot, "cricket.match.max_wickets", 10),
          playingSquadSize: num(
            snapshot,
            "cricket.match.playing_squad_size",
            11,
          ),
          playingXiEnforced: bool(
            snapshot,
            "cricket.match.playing_xi_enforced",
            false,
          ),
          benchSize: num(snapshot, "cricket.match.bench_size", 4),
          ballsPerOver: num(snapshot, "cricket.match.balls_per_over", 6),
          ballType: str(snapshot, "cricket.match.ball_type", "leather"),
          lbwEnabled: bool(snapshot, "cricket.dismissal.lbw_enabled", true),
          legByeEnabled: bool(snapshot, "cricket.extras.leg_bye_enabled", true),
          freeHitEnabled: bool(
            snapshot,
            "cricket.bowling.free_hit_enabled",
            true,
          ),
          retireAtRuns: nullableNum(snapshot, "cricket.batting.retire_at_runs"),
          powerplayEnabled: bool(snapshot, "cricket.powerplay.enabled", true),
          superOverEnabled: bool(
            snapshot,
            "cricket.tie_break.super_over_enabled",
            true,
          ),
          superBallEnabled: bool(
            snapshot,
            "cricket.special.super_ball_enabled",
            false,
          ),
          superOverOvers: num(
            snapshot,
            "cricket.tie_break.super_over_overs",
            1,
          ),
          superOverWickets: num(
            snapshot,
            "cricket.tie_break.super_over_wickets",
            2,
          ),
          superOverTrigger: str(
            snapshot,
            "cricket.tie_break.super_over_trigger",
            "manual",
          ),
        },
      };
    },
  };
