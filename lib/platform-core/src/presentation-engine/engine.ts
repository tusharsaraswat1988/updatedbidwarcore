import { runPresentationPipeline } from "./pipeline.ts";
import type {
  PresentationEngineInput,
  PresentationEngineResult,
  PresentationResolutionContext,
} from "./types.ts";
import {
  PRESENTATION_ENGINE_INPUT_VERSION,
  PRESENTATION_ENGINE_VERSION,
  PRESENTATION_SCHEMA_VERSION,
} from "./versions.ts";

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Sole Phase A computation entry.
 * Every public resolution path MUST eventually call this function.
 */
export function resolve(input: PresentationEngineInput): PresentationEngineResult {
  const started = nowMs();
  const out = runPresentationPipeline(input);
  const durationMs = Math.round(nowMs() - started);

  return Object.freeze({
    ok: out.ok,
    resolutionId: out.contract?.resolutionId ?? null,
    engineVersion: PRESENTATION_ENGINE_VERSION,
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    inputVersion: input.inputVersion,
    contractVersion: out.contract?.presentationContractVersion ?? null,
    resolvedPresentationSnapshot: out.snapshot,
    resolvedPresentationContract: out.contract,
    stages: Object.freeze([...out.stages]),
    compilation: out.compilation,
    diagnostics: Object.freeze({
      stages: Object.freeze([...out.stages]),
      issues: Object.freeze([...out.issues]),
      layoutGraph: out.layoutGraph,
      styleGraph: out.styleGraph,
      compatible: out.compatible,
    }),
    durationMs,
  });
}

export function preview(context: PresentationResolutionContext): PresentationEngineResult {
  return resolve({
    inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: { ...context, resolutionMode: "PREVIEW" },
    compilationMode: "NONE",
  });
}

export function validate(input: PresentationEngineInput): PresentationEngineResult {
  return resolve({
    ...input,
    context: { ...input.context, resolutionMode: "VALIDATE" },
    compilationMode: "NONE",
  });
}

export const PresentationEngine = {
  resolve,
  preview,
  validate,
} as const;

export function presentationEngineResultOk(result: PresentationEngineResult): boolean {
  return result.ok;
}
