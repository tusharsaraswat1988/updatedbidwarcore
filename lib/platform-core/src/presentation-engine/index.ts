/**
 * EPIC-10 Presentation Engine — public surface.
 * CatalogRegistry owns discovery; Presentation Engine owns Phase A computation.
 * CapabilityCompiler owns Phase B adaptation (contract-only input).
 *
 * EPIC-12 Phase 1 — Prepare cutover helpers (policy / adapter / verify) are runtime-facing
 * only; they do not change engine resolution ownership.
 */

export {
  PresentationEngine,
  resolve,
  preview,
  validate,
  presentationEngineResultOk,
} from "./engine.ts";
export { CapabilityCompiler, adapt } from "./capability-compiler.ts";
export { buildPresentationResolutionContextFromParts } from "./context-builder.ts";
export type { PresentationResolutionContextParts } from "./context-builder.ts";
export {
  PRESENTATION_ENGINE_VERSION,
  PRESENTATION_ENGINE_INPUT_VERSION,
  PRESENTATION_SCHEMA_VERSION,
  PRESENTATION_CONTRACT_VERSION,
  PRESENTATION_COMPILER_VERSION,
} from "./versions.ts";

export {
  PRESENTATION_EXECUTION_POLICY_SCHEMA_VERSION,
  buildPresentationExecutionPolicy,
} from "./execution-policy.ts";
export type {
  PresentationExecutionPolicy,
  PresentationExecutionToken,
  PresentationExecutionFeature,
  PresentationExecutionSlot,
} from "./execution-policy.ts";

export { projectPresentationExecutionPolicyToPaintJson } from "./compatibility-adapter.ts";
export type {
  CompatibilityPresentationPaintJson,
  CompatibilityDisplayThemeId,
  CompatibilityBroadcastThemeId,
} from "./compatibility-adapter.ts";

export {
  verifyPresentationMatchStartContract,
  readPresentationResolutionBind,
  buildPresentationResolutionPrepMetadata,
} from "./match-start-verify.ts";
export type {
  PresentationResolutionBind,
  PresentationMatchStartVerifyInput,
  PresentationMatchStartVerifyResult,
} from "./match-start-verify.ts";

export { buildPreparePresentationEngineInput } from "./prepare-resolve.ts";
export type { PreparePresentationBindings } from "./prepare-resolve.ts";

export type {
  PresentationEngineInput,
  PresentationEngineResult,
  PresentationEngineDiagnostics,
  PresentationResolutionContext,
  PresentationResolutionMode,
  CompilationMode,
  ResolvedPresentationSnapshot,
  ResolvedPresentationContract,
  AdaptedPresentationContract,
  CapabilityCompilerResult,
  FeatureState,
  SlotState,
  EngineIssue,
  PresentationOverrideDocument,
} from "./types.ts";
