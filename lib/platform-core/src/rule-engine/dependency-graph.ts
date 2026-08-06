import type { ConcreteRuleValue } from "../catalog/types.ts";
import type { RuleDefinitionEntry } from "../catalog/types.ts";
import { getDefinition } from "./catalog-access.ts";
import type { DependencyReport, ValidationIssue } from "./types.ts";

function isDependencySatisfied(value: ConcreteRuleValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value === true;
  return true;
}

export type DependencyEval = {
  report: DependencyReport;
  structural: ValidationIssue[];
  unsatisfiedDependents: string[];
};

/**
 * Build DAG, reject cycles/dangling edges, topo-sort once.
 */
export function evaluateDependencyGraph(
  definitions: readonly RuleDefinitionEntry[],
  valueMap: ReadonlyMap<string, ConcreteRuleValue>,
): DependencyEval {
  const structural: ValidationIssue[] = [];
  const defIds = new Set(definitions.map((d) => d.id));
  const nodes = [...defIds].sort().map((definitionId) => ({ definitionId }));
  const edges: { from: string; to: string }[] = [];
  const results: DependencyReport["results"][number][] = [];

  for (const def of definitions) {
    for (const dep of def.dependencies ?? []) {
      edges.push({ from: def.id, to: dep });
      if (!getDefinition(dep) && !defIds.has(dep)) {
        structural.push({
          severity: "ERROR",
          code: "DEPENDENCY_DANGLING",
          message: `Dependency edge ${def.id} → ${dep} references unknown Rule Definition`,
          path: def.id,
          origin: "dependency",
        });
        results.push({
          definitionId: def.id,
          dependsOn: dep,
          status: "dangling",
        });
        continue;
      }
      if (!defIds.has(dep) && !getDefinition(dep)) {
        // already handled
      }
      const sat = isDependencySatisfied(valueMap.get(dep));
      results.push({
        definitionId: def.id,
        dependsOn: dep,
        status: sat ? "satisfied" : "unsatisfied",
      });
    }
  }

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  results.sort(
    (a, b) =>
      a.definitionId.localeCompare(b.definitionId) ||
      a.dependsOn.localeCompare(b.dependsOn),
  );

  const { topologicalOrder, hasCycle } = topoSort(
    [...defIds],
    edges.filter((e) => defIds.has(e.to) || getDefinition(e.to)),
  );

  if (hasCycle) {
    structural.push({
      severity: "ERROR",
      code: "DEPENDENCY_CYCLE",
      message: "Rule dependency graph contains a cycle",
      origin: "dependency",
    });
    for (const r of results) {
      if (r.status === "satisfied" || r.status === "unsatisfied") {
        // mark cycle participants conservatively in report via extra rows
      }
    }
  }

  const unsatisfiedDependents = [
    ...new Set(
      results
        .filter((r) => r.status === "unsatisfied")
        .map((r) => r.definitionId),
    ),
  ].sort();

  return {
    structural,
    unsatisfiedDependents,
    report: {
      nodes,
      edges,
      results: hasCycle
        ? results.map((r) =>
            r.status === "dangling" ? r : { ...r, status: "cycle" as const },
          )
        : results,
      topologicalOrder,
    },
  };
}

function topoSort(
  nodeIds: string[],
  edges: readonly { from: string; to: string }[],
): { topologicalOrder: string[]; hasCycle: boolean } {
  const nodes = [...new Set(nodeIds)].sort();
  const indegree = new Map(nodes.map((n) => [n, 0]));
  const adj = new Map(nodes.map((n) => [n, [] as string[]]));

  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    // edge from → to means from depends on to; to must come first
    adj.get(e.to)!.push(e.from);
    indegree.set(e.from, (indegree.get(e.from) ?? 0) + 1);
  }
  for (const [, list] of adj) list.sort();

  const queue = nodes.filter((n) => (indegree.get(n) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const next of adj.get(n) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  return {
    topologicalOrder: order,
    hasCycle: order.length !== nodes.length,
  };
}
