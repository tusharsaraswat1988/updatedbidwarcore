import { isSemver } from "../../catalog/versioning/semver.ts";
import {
  getDefinition,
  getProfile,
  definitionsForSport,
} from "../catalog-access.ts";
import { listConflictPolicies, normalizePair } from "../conflict-policies/index.ts";
import { overrideDocKey } from "../hash.ts";
import type {
  RuleEngineInput,
  ValidationIssue,
  VerificationStageResult,
} from "../types.ts";

function refVersion(version: string | number | null): string | null {
  if (version === null || version === undefined) return null;
  return String(version);
}

/**
 * Verification Stage — structural validation only.
 * Snapshot verification completes before catalog asset loading for merge.
 */
export function verifyStage(input: RuleEngineInput): VerificationStageResult {
  const structural: ValidationIssue[] = [];
  const ctx = input.context;
  const mode = ctx.resolutionMode;
  const profileId = String(ctx.ruleProfile.id);
  const profileVersion = refVersion(ctx.ruleProfile.version);
  const profileFamilyId = ctx.profileFamilyId ?? profileId;

  const snapshotRequired = mode === "PREPARE" || mode === "MATCH_START";
  if (snapshotRequired && !input.snapshot) {
    structural.push({
      severity: "ERROR",
      code: "SNAPSHOT_REQUIRED",
      message: `Runtime Snapshot is required for resolutionMode ${mode}`,
      path: "snapshot",
      origin: "snapshot",
    });
  }

  if (input.snapshot) {
    const snapRef = input.snapshot.references.ruleProfile;
    if (!snapRef) {
      structural.push({
        severity: "ERROR",
        code: "SNAPSHOT_INCOMPLETE",
        message: "Runtime Snapshot is missing frozen ruleProfile reference",
        path: "snapshot.references.ruleProfile",
        origin: "snapshot",
      });
    } else {
      const snapId = String(snapRef.id);
      const snapVer = refVersion(snapRef.version);
      if (snapId !== profileId || snapVer !== profileVersion) {
        structural.push({
          severity: "ERROR",
          code: "PROFILE_REF_MISMATCH",
          message: "RuleResolutionContext.ruleProfile does not match Runtime Snapshot",
          path: "context.ruleProfile",
          origin: "context",
        });
      }
    }
  }

  if (!profileVersion || profileVersion === "latest") {
    structural.push({
      severity: "ERROR",
      code: "INVALID_SEMVER",
      message: `Profile version must be semver MAJOR.MINOR.PATCH, got: ${profileVersion}`,
      path: "ruleProfile.version",
      origin: "context",
    });
  } else if (!isSemver(profileVersion)) {
    structural.push({
      severity: "ERROR",
      code: "INVALID_SEMVER",
      message: `Profile version must be semver MAJOR.MINOR.PATCH, got: ${profileVersion}`,
      path: "ruleProfile.version",
      origin: "context",
    });
  }

  // Snapshot structural checks done — only then load catalog assets
  const shouldLoadCatalog = true;
  const profile =
    profileVersion && isSemver(profileVersion)
      ? getProfile(profileId, profileVersion)
      : null;

  if (!profile) {
    structural.push({
      severity: "ERROR",
      code: "UNKNOWN_PROFILE",
      message: `Unknown rule profile ${profileId}@${profileVersion}`,
      path: "ruleProfile",
      origin: "catalog",
    });
  }

  for (const ref of [
    ctx.competitionOverrideRef,
    ctx.tournamentOverrideRef,
    ctx.matchOverrideRef,
  ]) {
    if (!ref) continue;
    const ver = refVersion(ref.version);
    if (ver === null || ver === "latest") {
      structural.push({
        severity: "ERROR",
        code: "INVALID_OVERRIDE_REF",
        message: `Override ref must have a frozen version, got ${String(ref.id)}@${ver}`,
        path: String(ref.id),
        origin: "override",
      });
      continue;
    }
    const key = overrideDocKey(String(ref.id), ver);
    const doc = input.overrideDocuments?.[key];
    if (!doc) {
      structural.push({
        severity: "ERROR",
        code: "OVERRIDE_NOT_FOUND",
        message: `Override document not found for ${key}`,
        path: String(ref.id),
        origin: "override",
      });
      continue;
    }
    for (const defId of Object.keys(doc.values)) {
      if (!getDefinition(defId)) {
        structural.push({
          severity: "ERROR",
          code: "OVERRIDE_UNKNOWN_DEFINITION",
          message: `Override introduces unknown Rule Definition ${defId}`,
          path: defId,
          origin: "override",
        });
      }
    }
  }

  // Dependency dangling edges (definition graph structure)
  if (profile) {
    const sportDefs = definitionsForSport(ctx.sportId);
    for (const def of sportDefs) {
      for (const dep of def.dependencies ?? []) {
        if (!getDefinition(dep)) {
          structural.push({
            severity: "ERROR",
            code: "DEPENDENCY_DANGLING",
            message: `Dependency edge ${def.id} → ${dep} references unknown Rule Definition`,
            path: def.id,
            origin: "dependency",
          });
        }
      }
      for (const conflict of def.conflicts ?? []) {
        if (!getDefinition(conflict)) {
          structural.push({
            severity: "ERROR",
            code: "CONFLICT_POLICY_DANGLING",
            message: `Conflict participant ${conflict} on ${def.id} is unknown`,
            path: def.id,
            origin: "conflictPolicy",
          });
        }
      }
    }
  }

  // Conflict policy collisions (same normalized pair + same priority)
  const policies = listConflictPolicies();
  const seen = new Map<string, string>();
  for (const p of policies) {
    const [a, b] = normalizePair(p.pair[0], p.pair[1]);
    if (!getDefinition(a) || !getDefinition(b)) {
      structural.push({
        severity: "ERROR",
        code: "CONFLICT_POLICY_DANGLING",
        message: `ConflictPolicy ${p.conflictPolicyId} references unknown definition`,
        path: p.conflictPolicyId,
        origin: "conflictPolicy",
      });
    }
    const key = `${a}|${b}|${p.priority}`;
    const prev = seen.get(key);
    if (prev) {
      structural.push({
        severity: "ERROR",
        code: "CONFLICT_POLICY_COLLISION",
        message: `Conflict policies ${prev} and ${p.conflictPolicyId} collide at priority ${p.priority}`,
        path: p.conflictPolicyId,
        origin: "conflictPolicy",
      });
    } else {
      seen.set(key, p.conflictPolicyId);
    }
  }

  const ok = structural.every((i) => i.severity !== "ERROR");
  return {
    ok,
    structural: [...structural].sort(
      (a, b) => a.code.localeCompare(b.code) || (a.path ?? "").localeCompare(b.path ?? ""),
    ),
    profileFamilyId,
    profileId,
    profileVersion: profileVersion ?? "",
    shouldLoadCatalog,
  };
}
