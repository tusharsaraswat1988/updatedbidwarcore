/**
 * Match Start verification — NEVER calls RuleEngine.resolve().
 * Verifies snapshotVersion / resolutionId / rulesHash bound at Runtime Prepare.
 */

export type RuleResolutionBind = {
  readonly resolutionId: string;
  readonly rulesHash: string;
  readonly runtimeRulesVersion: string;
  readonly snapshotVersion: number;
};

export type MatchStartVerifyInput = {
  readonly currentRuntimeVersion: number | null | undefined;
  readonly runtimePrepMetadata: Record<string, unknown> | null | undefined;
};

export type MatchStartVerifyResult =
  | { ok: true; bind: RuleResolutionBind }
  | { ok: false; code: string; error: string };

function asBind(raw: unknown): RuleResolutionBind | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const resolutionId = typeof o.resolutionId === "string" ? o.resolutionId : null;
  const rulesHash = typeof o.rulesHash === "string" ? o.rulesHash : null;
  const runtimeRulesVersion =
    typeof o.runtimeRulesVersion === "string" ? o.runtimeRulesVersion : null;
  const snapshotVersion =
    typeof o.snapshotVersion === "number" ? o.snapshotVersion : null;
  if (!resolutionId || !rulesHash || !runtimeRulesVersion || snapshotVersion == null) {
    return null;
  }
  return { resolutionId, rulesHash, runtimeRulesVersion, snapshotVersion };
}

/** Read Prepare-bound resolution identity from runtime prep metadata. */
export function readRuleResolutionBind(
  runtimePrepMetadata: Record<string, unknown> | null | undefined,
): RuleResolutionBind | null {
  if (!runtimePrepMetadata) return null;
  return asBind(runtimePrepMetadata.ruleResolution);
}

/**
 * Fail-closed Match Start gate.
 * No successful Runtime Prepare bind ⇒ No Match Start.
 */
export function verifyMatchStartContract(
  input: MatchStartVerifyInput,
): MatchStartVerifyResult {
  if (input.currentRuntimeVersion == null) {
    return {
      ok: false,
      code: "RUNTIME_PREPARE_REQUIRED",
      error: "Runtime Prepare is mandatory before Match Start. No snapshotVersion bound.",
    };
  }

  const bind = readRuleResolutionBind(input.runtimePrepMetadata);
  if (!bind) {
    return {
      ok: false,
      code: "RUNTIME_PREPARE_REQUIRED",
      error:
        "Runtime Prepare is mandatory before Match Start. Missing resolutionId / rulesHash bind.",
    };
  }

  if (bind.snapshotVersion !== input.currentRuntimeVersion) {
    return {
      ok: false,
      code: "SNAPSHOT_VERSION_MISMATCH",
      error: `Bound snapshotVersion ${bind.snapshotVersion} does not match currentRuntimeVersion ${input.currentRuntimeVersion}.`,
    };
  }

  if (!bind.resolutionId || !bind.rulesHash) {
    return {
      ok: false,
      code: "RESOLUTION_BIND_INCOMPLETE",
      error: "Match Start verification failed: resolutionId or rulesHash missing.",
    };
  }

  return { ok: true, bind };
}

/** Build prep metadata fragment that stores resolution identity only (no rule bodies). */
export function buildRuleResolutionPrepMetadata(
  bind: RuleResolutionBind,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  // Never persist ResolvedRuntimeRules / RuntimeExecutionPolicy bodies here.
  delete base.resolvedRuntimeRules;
  delete base.runtimeExecutionPolicy;
  delete base.rulesJson;
  return {
    ...base,
    ruleResolution: {
      resolutionId: bind.resolutionId,
      rulesHash: bind.rulesHash,
      runtimeRulesVersion: bind.runtimeRulesVersion,
      snapshotVersion: bind.snapshotVersion,
    },
  };
}
