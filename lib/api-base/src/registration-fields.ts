/** Always shown on public registration — organizer cannot disable these. */
export const REGISTRATION_MANDATORY_FIELD_KEYS = [
  "name",
  "mobile",
  "photo",
  "role",
] as const;

export type RegistrationMandatoryFieldKey =
  (typeof REGISTRATION_MANDATORY_FIELD_KEYS)[number];

/** Optional profile fields the organizer may hide on the registration form. */
export const REGISTRATION_OPTIONAL_FIELD_KEYS = [
  "email",
  "city",
  "age",
  "gender",
  "jerseyNumber",
  "jerseySize",
  "achievements",
  "cricheroUrl",
  "matchAvailability",
  "whatsappConsent",
] as const;

export type RegistrationOptionalFieldKey =
  (typeof REGISTRATION_OPTIONAL_FIELD_KEYS)[number];

export interface RegistrationFieldsConfig {
  /** Optional field keys hidden from the public registration form. */
  hidden?: RegistrationOptionalFieldKey[];
}

export const REGISTRATION_OPTIONAL_FIELD_LABELS: Record<
  RegistrationOptionalFieldKey,
  string
> = {
  email: "Email",
  city: "City",
  age: "Age",
  gender: "Gender",
  jerseyNumber: "Jersey Number",
  jerseySize: "Jersey Size",
  achievements: "Achievements / Bio",
  cricheroUrl: "CricHero Profile URL",
  matchAvailability: "Match Availability",
  whatsappConsent: "WhatsApp Updates",
};

const OPTIONAL_KEY_SET = new Set<string>(REGISTRATION_OPTIONAL_FIELD_KEYS);

export function parseRegistrationFieldsConfig(
  raw: unknown,
): RegistrationFieldsConfig {
  if (!raw || typeof raw !== "object") return { hidden: [] };
  const hiddenRaw = (raw as RegistrationFieldsConfig).hidden;
  if (!Array.isArray(hiddenRaw)) return { hidden: [] };
  const hidden = hiddenRaw.filter(
    (key): key is RegistrationOptionalFieldKey =>
      typeof key === "string" && OPTIONAL_KEY_SET.has(key),
  );
  return { hidden: [...new Set(hidden)] };
}

export function buildRegistrationFieldVisibility(
  config: RegistrationFieldsConfig | null | undefined,
): Record<RegistrationOptionalFieldKey, boolean> {
  const hidden = new Set(config?.hidden ?? []);
  return Object.fromEntries(
    REGISTRATION_OPTIONAL_FIELD_KEYS.map((key) => [key, !hidden.has(key)]),
  ) as Record<RegistrationOptionalFieldKey, boolean>;
}

export function isRegistrationFieldVisible(
  key: RegistrationOptionalFieldKey,
  config: RegistrationFieldsConfig | null | undefined,
): boolean {
  return buildRegistrationFieldVisibility(config)[key];
}

export function serializeRegistrationFieldsConfig(
  hidden: RegistrationOptionalFieldKey[],
): RegistrationFieldsConfig {
  const valid = hidden.filter((key) => OPTIONAL_KEY_SET.has(key));
  return { hidden: [...new Set(valid)] };
}

export function validateMandatoryRegistrationFields(input: {
  name?: string | null;
  mobileNumber?: string | null;
  photoUrl?: string | null;
  role?: string | null;
}): { ok: true } | { ok: false; error: string; field: string } {
  if (!input.name?.trim()) {
    return { ok: false, error: "Full name is required.", field: "name" };
  }
  if (!input.mobileNumber?.trim()) {
    return { ok: false, error: "Mobile number is required.", field: "mobileNumber" };
  }
  if (!input.photoUrl?.trim()) {
    return { ok: false, error: "Player photo is required.", field: "photoUrl" };
  }
  if (!input.role?.trim()) {
    return { ok: false, error: "Role is required.", field: "role" };
  }
  return { ok: true };
}
