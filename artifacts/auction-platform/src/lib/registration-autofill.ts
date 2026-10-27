/**
 * Decides which registration fields a mobile lookup actually wrote.
 * Highlight only values that changed to a non-empty result. Email is never
 * part of lookup, so it is intentionally absent.
 */

export type AutofillProfile = {
  name?: string | null;
  city?: string | null;
  age?: number | null;
  gender?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  lowerSize?: string | null;
  achievements?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  categoryId?: number | null;
  teamId?: number | null;
};

export type AutofillFormFields = {
  name: string;
  city: string;
  age: string;
  gender: string;
  role: string;
  photoUrl: string;
  battingStyle: string;
  bowlingStyle: string;
  specialization: string;
  jerseyNumber: string;
  jerseySize: string;
  lowerSize: string;
  achievements: string;
  cricheroUrl: string;
  availabilityDates: string;
  categoryId: string;
  teamId: string;
};

const FIELD_IDS: Record<keyof AutofillFormFields, string> = {
  name: "name",
  city: "city",
  age: "age",
  gender: "gender",
  role: "role",
  photoUrl: "photo",
  battingStyle: "battingStyle",
  bowlingStyle: "bowlingStyle",
  specialization: "specialization",
  jerseyNumber: "jerseyNumber",
  jerseySize: "jerseySize",
  lowerSize: "lowerSize",
  achievements: "achievements",
  cricheroUrl: "crichero",
  availabilityDates: "availability",
  categoryId: "category",
  teamId: "team",
};

/** Tournament registration overwrites with the saved player, keeping previous values when the profile omits them. */
export function mergeTournamentProfile<T extends AutofillFormFields>(prev: T, tp: AutofillProfile): T {
  return {
    ...prev,
    name: tp.name || prev.name,
    city: tp.city ?? prev.city,
    age: tp.age != null ? String(tp.age) : prev.age,
    gender: tp.gender ?? prev.gender,
    role: tp.role ?? prev.role,
    photoUrl: tp.photoUrl ?? prev.photoUrl,
    battingStyle: tp.battingStyle ?? prev.battingStyle,
    bowlingStyle: tp.bowlingStyle ?? prev.bowlingStyle,
    specialization: tp.specialization ?? prev.specialization,
    jerseyNumber: tp.jerseyNumber ?? prev.jerseyNumber,
    jerseySize: (tp.jerseySize ?? prev.jerseySize) as T["jerseySize"],
    lowerSize: (tp.lowerSize ?? prev.lowerSize) as T["lowerSize"],
    achievements: tp.achievements ?? prev.achievements,
    cricheroUrl: tp.cricheroUrl ?? prev.cricheroUrl,
    availabilityDates: tp.availabilityDates ?? prev.availabilityDates,
    categoryId: tp.categoryId != null ? String(tp.categoryId) : prev.categoryId,
    teamId: tp.teamId != null ? String(tp.teamId) : prev.teamId,
  };
}

/** Global profile fills only fields the player has not already typed. */
export function mergeGlobalProfile<T extends AutofillFormFields>(prev: T, match: AutofillProfile): T {
  return {
    ...prev,
    name: prev.name || match.name || "",
    city: prev.city || (match.city ?? ""),
    age: prev.age || (match.age ? String(match.age) : ""),
    gender: prev.gender || (match.gender ?? ""),
    role: prev.role || (match.role ?? ""),
    photoUrl: prev.photoUrl || (match.photoUrl ?? ""),
    battingStyle: prev.battingStyle || (match.battingStyle ?? ""),
    bowlingStyle: prev.bowlingStyle || (match.bowlingStyle ?? ""),
    specialization: prev.specialization || (match.specialization ?? ""),
    jerseyNumber: prev.jerseyNumber || (match.jerseyNumber ?? ""),
    jerseySize: (prev.jerseySize || (match.jerseySize ?? "")) as T["jerseySize"],
    lowerSize: (prev.lowerSize || (match.lowerSize ?? "")) as T["lowerSize"],
    achievements: prev.achievements || (match.achievements ?? ""),
    cricheroUrl: prev.cricheroUrl || (match.cricheroUrl ?? ""),
    teamId: prev.teamId || (match.teamId != null ? String(match.teamId) : ""),
  };
}

export function changedAutofillFieldIds(before: AutofillFormFields, after: AutofillFormFields): string[] {
  const ids: string[] = [];
  (Object.keys(FIELD_IDS) as (keyof AutofillFormFields)[]).forEach((key) => {
    const prevVal = before[key] == null ? "" : String(before[key]);
    const nextVal = after[key] == null ? "" : String(after[key]);
    if (nextVal !== "" && nextVal !== prevVal) ids.push(FIELD_IDS[key]);
  });
  return ids;
}

export function projectSpecSelections(
  prev: Record<number, string>,
  specs: { id: number; displayOrder: number }[],
  extraSelections: Record<number, string>,
  legacyForm: { battingStyle?: string; bowlingStyle?: string; specialization?: string },
): Record<number, string> {
  const next = { ...prev };
  for (const [groupId, value] of Object.entries(extraSelections)) {
    next[Number(groupId)] = value;
  }
  for (const group of specs) {
    const legacyKeyIdx = specs
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .findIndex((g) => g.id === group.id);
    const legacyVal =
      legacyKeyIdx === 0 ? legacyForm.battingStyle
      : legacyKeyIdx === 1 ? legacyForm.bowlingStyle
      : legacyKeyIdx === 2 ? legacyForm.specialization
      : undefined;
    if (legacyVal && !next[group.id]) next[group.id] = legacyVal;
  }
  return next;
}

export function changedSpecFieldIds(
  before: Record<number, string>,
  after: Record<number, string>,
): string[] {
  const ids: string[] = [];
  for (const [groupId, value] of Object.entries(after)) {
    if (!value) continue;
    if ((before[Number(groupId)] ?? "") !== value) ids.push(`spec:${groupId}`);
  }
  return ids;
}
