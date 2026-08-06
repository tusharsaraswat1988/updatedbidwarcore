import type { PlatformHealth } from "@/components/platform/health-badge";
import type { DependencyChip, DependencyChipState } from "@/components/platform/dependency-chips";
import type { AttentionItem } from "@/components/platform/attention-center";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";
import type { ModuleSnapshot } from "@/components/tournament-hub/module-registry";
import type { PlatformValidationIssue } from "@/components/platform/types";
import type { HistoryEntry } from "@/components/platform/history-panel";

export function deriveModuleHealth(input: {
  errorCount: number;
  warningCount: number;
  loading?: boolean;
  entityCount?: number;
}): PlatformHealth {
  if (input.loading) return "warning";
  if (input.errorCount > 0) return "blocked";
  if (input.warningCount > 0 || input.entityCount === 0) return "warning";
  return "healthy";
}

export function aggregateValidationIssues(
  issues: PlatformValidationIssue[],
  max = 8,
): PlatformValidationIssue[] {
  return issues.slice(0, max);
}

export function buildValidationAttentionItems(input: {
  moduleId: ModuleWorkspaceId;
  moduleLabel: string;
  issues: PlatformValidationIssue[];
}): AttentionItem[] {
  return input.issues.map((issue, index) => ({
    id: `${input.moduleId}-validation-${issue.code}-${index}`,
    moduleId: input.moduleId,
    moduleLabel: input.moduleLabel,
    kind: issue.severity === "ERROR" ? "blocker" : issue.severity === "WARNING" ? "warning" : "recommendation",
    message: issue.message,
    action:
      issue.severity === "ERROR"
        ? { label: "Review", moduleId: input.moduleId }
        : undefined,
  }));
}

export function buildRecommendationHistory(recommendations: string[]): HistoryEntry[] {
  return recommendations.map((text, index) => ({
    id: `rec-${index}`,
    label: text,
  }));
}

export function dependencyState(met: boolean, partial?: boolean): DependencyChipState {
  if (met) return "met";
  if (partial) return "warning";
  return "missing";
}

export function buildCompetitionDependencies(): DependencyChip[] {
  return [{ id: "tournament", label: "Tournament", state: "met" }];
}

export function buildTeamDependencies(competition?: ModuleSnapshot): DependencyChip[] {
  const competitionMet = Boolean(competition?.locked);
  return [
    {
      id: "competition",
      label: "Competition",
      state: dependencyState(competitionMet, competition != null && !competitionMet),
    },
  ];
}

export function buildFixtureDependencies(
  competition?: ModuleSnapshot,
  teams?: ModuleSnapshot,
): DependencyChip[] {
  return [
    {
      id: "competition",
      label: "Competition",
      state: dependencyState(Boolean(competition?.locked)),
    },
    {
      id: "teams",
      label: "Teams",
      state: dependencyState(
        (teams?.lockedCount ?? 0) > 0,
        (teams?.entityCount ?? 0) > 0 && (teams?.lockedCount ?? 0) === 0,
      ),
    },
  ];
}

export function buildSchedulingDependencies(fixtures?: ModuleSnapshot): DependencyChip[] {
  return [
    {
      id: "fixtures",
      label: "Fixtures",
      state: dependencyState(
        (fixtures?.lockedCount ?? 0) > 0,
        (fixtures?.entityCount ?? 0) > 0 && (fixtures?.lockedCount ?? 0) === 0,
      ),
    },
  ];
}

export function buildMatchDependencies(fixtures?: ModuleSnapshot): DependencyChip[] {
  return buildSchedulingDependencies(fixtures).map((chip) =>
    chip.id === "fixtures"
      ? chip
      : chip,
  );
}

export function buildRuntimeDependencies(
  matches?: ModuleSnapshot,
  scheduling?: ModuleSnapshot,
): DependencyChip[] {
  return [
    {
      id: "matches",
      label: "Matches",
      state: dependencyState(
        (matches?.lockedCount ?? 0) > 0,
        (matches?.entityCount ?? 0) > 0 && (matches?.lockedCount ?? 0) === 0,
      ),
    },
    {
      id: "scheduling",
      label: "Scheduling",
      state: dependencyState(
        (scheduling?.lockedCount ?? 0) > 0,
        (scheduling?.entityCount ?? 0) > 0 && (scheduling?.lockedCount ?? 0) === 0,
      ),
    },
  ];
}

export function collectAttentionFromSnapshots(
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const snapshot of Object.values(snapshots)) {
    if (!snapshot) continue;
    items.push(...snapshot.attentionItems);
  }
  return items;
}

export function collectModuleHealthFromSnapshots(
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>,
  order: { id: ModuleWorkspaceId; label: string }[],
) {
  return order.map((step) => ({
    id: step.id,
    label: step.label,
    health: snapshots[step.id]?.health ?? "warning",
  }));
}
