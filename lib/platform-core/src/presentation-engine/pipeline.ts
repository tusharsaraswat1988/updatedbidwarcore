import { isSemver } from "../catalog/versioning/semver.ts";
import {
  definitionsForContext,
  getPresentationDefinition,
  getPresentationProfile,
  supportsToken,
} from "./catalog-access.ts";
import {
  computeGraphHash,
  computeResolutionId,
  computeSemanticHash,
  computeSnapshotHash,
  overrideDocKey,
} from "./hash.ts";
import type {
  CompilationMode,
  CompilationReport,
  EngineIssue,
  FeatureState,
  GraphReport,
  PresentationEngineInput,
  PresentationRegionGraph,
  PresentationResolveLayerId,
  ResolvedPresentationContract,
  ResolvedPresentationSnapshot,
  ResolvedStyle,
  ResolvedToken,
  SlotState,
  StageResult,
} from "./types.ts";
import {
  DETERMINISTIC_RESOLVED_AT,
  PRESENTATION_COMPILER_VERSION,
  PRESENTATION_CONTRACT_VERSION,
  PRESENTATION_SCHEMA_VERSION,
} from "./versions.ts";

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

function stage(
  id: StageResult["stage"],
  startedAt: number,
  errors: EngineIssue[],
  warnings: EngineIssue[],
): StageResult {
  return Object.freeze({
    stage: id,
    started: true,
    completed: true,
    success: errors.every((e) => e.severity !== "ERROR"),
    warnings: Object.freeze([...warnings]),
    errors: Object.freeze([...errors]),
    durationMs: Math.round(nowMs() - startedAt),
  });
}

function issue(
  kind: EngineIssue["kind"],
  severity: EngineIssue["severity"],
  code: string,
  message: string,
  origin?: string,
  path?: string,
): EngineIssue {
  return { kind, severity, code, message, origin, path };
}

function emptyGraph(): GraphReport {
  return {
    nodes: [],
    edges: [],
    topologicalOrder: [],
    graphHash: computeGraphHash([]),
    results: [],
  };
}

function topo(
  nodeIds: string[],
  edges: readonly { from: string; to: string }[],
): { order: string[]; hasCycle: boolean } {
  const nodes = [...new Set(nodeIds)].sort();
  const indegree = new Map(nodes.map((n) => [n, 0]));
  const adj = new Map(nodes.map((n) => [n, [] as string[]]));
  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    adj.get(e.to)!.push(e.from);
    indegree.set(e.from, (indegree.get(e.from) ?? 0) + 1);
  }
  for (const [, list] of adj) list.sort();
  const queue = nodes.filter((n) => (indegree.get(n) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
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
  return { order, hasCycle: order.length !== nodes.length };
}

function shouldCompile(mode: CompilationMode | undefined, resolutionMode: string, ok: boolean): boolean {
  if (!ok) return false;
  if (mode === "NONE") return false;
  if (mode === "REQUIRED") return true;
  // AUTO
  if (resolutionMode === "PREVIEW" || resolutionMode === "VALIDATE" || resolutionMode === "MIGRATION") {
    return false;
  }
  return true;
}

export type PipelineOutput = {
  ok: boolean;
  stages: StageResult[];
  issues: EngineIssue[];
  snapshot: ResolvedPresentationSnapshot | null;
  contract: ResolvedPresentationContract | null;
  compilation: CompilationReport | null;
  layoutGraph: GraphReport | null;
  styleGraph: GraphReport | null;
  compatible: boolean;
};

export function runPresentationPipeline(input: PresentationEngineInput): PipelineOutput {
  const stages: StageResult[] = [];
  const allIssues: EngineIssue[] = [];
  const ctx = input.context;
  const profileId = String(ctx.presentationProfile.id);
  const profileVersion = String(ctx.presentationProfile.version ?? "");

  // --- Input Validation ---
  let t0 = nowMs();
  const inputErrors: EngineIssue[] = [];
  const inputWarnings: EngineIssue[] = [];
  const snapshotRequired =
    ctx.resolutionMode === "PREPARE" || ctx.resolutionMode === "MATCH_START";
  if (snapshotRequired && !input.snapshot) {
    inputErrors.push(
      issue("invalid", "ERROR", "SNAPSHOT_REQUIRED", "Runtime Snapshot is required", "snapshot"),
    );
  }
  if (input.snapshot) {
    const ref = input.snapshot.references.presentationProfile;
    if (!ref) {
      inputErrors.push(
        issue("invalid", "ERROR", "SNAPSHOT_INCOMPLETE", "Missing presentationProfile ref", "snapshot"),
      );
    } else if (
      String(ref.id) !== profileId ||
      String(ref.version ?? "") !== profileVersion
    ) {
      inputErrors.push(
        issue(
          "invalid",
          "ERROR",
          "PROFILE_REF_MISMATCH",
          "Context presentationProfile does not match Snapshot",
          "context",
          "presentationProfile",
        ),
      );
    }
  }
  if (!profileVersion || profileVersion === "latest" || !isSemver(profileVersion)) {
    inputErrors.push(
      issue(
        "invalid",
        "ERROR",
        "INVALID_SEMVER",
        `Invalid presentation profile version: ${profileVersion}`,
        "context",
        "presentationProfile.version",
      ),
    );
  }
  for (const ref of [
    ctx.competitionOverrideRef,
    ctx.tournamentOverrideRef,
    ctx.matchOverrideRef,
  ]) {
    if (!ref) continue;
    const ver = String(ref.version ?? "");
    if (!ver || ver === "latest") {
      inputErrors.push(
        issue("invalid", "ERROR", "INVALID_OVERRIDE_REF", "Override ref must be frozen", "override"),
      );
      continue;
    }
    const key = overrideDocKey(String(ref.id), ver);
    if (!input.overrideDocuments?.[key]) {
      inputErrors.push(
        issue("invalid", "ERROR", "OVERRIDE_NOT_FOUND", `Missing override ${key}`, "override"),
      );
    }
  }
  stages.push(stage("input", t0, inputErrors, inputWarnings));
  allIssues.push(...inputErrors, ...inputWarnings);
  if (inputErrors.some((e) => e.severity === "ERROR")) {
    return fail(stages, allIssues, false);
  }

  // --- Compatibility ---
  t0 = nowMs();
  const compatErrors: EngineIssue[] = [];
  const compatWarnings: EngineIssue[] = [];
  const profile = getPresentationProfile(profileId, profileVersion);
  if (!profile) {
    compatErrors.push(
      issue(
        "invalid",
        "ERROR",
        "UNKNOWN_PROFILE",
        `Unknown presentation profile ${profileId}@${profileVersion}`,
        "catalog",
      ),
    );
  } else {
    if (profile.sportId !== ctx.sportId) {
      compatErrors.push(
        issue("unresolvable", "ERROR", "SPORT_INCOMPATIBLE", "Presentation profile sport mismatch", "compatibility"),
      );
    }
    if (!supportsToken(profile.supportedVariants, ctx.variantId)) {
      compatErrors.push(
        issue("unresolvable", "ERROR", "VARIANT_INCOMPATIBLE", "Variant unsupported", "compatibility"),
      );
    }
    if (!supportsToken(profile.supportedCompetitionTypes, ctx.competitionTypeId)) {
      compatErrors.push(
        issue("unresolvable", "ERROR", "COMPETITION_INCOMPATIBLE", "Competition unsupported", "compatibility"),
      );
    }
    if (ctx.matchTypeId && !supportsToken(profile.supportedMatchTypes, ctx.matchTypeId)) {
      compatErrors.push(
        issue("unresolvable", "ERROR", "MATCH_TYPE_INCOMPATIBLE", "Match type unsupported", "compatibility"),
      );
    }
    if (
      ctx.ruleProfile &&
      !supportsToken(profile.compatibleRuleProfileIds, String(ctx.ruleProfile.id))
    ) {
      compatErrors.push(
        issue(
          "unresolvable",
          "ERROR",
          "RULE_PRESENTATION_INCOMPATIBLE",
          "Presentation profile incompatible with Rule Profile",
          "compatibility",
        ),
      );
    }
    if (profile.status === "deprecated") {
      compatWarnings.push(
        issue("warning", "WARNING", "PROFILE_DEPRECATED", "Presentation profile deprecated", "profile"),
      );
    } else if (profile.status === "beta") {
      compatWarnings.push(
        issue("info", "INFO", "PROFILE_BETA", "Presentation profile is beta", "profile"),
      );
    }
  }
  stages.push(stage("compatibility", t0, compatErrors, compatWarnings));
  allIssues.push(...compatErrors, ...compatWarnings);
  const compatible = !compatErrors.some((e) => e.severity === "ERROR");
  if (!compatible || !profile) {
    return fail(stages, allIssues, false);
  }

  // --- Structural ---
  t0 = nowMs();
  const structuralErrors: EngineIssue[] = [];
  const structuralWarnings: EngineIssue[] = [];
  const defs = definitionsForContext(ctx.sportId);
  for (const def of defs) {
    for (const dep of def.dependencies ?? []) {
      if (!getPresentationDefinition(dep)) {
        structuralErrors.push(
          issue(
            "invalid",
            "ERROR",
            "DEPENDENCY_DANGLING",
            `Dangling dependency ${def.id} → ${dep}`,
            "dependency",
            def.id,
          ),
        );
      }
    }
  }
  for (const entry of profile.values) {
    if (!getPresentationDefinition(entry.definitionId, entry.definitionVersion)) {
      structuralErrors.push(
        issue(
          "invalid",
          "ERROR",
          "UNKNOWN_DEFINITION",
          `Unknown definition ${entry.definitionId}`,
          "profile",
          entry.definitionId,
        ),
      );
    }
  }
  for (const ref of [
    ctx.competitionOverrideRef,
    ctx.tournamentOverrideRef,
    ctx.matchOverrideRef,
  ]) {
    if (!ref) continue;
    const doc =
      input.overrideDocuments?.[overrideDocKey(String(ref.id), String(ref.version))];
    if (!doc) continue;
    for (const defId of Object.keys(doc.values)) {
      if (!getPresentationDefinition(defId)) {
        structuralErrors.push(
          issue(
            "invalid",
            "ERROR",
            "OVERRIDE_UNKNOWN_DEFINITION",
            `Override unknown definition ${defId}`,
            "override",
            defId,
          ),
        );
      }
    }
  }
  stages.push(stage("structural", t0, structuralErrors, structuralWarnings));
  allIssues.push(...structuralErrors, ...structuralWarnings);
  if (structuralErrors.some((e) => e.severity === "ERROR")) {
    return fail(stages, allIssues, compatible);
  }

  // --- Semantic Resolution ---
  t0 = nowMs();
  const semanticErrors: EngineIssue[] = [];
  const semanticWarnings: EngineIssue[] = [];

  const competitionValues = loadOverride(input, ctx.competitionOverrideRef);
  const tournamentValues = loadOverride(input, ctx.tournamentOverrideRef);
  const matchValues = loadOverride(input, ctx.matchOverrideRef);
  const profileMap = new Map(profile.values.map((v) => [v.definitionId, v] as const));

  type Working = {
    definitionId: string;
    definitionVersion: string;
    resolvedValue: import("../catalog/types.ts").ConcretePresentationValue;
    resolvedFromLayer: PresentationResolveLayerId;
  };
  const working: Working[] = [];
  const layersSeen = new Set<PresentationResolveLayerId>(["platform", "sport", "variant", "profile"]);

  for (const def of defs) {
    let concrete = def.defaultValue;
    let layer: PresentationResolveLayerId = "platform";
    let defVersion = def.version;
    const entry = profileMap.get(def.id);
    if (entry) {
      const pinned = getPresentationDefinition(entry.definitionId, entry.definitionVersion);
      if (pinned) {
        defVersion = pinned.version;
        if (entry.value === "inherit") {
          concrete = pinned.defaultValue;
          layer = "platform";
        } else {
          concrete = entry.value;
          layer = "profile";
        }
      }
    }
    if (competitionValues?.[def.id] !== undefined) {
      concrete = competitionValues[def.id]!;
      layer = "competition_override";
      layersSeen.add("competition_override");
    }
    if (tournamentValues?.[def.id] !== undefined) {
      concrete = tournamentValues[def.id]!;
      layer = "tournament_override";
      layersSeen.add("tournament_override");
    }
    if (matchValues?.[def.id] !== undefined) {
      concrete = matchValues[def.id]!;
      layer = "match_override";
      layersSeen.add("match_override");
    }
    working.push({
      definitionId: def.id,
      definitionVersion: defVersion,
      resolvedValue: concrete,
      resolvedFromLayer: layer,
    });
  }
  working.sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  const valueMap = new Map(working.map((w) => [w.definitionId, w.resolvedValue]));

  // Feature states + conflicts
  const featureDefs = defs.filter((d) => d.kind === "feature");
  const features: FeatureState[] = [];
  for (const f of featureDefs) {
    const enabled = valueMap.get(f.id) === true;
    for (const other of f.conflicts ?? []) {
      if (enabled && valueMap.get(other) === true) {
        semanticErrors.push(
          issue(
            "unresolvable",
            "ERROR",
            "CONFLICT_UNRESOLVED",
            `${f.id} conflicts with ${other}`,
            "conflictPolicy",
            f.id,
          ),
        );
      }
    }
    features.push({
      featureId: f.id,
      state: enabled ? "enabled" : "disabled",
      reasonCode: "PROFILE_VALUE",
      resolvedBy: "PresentationProfile",
    });
  }
  features.sort((a, b) => a.featureId.localeCompare(b.featureId));
  const featureEnabled = new Map(features.map((f) => [f.featureId, f.state === "enabled"]));

  // Layout graph from region dependencies
  const regionDefs = defs.filter((d) => d.kind === "region");
  const layoutEdges = regionDefs.flatMap((r) =>
    (r.dependencies ?? []).map((dep) => ({ from: r.id, to: dep, kind: "layout" })),
  );
  const layoutNodes = regionDefs.map((r) => r.id);
  for (const e of layoutEdges) {
    if (!getPresentationDefinition(e.to)) {
      semanticErrors.push(
        issue("invalid", "ERROR", "DEPENDENCY_DANGLING", `Layout edge dangling ${e.from}->${e.to}`, "dependency"),
      );
    }
  }
  const layoutTopo = topo(layoutNodes, layoutEdges);
  if (layoutTopo.hasCycle) {
    semanticErrors.push(
      issue("unresolvable", "ERROR", "DEPENDENCY_CYCLE", "Layout graph cycle", "dependency"),
    );
  }
  const layoutGraph: GraphReport = {
    nodes: layoutNodes.sort().map((id) => ({ id })),
    edges: [...layoutEdges]
      .map((e) => ({ from: e.from, to: e.to }))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    topologicalOrder: layoutTopo.order,
    graphHash: computeGraphHash(layoutEdges),
    results: layoutEdges.map((e) => ({
      from: e.from,
      to: e.to,
      status: layoutTopo.hasCycle ? ("cycle" as const) : ("satisfied" as const),
    })),
  };

  // Style graph: style → tokens
  const styleDefs = defs.filter((d) => d.kind === "style");
  const styleEdges = styleDefs.flatMap((s) =>
    (s.tokenIds ?? []).map((t) => ({ from: s.id, to: t })),
  );
  const styleNodeIds = [
    ...styleDefs.map((s) => s.id),
    ...styleEdges.map((e) => e.to),
  ];
  const styleTopo = topo(styleNodeIds, styleEdges);
  if (styleTopo.hasCycle) {
    semanticErrors.push(
      issue("unresolvable", "ERROR", "DEPENDENCY_CYCLE", "Style graph cycle", "dependency"),
    );
  }
  const styleGraph: GraphReport = {
    nodes: [...new Set(styleNodeIds)].sort().map((id) => ({ id })),
    edges: [...styleEdges].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    topologicalOrder: styleTopo.order,
    graphHash: computeGraphHash(styleEdges),
    results: styleEdges.map((e) => ({
      from: e.from,
      to: e.to,
      status: getPresentationDefinition(e.to) ? ("satisfied" as const) : ("dangling" as const),
    })),
  };

  // Slots
  const slotDefs = defs.filter((d) => d.kind === "slot");
  const slots: SlotState[] = slotDefs
    .map((s) => {
      const featureId = s.featureId ?? null;
      const occupied = featureId ? featureEnabled.get(featureId) === true : true;
      return {
        slotId: s.id,
        regionId: s.regionId ?? "presentation.region.unknown",
        occupied,
        featureId,
        reason: occupied ? "Feature Enabled" : "Feature Disabled",
      };
    })
    .sort((a, b) => a.slotId.localeCompare(b.slotId));

  const regionGraph: PresentationRegionGraph = {
    nodes: regionDefs
      .map((r) => ({
        regionId: r.id,
        styleId: r.styleId ?? null,
        slotIds: slots.filter((s) => s.regionId === r.id).map((s) => s.slotId),
      }))
      .sort((a, b) => a.regionId.localeCompare(b.regionId)),
    edges: layoutEdges
      .map((e) => ({ from: e.from, to: e.to, kind: e.kind }))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
  };

  const tokens: ResolvedToken[] = defs
    .filter((d) => d.kind === "token")
    .map((d) => ({
      tokenId: d.id,
      definitionVersion: d.version,
      value: valueMap.get(d.id) ?? d.defaultValue,
    }))
    .sort((a, b) => a.tokenId.localeCompare(b.tokenId));

  const styles: ResolvedStyle[] = styleDefs
    .map((s) => ({
      styleId: s.id,
      definitionVersion: s.version,
      tokenBindings: (s.tokenIds ?? [])
        .slice()
        .sort()
        .map((tokenId) => ({ tokenId })),
    }))
    .sort((a, b) => a.styleId.localeCompare(b.styleId));

  const layersApplied: PresentationResolveLayerId[] = [
    "platform",
    "sport",
    "variant",
    "profile",
    ...(layersSeen.has("competition_override") ? (["competition_override"] as const) : []),
    ...(layersSeen.has("tournament_override") ? (["tournament_override"] as const) : []),
    ...(layersSeen.has("match_override") ? (["match_override"] as const) : []),
  ];

  const snapshotHash = computeSnapshotHash({
    profileId: profile.id,
    profileVersion: profile.version,
    values: working,
  });

  const snapshot: ResolvedPresentationSnapshot = {
    sportId: ctx.sportId,
    variantId: ctx.variantId,
    competitionTypeId: ctx.competitionTypeId,
    matchTypeId: ctx.matchTypeId,
    profileFamilyId: profile.familyId,
    profileId: profile.id,
    profileVersion: profile.version,
    values: working,
    provenance: {
      layersApplied,
      overridesApplied: {
        competition: !!competitionValues,
        tournament: !!tournamentValues,
        match: !!matchValues,
      },
    },
    snapshotHash,
    resolvedAt: DETERMINISTIC_RESOLVED_AT,
  };

  const semanticOk = !semanticErrors.some((e) => e.severity === "ERROR");
  stages.push(stage("resolution", t0, semanticErrors, semanticWarnings));
  allIssues.push(...semanticErrors, ...semanticWarnings);

  const okSoFar =
    stages.every((s) => s.success) && semanticOk;

  // --- Semantic Compilation ---
  let contract: ResolvedPresentationContract | null = null;
  let compilation: CompilationReport | null = null;
  const compile = shouldCompile(
    input.compilationMode ?? "AUTO",
    ctx.resolutionMode,
    okSoFar,
  );
  if (compile) {
    const c0 = nowMs();
    const semanticHash = computeSemanticHash({
      tokens,
      styles,
      features,
      slots,
      regionEdges: layoutEdges,
    });
    const resolutionId = computeResolutionId({ semanticHash, engineInput: input });
    contract = Object.freeze({
      schemaVersion: PRESENTATION_SCHEMA_VERSION,
      presentationContractVersion: PRESENTATION_CONTRACT_VERSION,
      semanticHash,
      resolutionId,
      sportId: ctx.sportId,
      variantId: ctx.variantId,
      competitionTypeId: ctx.competitionTypeId,
      matchTypeId: ctx.matchTypeId,
      tokens: Object.freeze(tokens),
      styles: Object.freeze(styles),
      features: Object.freeze(features),
      slots: Object.freeze(slots),
      regions: Object.freeze(regionGraph),
      layoutGraph: Object.freeze(layoutGraph),
      styleGraph: Object.freeze(styleGraph),
    });
    compilation = Object.freeze({
      compiled: true,
      compilerVersion: PRESENTATION_COMPILER_VERSION,
      contractVersion: PRESENTATION_CONTRACT_VERSION,
      semanticHash,
      durationMs: Math.round(nowMs() - c0),
      warnings: Object.freeze([] as EngineIssue[]),
    });
    stages.push(
      stage("semantic_compilation", c0, [], []),
    );
  } else {
    compilation = Object.freeze({
      compiled: false,
      compilerVersion: PRESENTATION_COMPILER_VERSION,
      contractVersion: PRESENTATION_CONTRACT_VERSION,
      semanticHash: null,
      warnings: Object.freeze([] as EngineIssue[]),
    });
  }

  return {
    ok: okSoFar,
    stages,
    issues: allIssues,
    snapshot,
    contract,
    compilation,
    layoutGraph,
    styleGraph,
    compatible,
  };
}

function loadOverride(
  input: PresentationEngineInput,
  ref: { id: string | number; version: string | number | null } | undefined,
) {
  if (!ref) return null;
  return (
    input.overrideDocuments?.[overrideDocKey(String(ref.id), String(ref.version))]?.values ??
    null
  );
}

function fail(
  stages: StageResult[],
  issues: EngineIssue[],
  compatible: boolean,
): PipelineOutput {
  return {
    ok: false,
    stages,
    issues,
    snapshot: null,
    contract: null,
    compilation: null,
    layoutGraph: emptyGraph(),
    styleGraph: emptyGraph(),
    compatible,
  };
}
