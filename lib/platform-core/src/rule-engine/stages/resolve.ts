import { computeSnapshotHash } from "../../catalog/resolve/hash.ts";
import { validateConcreteValue } from "../../catalog/resolve/validate-value.ts";
import type { ConcreteRuleValue, ResolveLayerId } from "../../catalog/resolve/types.ts";
import {
  SUPPORTED_BINDING_TYPES,
  categoryExists,
  definitionsForSport,
  getDefinition,
  getProfile,
  supportsToken,
} from "../catalog-access.ts";
import { listConflictPolicies, normalizePair } from "../conflict-policies/index.ts";
import { evaluateDependencyGraph } from "../dependency-graph.ts";
import { emptyConflictReport, emptyDependencyReport } from "../diagnostics.ts";
import { overrideDocKey } from "../hash.ts";
import type {
  ConflictOutcome,
  ConflictPolicy,
  ConflictReport,
  ForcedValueEntry,
  ResolutionStageResult,
  RuleEngineInput,
  ValidationIssue,
  VerificationStageResult,
} from "../types.ts";
import { DETERMINISTIC_RESOLVED_AT } from "../versions.ts";

function refVersion(version: string | number | null): string {
  return String(version);
}

function loadOverrideValues(
  input: RuleEngineInput,
  ref: { id: string | number; version: string | number | null } | undefined,
): Readonly<Record<string, ConcreteRuleValue>> | null {
  if (!ref) return null;
  const key = overrideDocKey(String(ref.id), refVersion(ref.version));
  return input.overrideDocuments?.[key]?.values ?? null;
}

/**
 * Resolution Stage — merge, DAG, conflicts, semantic validation.
 * Must not run merge when Verification failed (structural ERROR).
 */
export function resolveStage(
  input: RuleEngineInput,
  verification: VerificationStageResult,
): ResolutionStageResult {
  const emptyCompat = {
    sportId: input.context.sportId,
    variantId: input.context.variantId,
    competitionTypeId: input.context.competitionTypeId,
    profileId: verification.profileId,
    profileVersion: verification.profileVersion,
    issues: [] as ValidationIssue[],
    compatible: false,
  };

  if (!verification.ok) {
    return {
      ok: false,
      snapshot: null,
      semantic: [],
      structuralPassthrough: verification.structural,
      dependency: emptyDependencyReport(),
      conflict: emptyConflictReport(),
      compatibility: emptyCompat,
      layersApplied: [],
      overridesApplied: { competition: false, tournament: false, match: false },
      disabledByDependencies: [],
      disabledByConflicts: [],
      forcedValues: [],
      enabledDefinitions: [],
      disabledDefinitions: [],
    };
  }

  const ctx = input.context;
  const semantic: ValidationIssue[] = [];
  const compatibilityIssues: ValidationIssue[] = [];
  const profile = getProfile(verification.profileId, verification.profileVersion)!;

  if (profile.familyId !== verification.profileFamilyId && verification.profileFamilyId !== profile.id) {
    semantic.push({
      severity: "ERROR",
      code: "FAMILY_MISMATCH",
      message: `Profile family mismatch: expected ${verification.profileFamilyId}, got ${profile.familyId}`,
      path: "profileFamilyId",
      origin: "profile",
    });
  }

  if (profile.sportId !== ctx.sportId) {
    const issue: ValidationIssue = {
      severity: "ERROR",
      code: "SPORT_INCOMPATIBLE",
      message: "Rule profile does not support selected sport",
      origin: "profile",
    };
    semantic.push(issue);
    compatibilityIssues.push(issue);
  }
  if (!supportsToken(profile.supportedVariants, ctx.variantId)) {
    const issue: ValidationIssue = {
      severity: "ERROR",
      code: "VARIANT_INCOMPATIBLE",
      message: "Rule profile does not support selected variant",
      origin: "profile",
    };
    semantic.push(issue);
    compatibilityIssues.push(issue);
  }
  if (!supportsToken(profile.supportedCompetitionTypes, ctx.competitionTypeId)) {
    const issue: ValidationIssue = {
      severity: "ERROR",
      code: "COMPETITION_INCOMPATIBLE",
      message: "Rule profile does not support selected competition",
      origin: "profile",
    };
    semantic.push(issue);
    compatibilityIssues.push(issue);
  }

  if (profile.status === "deprecated") {
    semantic.push({
      severity: "WARNING",
      code: "PROFILE_DEPRECATED",
      message: `Rule profile is deprecated: ${profile.id}`,
      origin: "profile",
    });
  } else if (profile.status === "beta") {
    semantic.push({
      severity: "INFO",
      code: "PROFILE_BETA",
      message: `Rule profile is beta: ${profile.id}`,
      origin: "profile",
    });
  } else if (profile.status === "legacy") {
    semantic.push({
      severity: "INFO",
      code: "PROFILE_LEGACY",
      message: `Rule profile is legacy: ${profile.id}`,
      origin: "profile",
    });
  }

  const allowedBindings = SUPPORTED_BINDING_TYPES[ctx.sportId] ?? [];
  if (!allowedBindings.includes(profile.runtimeBinding.runtimeBindingType)) {
    semantic.push({
      severity: "ERROR",
      code: "BINDING_UNSUPPORTED",
      message: `Unsupported runtimeBindingType ${profile.runtimeBinding.runtimeBindingType} for sport ${ctx.sportId}`,
      path: "runtimeBinding",
      origin: "profile",
    });
  }

  const competitionValues = loadOverrideValues(input, ctx.competitionOverrideRef);
  const tournamentValues = loadOverrideValues(input, ctx.tournamentOverrideRef);
  const matchValues = loadOverrideValues(input, ctx.matchOverrideRef);

  const sportDefs = definitionsForSport(ctx.sportId);
  const profileValueByDef = new Map(profile.values.map((v) => [v.definitionId, v] as const));

  type Working = {
    definitionId: string;
    definitionVersion: string;
    resolvedValue: ConcreteRuleValue;
    resolvedFromLayer: ResolveLayerId;
    resolvedFromProfile: {
      familyId: string;
      profileId: string;
      profileVersion: string;
    } | null;
  };

  const working: Working[] = [];
  const layersSeen = new Set<ResolveLayerId>();

  for (const definition of sportDefs) {
    if (!categoryExists(definition.categoryId)) {
      semantic.push({
        severity: "ERROR",
        code: "UNKNOWN_CATEGORY",
        message: `Unknown category ${definition.categoryId} on definition ${definition.id}`,
        path: definition.id,
        origin: "definition",
      });
      continue;
    }

    // Platform default
    let concrete: ConcreteRuleValue = definition.defaultValue;
    let layer: ResolveLayerId = "platform";
    let fromProfile: Working["resolvedFromProfile"] = null;
    let defVersion = definition.version;
    layersSeen.add("platform");

    // Sport / variant packs — absent ⇒ no-op (foundation)

    const entry = profileValueByDef.get(definition.id);
    if (entry) {
      const def = getDefinition(entry.definitionId, entry.definitionVersion);
      if (!def) {
        semantic.push({
          severity: "ERROR",
          code: "UNKNOWN_DEFINITION",
          message: `Unknown rule definition ${entry.definitionId}@${entry.definitionVersion}`,
          path: entry.definitionId,
          origin: "profile",
        });
      } else {
        defVersion = def.version;
        if (entry.value === "inherit") {
          concrete = def.defaultValue;
          layer = "platform";
          fromProfile = null;
        } else {
          concrete = entry.value;
          layer = "profile";
          fromProfile = {
            familyId: profile.familyId,
            profileId: profile.id,
            profileVersion: profile.version,
          };
          layersSeen.add("profile");
          semantic.push(
            ...validateConcreteValue(def, concrete).map((i) => ({
              ...i,
              origin: "definition" as const,
            })),
          );
        }
      }
    }

    if (competitionValues?.[definition.id] !== undefined) {
      concrete = competitionValues[definition.id]!;
      layer = "competition_override";
      fromProfile = null;
      layersSeen.add("competition_override");
      semantic.push(
        ...validateConcreteValue(definition, concrete).map((i) => ({
          ...i,
          origin: "override" as const,
        })),
      );
    }
    if (tournamentValues?.[definition.id] !== undefined) {
      concrete = tournamentValues[definition.id]!;
      layer = "tournament_override";
      fromProfile = null;
      layersSeen.add("tournament_override");
      semantic.push(
        ...validateConcreteValue(definition, concrete).map((i) => ({
          ...i,
          origin: "override" as const,
        })),
      );
    }
    if (matchValues?.[definition.id] !== undefined) {
      concrete = matchValues[definition.id]!;
      layer = "match_override";
      fromProfile = null;
      layersSeen.add("match_override");
      semantic.push(
        ...validateConcreteValue(definition, concrete).map((i) => ({
          ...i,
          origin: "override" as const,
        })),
      );
    }

    working.push({
      definitionId: definition.id,
      definitionVersion: defVersion,
      resolvedValue: concrete,
      resolvedFromLayer: layer,
      resolvedFromProfile: fromProfile,
    });
  }

  for (const entry of profile.values) {
    if (!sportDefs.some((d) => d.id === entry.definitionId)) {
      semantic.push({
        severity: "ERROR",
        code: "UNKNOWN_DEFINITION",
        message: `Profile references unknown definition ${entry.definitionId}`,
        path: entry.definitionId,
        origin: "profile",
      });
    }
  }

  working.sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  let valueMap = new Map(working.map((r) => [r.definitionId, r.resolvedValue]));

  const depEval = evaluateDependencyGraph(sportDefs, valueMap);
  // Dangling/cycle already structural in verify; re-check cycle after merge set
  if (depEval.structural.some((i) => i.code === "DEPENDENCY_CYCLE")) {
    semantic.push(...depEval.structural.filter((i) => i.code === "DEPENDENCY_CYCLE"));
  }

  const disabledByDependencies: string[] = [];
  for (const r of depEval.report.results) {
    if (r.status === "unsatisfied") {
      const dependentVal = valueMap.get(r.definitionId);
      if (dependentVal === true) {
        semantic.push({
          severity: "ERROR",
          code: "DEPENDENCY_UNSATISFIED",
          message: `${r.definitionId} requires ${r.dependsOn}`,
          path: r.definitionId,
          origin: "dependency",
        });
      }
    }
  }

  // Conflict policies: registry + synthesized FAIL from definition.conflicts
  const synthesized: ConflictPolicy[] = [];
  for (const def of sportDefs) {
    for (const other of def.conflicts ?? []) {
      const pair = normalizePair(def.id, other);
      synthesized.push({
        conflictPolicyId: `synth.fail.${pair[0]}.${pair[1]}`,
        version: "1.0.0",
        priority: 0,
        strategy: "FAIL",
        pair,
      });
    }
  }

  const allPolicies = [...listConflictPolicies(), ...synthesized].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const id = a.conflictPolicyId.localeCompare(b.conflictPolicyId);
    if (id !== 0) return id;
    return a.version.localeCompare(b.version);
  });

  // Deduplicate synth by pair keeping highest priority
  const policyByPair = new Map<string, ConflictPolicy>();
  for (const p of allPolicies) {
    const key = `${p.pair[0]}|${p.pair[1]}`;
    const existing = policyByPair.get(key);
    if (!existing) {
      policyByPair.set(key, p);
      continue;
    }
    if (p.priority > existing.priority) {
      policyByPair.set(key, p);
    } else if (p.priority === existing.priority) {
      // collision among synth+registry at same priority — structural already for registry;
      // for synth duplicates ignore
      if (p.conflictPolicyId !== existing.conflictPolicyId && !p.conflictPolicyId.startsWith("synth.")) {
        semantic.push({
          severity: "ERROR",
          code: "CONFLICT_POLICY_COLLISION",
          message: `Conflict policies ${existing.conflictPolicyId} and ${p.conflictPolicyId} collide`,
          path: p.conflictPolicyId,
          origin: "conflictPolicy",
        });
      }
    }
  }

  const outcomes: ConflictOutcome[] = [];
  const policiesApplied: ConflictReport["policiesApplied"] = [];
  const disabledByConflicts: string[] = [];
  const forcedValues: ForcedValueEntry[] = [];

  for (const p of [...policyByPair.values()].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.conflictPolicyId.localeCompare(b.conflictPolicyId);
  })) {
    const [left, right] = p.pair;
    const leftOn = valueMap.get(left) === true;
    const rightOn = valueMap.get(right) === true;
    if (!leftOn || !rightOn) continue;

    policiesApplied.push({
      conflictPolicyId: p.conflictPolicyId,
      version: p.version,
      priority: p.priority,
      strategy: p.strategy,
    });

    const effects: ConflictOutcome["effects"] = [];
    if (p.strategy === "FAIL") {
      semantic.push({
        severity: "ERROR",
        code: "CONFLICT_UNRESOLVED",
        message: `${left} conflicts with ${right}`,
        path: left,
        origin: "conflictPolicy",
      });
      effects.push({ definitionId: left, effect: "error" });
      effects.push({ definitionId: right, effect: "error" });
    } else if (p.strategy === "DISABLE_LEFT" || p.strategy === "DISABLE_DEPENDENT") {
      valueMap.set(left, false);
      disabledByConflicts.push(left);
      effects.push({ definitionId: left, effect: "disable" });
      semantic.push({
        severity: "INFO",
        code: "CONFLICT_RESOLVED",
        message: `Disabled ${left} due to conflict with ${right}`,
        path: left,
        origin: "conflictPolicy",
      });
    } else if (p.strategy === "DISABLE_RIGHT") {
      valueMap.set(right, false);
      disabledByConflicts.push(right);
      effects.push({ definitionId: right, effect: "disable" });
      semantic.push({
        severity: "INFO",
        code: "CONFLICT_RESOLVED",
        message: `Disabled ${right} due to conflict with ${left}`,
        path: right,
        origin: "conflictPolicy",
      });
    } else if (p.strategy === "FORCE_VALUE" && p.forceDefinitionId && p.forceValue !== undefined) {
      valueMap.set(p.forceDefinitionId, p.forceValue);
      forcedValues.push({ definitionId: p.forceDefinitionId, value: p.forceValue });
      effects.push({
        definitionId: p.forceDefinitionId,
        effect: "force_value",
        value: p.forceValue,
      });
    }

    outcomes.push({
      conflictId: `c-${p.conflictPolicyId}`,
      conflictPolicyId: p.conflictPolicyId,
      version: p.version,
      strategy: p.strategy,
      participants: [left, right],
      effects: [...effects].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    });
  }

  // Apply valueMap back onto working entries
  for (const w of working) {
    if (valueMap.has(w.definitionId)) {
      w.resolvedValue = valueMap.get(w.definitionId)!;
    }
  }

  const resolved = working.map((w) => ({
    definitionId: w.definitionId,
    definitionVersion: w.definitionVersion,
    resolvedValue: w.resolvedValue,
    resolvedFromLayer: w.resolvedFromLayer,
    resolvedFromProfile: w.resolvedFromProfile,
  }));

  // Keep EPIC-02-compatible layer listing for profile path
  const uniqueLayers = [
    "platform",
    "sport",
    "variant",
    "profile",
    ...(layersSeen.has("competition_override") ? (["competition_override"] as const) : []),
    ...(layersSeen.has("tournament_override") ? (["tournament_override"] as const) : []),
    ...(layersSeen.has("match_override") ? (["match_override"] as const) : []),
  ] as ResolveLayerId[];

  const overridesApplied = {
    competition: !!competitionValues,
    tournament: !!tournamentValues,
    match: !!matchValues,
  };

  const snapshotHash = computeSnapshotHash({
    profileId: profile.id,
    profileVersion: profile.version,
    runtimeBindingType: profile.runtimeBinding.runtimeBindingType,
    runtimeBindingId: profile.runtimeBinding.runtimeBindingId,
    values: resolved,
  });

  const snapshot = {
    sportId: ctx.sportId,
    variantId: ctx.variantId,
    competitionTypeId: ctx.competitionTypeId,
    profileFamilyId: profile.familyId,
    profileId: profile.id,
    profileVersion: profile.version,
    values: resolved,
    runtimeBinding: profile.runtimeBinding,
    provenance: {
      layersApplied: uniqueLayers,
      overridesApplied,
    },
    snapshotHash,
    resolvedAt: DETERMINISTIC_RESOLVED_AT,
  };

  const disabledSet = new Set(
    [...disabledByDependencies, ...disabledByConflicts].sort(),
  );
  const enabledDefinitions = resolved
    .map((r) => r.definitionId)
    .filter((id) => !disabledSet.has(id))
    .sort();
  const disabledDefinitions = [...disabledSet].sort();

  const ok = [...verification.structural, ...semantic].every((i) => i.severity !== "ERROR");

  return {
    ok,
    snapshot,
    semantic: [...semantic].sort(
      (a, b) => a.code.localeCompare(b.code) || (a.path ?? "").localeCompare(b.path ?? ""),
    ),
    structuralPassthrough: verification.structural,
    dependency: depEval.report,
    conflict: {
      policiesApplied: [...policiesApplied].sort(
        (a, b) =>
          b.priority - a.priority ||
          a.conflictPolicyId.localeCompare(b.conflictPolicyId) ||
          a.version.localeCompare(b.version),
      ),
      outcomes: [...outcomes].sort((a, b) => a.conflictId.localeCompare(b.conflictId)),
    },
    compatibility: {
      sportId: ctx.sportId,
      variantId: ctx.variantId,
      competitionTypeId: ctx.competitionTypeId,
      profileId: profile.id,
      profileVersion: profile.version,
      issues: compatibilityIssues,
      compatible: compatibilityIssues.every((i) => i.severity !== "ERROR"),
    },
    layersApplied: uniqueLayers,
    overridesApplied,
    disabledByDependencies: [...disabledByDependencies].sort(),
    disabledByConflicts: [...new Set(disabledByConflicts)].sort(),
    forcedValues: [...forcedValues].sort((a, b) =>
      a.definitionId.localeCompare(b.definitionId),
    ),
    enabledDefinitions,
    disabledDefinitions,
  };
}
