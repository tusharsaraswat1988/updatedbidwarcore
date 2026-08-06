/**
 * Match Start verification for Presentation — NEVER calls PresentationEngine.resolve().
 * Verifies snapshotVersion / presentationResolutionId / presentationHash / presentationVersion
 * bound at Runtime Prepare.
 */

export type PresentationResolutionBind = {
  readonly presentationResolutionId: string;
  readonly presentationHash: string;
  readonly presentationVersion: string;
  readonly snapshotVersion: number;
};

export type PresentationMatchStartVerifyInput = {
  readonly currentRuntimeVersion: number | null | undefined;
  readonly runtimePrepMetadata: Record<string, unknown> | null | undefined;
};

export type PresentationMatchStartVerifyResult =
  | { ok: true; bind: PresentationResolutionBind }
  | { ok: false; code: string; error: string };

function asBind(raw: unknown): PresentationResolutionBind | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const presentationResolutionId =
    typeof o.presentationResolutionId === "string"
      ? o.presentationResolutionId
      : typeof o.resolutionId === "string"
        ? o.resolutionId
        : null;
  const presentationHash =
    typeof o.presentationHash === "string"
      ? o.presentationHash
      : typeof o.semanticHash === "string"
        ? o.semanticHash
        : null;
  const presentationVersion =
    typeof o.presentationVersion === "string"
      ? o.presentationVersion
      : typeof o.presentationContractVersion === "string"
        ? o.presentationContractVersion
        : null;
  const snapshotVersion =
    typeof o.snapshotVersion === "number" ? o.snapshotVersion : null;
  if (
    !presentationResolutionId ||
    !presentationHash ||
    !presentationVersion ||
    snapshotVersion == null
  ) {
    return null;
  }
  return {
    presentationResolutionId,
    presentationHash,
    presentationVersion,
    snapshotVersion,
  };
}

/** Read Prepare-bound presentation identity from runtime prep metadata. */
export function readPresentationResolutionBind(
  runtimePrepMetadata: Record<string, unknown> | null | undefined,
): PresentationResolutionBind | null {
  if (!runtimePrepMetadata) return null;
  return asBind(runtimePrepMetadata.presentationResolution);
}

/**
 * Fail-closed Match Start gate for presentation bind.
 * No successful Runtime Prepare presentation bind ⇒ No Match Start.
 */
export function verifyPresentationMatchStartContract(
  input: PresentationMatchStartVerifyInput,
): PresentationMatchStartVerifyResult {
  if (input.currentRuntimeVersion == null) {
    return {
      ok: false,
      code: "RUNTIME_PREPARE_REQUIRED",
      error:
        "Runtime Prepare is mandatory before Match Start. No snapshotVersion bound (presentation).",
    };
  }

  const bind = readPresentationResolutionBind(input.runtimePrepMetadata);
  if (!bind) {
    return {
      ok: false,
      code: "RUNTIME_PREPARE_REQUIRED",
      error:
        "Runtime Prepare is mandatory before Match Start. Missing presentationResolutionId / presentationHash bind.",
    };
  }

  if (bind.snapshotVersion !== input.currentRuntimeVersion) {
    return {
      ok: false,
      code: "SNAPSHOT_VERSION_MISMATCH",
      error: `Bound presentation snapshotVersion ${bind.snapshotVersion} does not match currentRuntimeVersion ${input.currentRuntimeVersion}.`,
    };
  }

  if (!bind.presentationResolutionId || !bind.presentationHash) {
    return {
      ok: false,
      code: "PRESENTATION_RESOLUTION_BIND_INCOMPLETE",
      error:
        "Match Start verification failed: presentationResolutionId or presentationHash missing.",
    };
  }

  return { ok: true, bind };
}

/** Build prep metadata fragment that stores presentation identity only (no contract bodies). */
export function buildPresentationResolutionPrepMetadata(
  bind: PresentationResolutionBind,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  // Never persist ResolvedPresentationContract / PresentationExecutionPolicy / paint bodies here.
  delete base.resolvedPresentationContract;
  delete base.presentationExecutionPolicy;
  delete base.presentationPaintJson;
  delete base.brandingJson;
  return {
    ...base,
    presentationResolution: {
      presentationResolutionId: bind.presentationResolutionId,
      presentationHash: bind.presentationHash,
      presentationVersion: bind.presentationVersion,
      snapshotVersion: bind.snapshotVersion,
    },
  };
}
