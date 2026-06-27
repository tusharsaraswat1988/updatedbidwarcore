export type PlayerSpecificationDto = {
  specGroupId: number;
  groupName: string;
  value: string;
};

export type PlayerSpecSource = {
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  specifications?: PlayerSpecificationDto[] | null;
  role?: string | null;
};

export type PlayerSpecDisplay = {
  label: string;
  value: string;
  specGroupId?: number;
};

const LEGACY_SPEC_KEYS = ["battingStyle", "bowlingStyle", "specialization"] as const;

function resolveSpecsForConfiguredGroups(
  player: PlayerSpecSource,
  labels: string[],
): PlayerSpecDisplay[] {
  const legacyValues = LEGACY_SPEC_KEYS.map((key) => player[key]?.trim() ?? "");
  const normalizedByLabel = new Map(
    (player.specifications ?? []).map((s) => [
      s.groupName.toLowerCase().trim(),
      { value: s.value?.trim() ?? "", specGroupId: s.specGroupId },
    ]),
  );

  return labels.map((label, idx) => {
    const normalized = normalizedByLabel.get(label.toLowerCase().trim());
    const value = normalized?.value || legacyValues[idx] || "";
    return {
      label,
      value,
      specGroupId: normalized?.specGroupId,
    };
  });
}

export function resolvePlayerSpecifications(
  player: PlayerSpecSource,
  options?: { specGroupLabels?: string[] },
): PlayerSpecDisplay[] {
  const labels = options?.specGroupLabels ?? [];

  if (labels.length > 0) {
    return resolveSpecsForConfiguredGroups(player, labels);
  }

  if (player.specifications?.length) {
    return player.specifications
      .filter((s) => s.value?.trim())
      .map((s) => ({
        label: s.groupName,
        value: s.value.trim(),
        specGroupId: s.specGroupId,
      }));
  }

  return LEGACY_SPEC_KEYS.flatMap((key, idx) => {
    const value = player[key]?.trim();
    if (!value) return [];
    return [{ label: `Spec ${idx + 1}`, value }];
  });
}

export function collectSpecColumnLabels(
  players: PlayerSpecSource[],
  options?: { specGroupLabelsByRole?: Map<string, string[]> },
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const player of players) {
    const roleKey = player.role?.toLowerCase().trim();
    const roleLabels = roleKey ? options?.specGroupLabelsByRole?.get(roleKey) : undefined;
    for (const spec of resolvePlayerSpecifications(player, { specGroupLabels: roleLabels })) {
      if (!seen.has(spec.label)) {
        seen.add(spec.label);
        labels.push(spec.label);
      }
    }
  }

  return labels;
}
