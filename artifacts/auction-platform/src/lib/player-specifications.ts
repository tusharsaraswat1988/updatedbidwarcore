export type PlayerSpecificationInput = { specGroupId: number; value: string };

export type SpecGroupRef = { id: number; displayOrder?: number };

const LEGACY_SPEC_KEYS = ["battingStyle", "bowlingStyle", "specialization"] as const;
type LegacySpecForm = Record<(typeof LEGACY_SPEC_KEYS)[number], string>;

export function buildSpecificationsPayload(
  groups: SpecGroupRef[],
  legacyForm: Partial<LegacySpecForm>,
  extraSelections: Record<number, string>,
): PlayerSpecificationInput[] {
  const sorted = [...groups].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const specs: PlayerSpecificationInput[] = [];
  for (let idx = 0; idx < sorted.length; idx++) {
    const group = sorted[idx]!;
    const legacyKey = LEGACY_SPEC_KEYS[idx];
    const selectedVal = extraSelections[group.id]?.trim();
    const legacyVal = legacyKey ? legacyForm[legacyKey]?.trim() : undefined;
    const value = selectedVal || legacyVal;
    if (value) specs.push({ specGroupId: group.id, value });
  }
  return specs;
}

export function buildSpecificationsFromSelections(
  groups: SpecGroupRef[],
  specSelections: Record<number, string>,
): PlayerSpecificationInput[] {
  const sorted = [...groups].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return sorted.flatMap((group) => {
    const value = specSelections[group.id]?.trim();
    return value ? [{ specGroupId: group.id, value }] : [];
  });
}

export function applySpecificationsToSelections(
  groups: (SpecGroupRef & { groupName?: string })[],
  specifications: (PlayerSpecificationInput & { groupName?: string })[] | undefined,
  legacy: Partial<LegacySpecForm>,
): { legacyForm: Partial<LegacySpecForm>; extraSelections: Record<number, string> } {
  const sorted = [...groups].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const extraSelections: Record<number, string> = {};
  const legacyForm: Partial<LegacySpecForm> = {};
  const legacyValues = [legacy.battingStyle, legacy.bowlingStyle, legacy.specialization];

  if (specifications?.length) {
    for (let idx = 0; idx < sorted.length; idx++) {
      const group = sorted[idx]!;
      const match = specifications.find(
        (s) =>
          s.specGroupId === group.id ||
          Boolean(group.groupName && s.groupName && group.groupName.trim().toLowerCase() === s.groupName.trim().toLowerCase()),
      );
      const val = match?.value?.trim() || legacyValues[idx]?.trim();
      if (!val) continue;
      const legacyKey = LEGACY_SPEC_KEYS[idx];
      if (legacyKey) legacyForm[legacyKey] = val;
      extraSelections[group.id] = val;
    }
    return { legacyForm, extraSelections };
  }

  sorted.forEach((group, idx) => {
    const val = legacyValues[idx]?.trim();
    if (!val) return;
    const legacyKey = LEGACY_SPEC_KEYS[idx];
    if (legacyKey) legacyForm[legacyKey] = val;
    extraSelections[group.id] = val;
  });
  return { legacyForm, extraSelections };
}
