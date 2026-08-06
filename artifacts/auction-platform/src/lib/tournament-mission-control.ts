/**
 * Tournament Mission Control — client orchestration helpers.
 * Presentation only. No new business rules / validation ownership.
 *
 * Phase 2: readiness strip + coarse health from auction readiness already on the page.
 * Per-module lock/health chips wire in Phase 3 from product-view facts.
 */

import type { PipelineStep } from "@/components/platform/platform-readiness-strip";
import type { ModuleHealthEntry } from "@/components/platform/tournament-health";
import type { AttentionItem } from "@/components/platform/attention-center";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";
import type { PlatformHealth } from "@/components/platform/health-badge";

export const TMC_PIPELINE_ORDER: {
  id: ModuleWorkspaceId;
  label: string;
}[] = [
  { id: "competition", label: "Competition" },
  { id: "teams", label: "Teams" },
  { id: "fixtures", label: "Fixtures" },
  { id: "scheduling", label: "Scheduling" },
  { id: "matches", label: "Matches" },
  { id: "runtime", label: "Runtime" },
  { id: "live_operations", label: "Live" },
];

/** Derive strip state from auction readiness + setup phase (existing page facts only). */
export function buildPlatformReadinessSteps(input: {
  isSetupPhase: boolean;
  readinessComplete: boolean;
}): PipelineStep[] {
  const setupComplete = !input.isSetupPhase || input.readinessComplete;

  return TMC_PIPELINE_ORDER.map((step) => {
    if (step.id === "live_operations") {
      return {
        id: step.id,
        label: step.label,
        state: setupComplete && !input.isSetupPhase ? "active" : "pending",
      };
    }

    if (setupComplete) {
      return { id: step.id, label: step.label, state: "complete" };
    }

    // Coarse: pipeline modules pending until readiness complete;
    // Competition marked active as the start of the platform pipeline.
    if (step.id === "competition") {
      return { id: step.id, label: step.label, state: "active" };
    }

    return { id: step.id, label: step.label, state: "pending" };
  });
}

/** Coarse module health until Phase 3 wires per-module product-view status. */
export function buildDefaultModuleHealth(input: {
  isSetupPhase: boolean;
  readinessComplete: boolean;
}): ModuleHealthEntry[] {
  const overall: PlatformHealth =
    input.isSetupPhase && !input.readinessComplete ? "warning" : "healthy";

  return TMC_PIPELINE_ORDER.map((step) => ({
    id: step.id,
    label: step.label,
    health:
      step.id === "live_operations" && input.isSetupPhase ? "warning" : overall,
  }));
}

/** Seed attention from auction readiness checklist — actionable fix links. */
export function buildAttentionFromReadiness(input: {
  readinessComplete: boolean;
  readinessChecks: { id: string; label: string; done: boolean; link?: string }[];
  isSetupPhase: boolean;
}): AttentionItem[] {
  if (!input.isSetupPhase || input.readinessComplete) return [];

  return input.readinessChecks
    .filter((c) => !c.done)
    .slice(0, 8)
    .map((c) => ({
      id: `readiness-${c.id}`,
      moduleId: "competition" as const,
      moduleLabel: "Setup",
      kind: "blocker" as const,
      message: c.label,
      action: c.link
        ? { label: "Fix", href: c.link }
        : { label: "Review", moduleId: "competition" as const },
    }));
}
