import type { CompetitionConfiguration } from "./types.ts";
import type { TournamentTransitionRequest } from "./types.ts";
import { TRANSITION_POLICY_VERSION } from "./types.ts";

/**
 * Transition Rules — decide whether / which Tournament State transition to request.
 * Named policy, not a hardcoded invariant. Tournament State Machine remains sole authority.
 */
export function resolveTransitionRequest(
  config: CompetitionConfiguration,
  event: "competition_ready" | "configuration_locked",
): TournamentTransitionRequest {
  const competitionTypeId = config.competitionTypeId ?? "practice";

  if (event !== "competition_ready" && event !== "configuration_locked") {
    return {
      requestedTournamentState: null,
      reason: "No transition for this event.",
      policyId: `default@${TRANSITION_POLICY_VERSION}`,
    };
  }

  // Practice / instant-friendly style: skip Draw Ready when no formal draw is expected.
  if (competitionTypeId === "practice") {
    return {
      requestedTournamentState: "ready_to_start",
      reason:
        "Practice competitions may proceed without a formal draw (Transition Rules default).",
      policyId: `practice_skip_draw@${TRANSITION_POLICY_VERSION}`,
    };
  }

  // Standard path: Configuration Locked → request Draw Ready.
  return {
    requestedTournamentState: "draw_ready",
    reason: "Competition Setup locked; request Draw Ready per default Transition Rules.",
    policyId: `default_competition_ready@${TRANSITION_POLICY_VERSION}`,
  };
}
