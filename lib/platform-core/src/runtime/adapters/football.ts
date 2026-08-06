import type { ResolvedRuleSnapshot } from "../../catalog/resolve/types.ts";
import type {
  FootballPlatformDefaultsDto,
  RuntimeAdapter,
  RuntimeAdapterResult,
} from "../contracts/types.ts";

export const FootballRuntimeAdapter: RuntimeAdapter<FootballPlatformDefaultsDto> = {
  sportId: "football",
  translate(snapshot: ResolvedRuleSnapshot): RuntimeAdapterResult<FootballPlatformDefaultsDto> {
    if (snapshot.runtimeBinding.runtimeBindingType !== "football_platform_defaults") {
      return {
        ok: false,
        error: `Unexpected binding type ${snapshot.runtimeBinding.runtimeBindingType}`,
      };
    }
    const entry = snapshot.values.find(
      (v) => v.definitionId === "football.match.duration_minutes",
    );
    const durationMinutes =
      typeof entry?.resolvedValue === "number" ? entry.resolvedValue : 90;
    return { ok: true, dto: { durationMinutes } };
  },
};
