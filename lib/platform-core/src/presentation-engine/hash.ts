import type { ConcretePresentationValue } from "../catalog/types.ts";
import type {
  FeatureState,
  PresentationEngineInput,
  ResolvedPresentationContract,
  ResolvedStyle,
  ResolvedToken,
  SlotState,
} from "./types.ts";
import { PRESENTATION_CONTRACT_VERSION } from "./versions.ts";

function canonicalize(value: ConcretePresentationValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v as ConcretePresentationValue)).join(",")}]`;
  }
  const obj = value as { readonly [key: string]: ConcretePresentationValue };
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k]!)}`)
    .join(",")}}`;
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function overrideDocKey(id: string, version: string | number | null): string {
  return `${id}@${version ?? "null"}`;
}

export function computeGraphHash(
  edges: readonly { from: string; to: string }[],
): string {
  const payload = [...edges]
    .map((e) => `${e.from}->${e.to}`)
    .sort()
    .join("|");
  return `graph-fnv1a32:${fnv1a(payload)}`;
}

export function computeSemanticHash(input: {
  tokens: readonly ResolvedToken[];
  styles: readonly ResolvedStyle[];
  features: readonly FeatureState[];
  slots: readonly SlotState[];
  regionEdges: readonly { from: string; to: string }[];
}): string {
  const payload = [
    `contract=${PRESENTATION_CONTRACT_VERSION}`,
    ...[...input.tokens]
      .sort((a, b) => a.tokenId.localeCompare(b.tokenId))
      .map((t) => `t:${t.tokenId}@${t.definitionVersion}=${canonicalize(t.value)}`),
    ...[...input.styles]
      .sort((a, b) => a.styleId.localeCompare(b.styleId))
      .map(
        (s) =>
          `s:${s.styleId}=${s.tokenBindings
            .map((b) => b.tokenId)
            .sort()
            .join(",")}`,
      ),
    ...[...input.features]
      .sort((a, b) => a.featureId.localeCompare(b.featureId))
      .map((f) => `f:${f.featureId}=${f.state}`),
    ...[...input.slots]
      .sort((a, b) => a.slotId.localeCompare(b.slotId))
      .map((s) => `slot:${s.slotId}=${s.occupied ? 1 : 0}`),
    ...[...input.regionEdges]
      .map((e) => `${e.from}->${e.to}`)
      .sort(),
  ].join("|");
  return `semantic-fnv1a32:${fnv1a(payload)}`;
}

export function computeResolutionId(input: {
  semanticHash: string;
  engineInput: PresentationEngineInput;
}): string {
  const ctx = input.engineInput.context;
  const snap = input.engineInput.snapshot;
  const scope = snap
    ? `match=${snap.matchId};sv=${snap.snapshotVersion}`
    : `preview=${ctx.sportId}/${ctx.variantId}/${ctx.competitionTypeId}`;
  return `prid-fnv1a32:${fnv1a(
    [
      scope,
      `profile=${ctx.presentationProfile.id}@${ctx.presentationProfile.version}`,
      `mode=${ctx.resolutionMode}`,
      `input=${input.engineInput.inputVersion}`,
      `hash=${input.semanticHash}`,
    ].join("|"),
  )}`;
}

export function computeAdaptationHash(
  contract: ResolvedPresentationContract,
  disabledByCapability: readonly string[],
  capabilityProfileId: string,
  capabilityVersion: string,
): string {
  return `adapt-fnv1a32:${fnv1a(
    [
      contract.semanticHash,
      `cap=${capabilityProfileId}@${capabilityVersion}`,
      `disabled=${[...disabledByCapability].sort().join(",")}`,
    ].join("|"),
  )}`;
}

export function computeSnapshotHash(input: {
  profileId: string;
  profileVersion: string;
  values: readonly { definitionId: string; definitionVersion: string; resolvedValue: ConcretePresentationValue }[];
}): string {
  const sorted = [...input.values].sort((a, b) =>
    a.definitionId.localeCompare(b.definitionId),
  );
  return `psnap-fnv1a32:${fnv1a(
    [
      `profile=${input.profileId}@${input.profileVersion}`,
      ...sorted.map(
        (v) =>
          `${v.definitionId}@${v.definitionVersion}=${canonicalize(v.resolvedValue)}`,
      ),
    ].join("|"),
  )}`;
}
