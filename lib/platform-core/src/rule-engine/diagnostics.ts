import type {
  CompatibilityReport,
  ConflictReport,
  DependencyReport,
  ResolutionReport,
  RuleEngineDiagnostics,
  ValidationIssue,
  ValidationReport,
} from "./types.ts";

function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    const c = a.code.localeCompare(b.code);
    if (c !== 0) return c;
    return (a.path ?? "").localeCompare(b.path ?? "");
  });
}

export function buildValidationReport(
  structural: readonly ValidationIssue[],
  semantic: readonly ValidationIssue[],
): ValidationReport {
  const all = [...structural, ...semantic];
  return {
    structural: sortIssues(structural),
    semantic: sortIssues(semantic),
    errorCount: all.filter((i) => i.severity === "ERROR").length,
    warningCount: all.filter((i) => i.severity === "WARNING").length,
    infoCount: all.filter((i) => i.severity === "INFO").length,
  };
}

export function emptyDependencyReport(): DependencyReport {
  return { nodes: [], edges: [], results: [], topologicalOrder: [] };
}

export function emptyConflictReport(): ConflictReport {
  return { policiesApplied: [], outcomes: [] };
}

export function buildDiagnostics(input: {
  resolution: ResolutionReport;
  structural: readonly ValidationIssue[];
  semantic: readonly ValidationIssue[];
  dependency: DependencyReport;
  conflict: ConflictReport;
  compatibility: CompatibilityReport;
}): RuleEngineDiagnostics {
  return Object.freeze({
    resolution: Object.freeze({ ...input.resolution }),
    validation: Object.freeze(buildValidationReport(input.structural, input.semantic)),
    dependency: Object.freeze({
      nodes: [...input.dependency.nodes],
      edges: [...input.dependency.edges],
      results: [...input.dependency.results],
      topologicalOrder: [...input.dependency.topologicalOrder],
    }),
    conflict: Object.freeze({
      policiesApplied: [...input.conflict.policiesApplied],
      outcomes: [...input.conflict.outcomes],
    }),
    compatibility: Object.freeze({
      ...input.compatibility,
      issues: sortIssues(input.compatibility.issues),
    }),
  });
}
