import { getCapabilityProfile } from "./catalog-access.ts";
import { computeAdaptationHash } from "./hash.ts";
import type {
  CapabilityCompilerResult,
  EngineIssue,
  FeatureState,
  ResolvedPresentationContract,
  SlotState,
  StageResult,
} from "./types.ts";
import {
  PRESENTATION_ENGINE_VERSION,
  PRESENTATION_SCHEMA_VERSION,
} from "./versions.ts";

/** Features that Capability Profiles may omit (disable) when unsupported. */
const OMITTABLE_FEATURE_IDS = new Set([
  "presentation.feature.animation",
  "presentation.feature.ticker",
  "presentation.feature.player_card",
  "presentation.feature.sponsor_strip",
  "presentation.feature.clock",
]);

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Phase B — accepts ResolvedPresentationContract only.
 * May disable/omit optional capabilities; never substitute or transform semantics.
 */
export function adapt(
  contract: ResolvedPresentationContract,
  capabilityProfileId: string,
  capabilityProfileVersion?: string | null,
): CapabilityCompilerResult {
  const started = nowMs();
  const issues: EngineIssue[] = [];
  const profile = getCapabilityProfile(capabilityProfileId, capabilityProfileVersion);

  if (!profile) {
    issues.push({
      kind: "invalid",
      severity: "ERROR",
      code: "UNKNOWN_CAPABILITY_PROFILE",
      message: `Unknown capability profile ${capabilityProfileId}`,
      origin: "capability",
    });
    return buildResult(false, null, null, issues, started, null);
  }

  const supported = new Set([
    ...profile.optionalCapabilities,
    ...profile.requiredCapabilities,
  ]);
  const disabledByCapability: string[] = [];

  const features: FeatureState[] = contract.features.map((f) => {
    if (
      f.state === "enabled" &&
      OMITTABLE_FEATURE_IDS.has(f.featureId) &&
      !supported.has(f.featureId)
    ) {
      disabledByCapability.push(f.featureId);
      return {
        ...f,
        state: "disabled" as const,
        reasonCode: "CAPABILITY_OMIT",
        resolvedBy: `CapabilityProfile:${profile.id}@${profile.version}`,
      };
    }
    return f;
  });

  const featureOn = new Map(features.map((f) => [f.featureId, f.state === "enabled"] as const));

  for (const req of profile.requiredCapabilities) {
    const onAdapted = featureOn.get(req) === true;
    if (!onAdapted) {
      issues.push({
        kind: "unresolvable",
        severity: "ERROR",
        code: "REQUIRED_FEATURE_UNAVAILABLE",
        message: `Required capability unavailable after adaptation: ${req}`,
        origin: "capability",
        path: req,
      });
    }
  }

  const slots: SlotState[] = contract.slots.map((s) => {
    const occupied = s.featureId ? featureOn.get(s.featureId) === true : s.occupied;
    return {
      ...s,
      occupied,
      reason: occupied ? s.reason : "Capability Omit",
    };
  });

  const ok = !issues.some((i) => i.severity === "ERROR");
  const disabledSorted = [...new Set(disabledByCapability)].sort();
  const adaptationHash = computeAdaptationHash(
    contract,
    disabledSorted,
    profile.id,
    profile.version,
  );

  const adapted = ok
    ? Object.freeze({
        ...contract,
        features: Object.freeze(features),
        slots: Object.freeze(slots),
        adaptationHash,
        disabledByCapability: Object.freeze(disabledSorted),
      })
    : null;

  return buildResult(
    ok,
    adapted,
    adaptationHash,
    issues,
    started,
    contract.presentationContractVersion,
  );
}

function buildResult(
  ok: boolean,
  adapted: CapabilityCompilerResult["adaptedPresentationContract"],
  adaptationHash: string | null,
  issues: EngineIssue[],
  started: number,
  contractVersion: string | null,
): CapabilityCompilerResult {
  const stage: StageResult = Object.freeze({
    stage: "capability_adaptation",
    started: true,
    completed: true,
    success: ok,
    warnings: Object.freeze(issues.filter((i) => i.severity === "WARNING")),
    errors: Object.freeze(issues.filter((i) => i.severity === "ERROR")),
    durationMs: Math.round(nowMs() - started),
  });
  return Object.freeze({
    ok,
    adaptedPresentationContract: adapted,
    adaptationHash,
    stages: Object.freeze([stage]),
    diagnostics: Object.freeze({ issues: Object.freeze([...issues]) }),
    durationMs: Math.round(nowMs() - started),
    engineVersion: PRESENTATION_ENGINE_VERSION,
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    contractVersion,
  });
}

export const CapabilityCompiler = {
  adapt,
} as const;
