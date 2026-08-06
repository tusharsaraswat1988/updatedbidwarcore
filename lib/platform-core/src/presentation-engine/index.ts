/**
 * EPIC-10 Presentation Engine — public surface.
 * CatalogRegistry owns discovery; Presentation Engine owns Phase A computation.
 * CapabilityCompiler owns Phase B adaptation (contract-only input).
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
