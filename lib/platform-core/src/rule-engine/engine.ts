import { buildDiagnostics } from "./diagnostics.ts";
import { compileStage, shouldCompile } from "./stages/compile.ts";
import { resolveStage } from "./stages/resolve.ts";
import { verifyStage } from "./stages/verify.ts";
import type { RuleEngineInput, RuleEngineResult, RuleResolutionContext } from "./types.ts";
import { RULE_ENGINE_INPUT_VERSION, RULE_ENGINE_VERSION } from "./versions.ts";

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Primary Rule Engine API.
 * Every public resolution path MUST eventually call this function.
 * Referentially transparent aside from optional durationMs diagnostic.
 */
export function resolve(input: RuleEngineInput): RuleEngineResult {
  const started = nowMs();
  const stagesCompleted: ("verification" | "resolution" | "compilation")[] = [];

  const verification = verifyStage(input);
  stagesCompleted.push("verification");

  const resolution = resolveStage(input, verification);
  if (verification.ok) {
    stagesCompleted.push("resolution");
  }

  const compile = shouldCompile(input, resolution.ok);
  let resolvedRuntimeRules = null;
  if (compile) {
    resolvedRuntimeRules = compileStage(input, resolution);
    if (resolvedRuntimeRules) stagesCompleted.push("compilation");
  }

  const ok = resolution.ok;
  const resolutionId = resolvedRuntimeRules?.resolutionId ?? null;

  const diagnostics = buildDiagnostics({
    resolution: {
      resolutionId,
      engineVersion: RULE_ENGINE_VERSION,
      stagesCompleted: [...stagesCompleted],
      layersApplied: resolution.layersApplied,
      overridesApplied: resolution.overridesApplied,
      compiled: !!resolvedRuntimeRules,
      ok,
    },
    structural: verification.structural,
    semantic: resolution.semantic,
    dependency: resolution.dependency,
    conflict: resolution.conflict,
    compatibility: resolution.compatibility,
  });

  const durationMs = Math.round(nowMs() - started);

  return Object.freeze({
    ok,
    resolutionId,
    engineVersion: RULE_ENGINE_VERSION,
    resolvedRuleSnapshot: resolution.snapshot,
    resolvedRuntimeRules,
    diagnostics,
    durationMs,
  });
}

export function preview(context: RuleResolutionContext): RuleEngineResult {
  return resolve({
    inputVersion: RULE_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: { ...context, resolutionMode: "PREVIEW" },
    compile: false,
  });
}

export function validate(input: RuleEngineInput): RuleEngineResult {
  return resolve({
    ...input,
    context: { ...input.context, resolutionMode: "VALIDATE" },
    compile: false,
  });
}

export const RuleEngine = {
  resolve,
  preview,
  validate,
} as const;

export function ruleEngineResultOk(result: RuleEngineResult): boolean {
  return result.ok;
}
