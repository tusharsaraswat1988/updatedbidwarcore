import { getSportCapabilities } from "@workspace/platform-core";

/**
 * Permanently mandatory fields that must ALWAYS be visible and required on public registration.
 * Organizers cannot hide or make these optional through settings or direct API requests.
 */
export const REGISTRATION_PERMANENT_MANDATORY_FIELD_KEYS = [
  "name",
  "mobile",
] as const;

export type RegistrationPermanentMandatoryFieldKey =
  (typeof REGISTRATION_PERMANENT_MANDATORY_FIELD_KEYS)[number];

/** Legacy alias for backwards compatibility. */
export const REGISTRATION_MANDATORY_FIELD_KEYS = [
  "name",
  "mobile",
  "photo",
  "role",
] as const;

export type RegistrationMandatoryFieldKey =
  (typeof REGISTRATION_MANDATORY_FIELD_KEYS)[number];

/**
 * All pre-existing profile fields that organizers can independently configure
 * as mandatory, optional, or hidden.
 */
export const REGISTRATION_CONFIGURABLE_FIELD_KEYS = [
  "photo",
  "role",
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

export type RegistrationConfigurableFieldKey =
  (typeof REGISTRATION_CONFIGURABLE_FIELD_KEYS)[number];

/** Backwards-compatible alias for existing code. */
export const REGISTRATION_OPTIONAL_FIELD_KEYS =
  REGISTRATION_CONFIGURABLE_FIELD_KEYS;

export type RegistrationOptionalFieldKey = RegistrationConfigurableFieldKey;

const CONFIGURABLE_KEY_SET = new Set<string>(
  REGISTRATION_CONFIGURABLE_FIELD_KEYS,
);

/**
 * Default configurable fields that are required when a tournament does not have
 * an explicit `required` configuration (preserves legacy tournament behavior).
 */
export const DEFAULT_REQUIRED_CONFIGURABLE_FIELDS: readonly RegistrationConfigurableFieldKey[] =
  ["photo", "role"] as const;

const DEFAULT_REQUIRED_SET = new Set<string>(
  DEFAULT_REQUIRED_CONFIGURABLE_FIELDS,
);

/** Supported custom question types. */
export const REGISTRATION_QUESTION_TYPES = [
  "short_text",
  "number",
  "single_choice",
  "multiple_choice",
  "dropdown",
] as const;

export type RegistrationQuestionType =
  (typeof REGISTRATION_QUESTION_TYPES)[number];

const QUESTION_TYPE_SET = new Set<string>(REGISTRATION_QUESTION_TYPES);

export interface RegistrationCustomQuestion {
  /** Stable unique identifier within the tournament (e.g. "q_abc123"). */
  id: string;
  /** Label/title of the question shown to the player. */
  label: string;
  /** Input type for the question. */
  type: RegistrationQuestionType;
  /** Whether an answer is required to complete registration. */
  required: boolean;
  /** Selectable options for single_choice, multiple_choice, and dropdown. */
  options?: string[];
}

export interface RegistrationFieldsConfig {
  /** Configurable field keys hidden from the public registration form. */
  hidden?: RegistrationConfigurableFieldKey[];
  /** Configurable field keys that are required to complete registration. */
  required?: RegistrationConfigurableFieldKey[];
  /** Organizer-defined custom registration questions. */
  customQuestions?: RegistrationCustomQuestion[];
}

export function sanitizeCustomQuestionOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const cleaned: string[] = [];
  for (const opt of options) {
    if (typeof opt === "string") {
      const trimmed = opt.trim();
      if (trimmed && !cleaned.includes(trimmed)) {
        cleaned.push(trimmed);
      }
    }
  }
  return cleaned;
}

export function parseRegistrationCustomQuestions(
  raw: unknown,
): RegistrationCustomQuestion[] {
  if (!Array.isArray(raw)) return [];
  const result: RegistrationCustomQuestion[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as Partial<RegistrationCustomQuestion>;
    const id = typeof q.id === "string" ? q.id.trim() : "";
    const label = typeof q.label === "string" ? q.label.trim() : "";
    const type =
      typeof q.type === "string" && QUESTION_TYPE_SET.has(q.type)
        ? (q.type as RegistrationQuestionType)
        : null;
    const required = Boolean(q.required);

    if (!id || !label || !type || seenIds.has(id)) continue;
    seenIds.add(id);

    const question: RegistrationCustomQuestion = {
      id,
      label,
      type,
      required,
    };

    if (
      type === "single_choice" ||
      type === "multiple_choice" ||
      type === "dropdown"
    ) {
      question.options = sanitizeCustomQuestionOptions(q.options);
    }

    result.push(question);
  }

  return result;
}

export function validateCustomQuestionsDefinition(
  questions: unknown,
): { ok: true; questions: RegistrationCustomQuestion[] } | { ok: false; error: string } {
  if (!Array.isArray(questions)) {
    return { ok: false, error: "Custom questions must be an array." };
  }

  const result: RegistrationCustomQuestion[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `Question #${i + 1} must be an object.` };
    }
    const q = item as Partial<RegistrationCustomQuestion>;
    const id = typeof q.id === "string" ? q.id.trim() : "";
    const label = typeof q.label === "string" ? q.label.trim() : "";
    const type =
      typeof q.type === "string" ? (q.type.trim() as RegistrationQuestionType) : null;
    const required = Boolean(q.required);

    if (!id) {
      return { ok: false, error: `Question #${i + 1} must have a stable ID.` };
    }
    if (seenIds.has(id)) {
      return { ok: false, error: `Duplicate question ID: "${id}".` };
    }
    seenIds.add(id);

    if (!label) {
      return { ok: false, error: `Question "${id}" must have a label.` };
    }
    if (!type || !QUESTION_TYPE_SET.has(type)) {
      return {
        ok: false,
        error: `Question "${label}" has an invalid type: "${q.type}". Allowed types: ${REGISTRATION_QUESTION_TYPES.join(", ")}.`,
      };
    }

    const question: RegistrationCustomQuestion = {
      id,
      label,
      type,
      required,
    };

    if (
      type === "single_choice" ||
      type === "multiple_choice" ||
      type === "dropdown"
    ) {
      const options = sanitizeCustomQuestionOptions(q.options);
      if (options.length === 0) {
        return {
          ok: false,
          error: `Question "${label}" of type "${type}" must have at least one option.`,
        };
      }
      question.options = options;
    }

    result.push(question);
  }

  return { ok: true, questions: result };
}

export function validateCustomAnswers(
  questions: RegistrationCustomQuestion[] | undefined,
  answers: unknown,
):
  | { ok: true; sanitizedAnswers: Record<string, unknown> }
  | { ok: false; error: string; field?: string } {
  const activeQuestions = questions ?? [];
  const rawAnswers =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {};

  const allowedIds = new Set(activeQuestions.map((q) => q.id));
  for (const k of Object.keys(rawAnswers)) {
    if (!allowedIds.has(k)) {
      return {
        ok: false,
        error: `Invalid question ID "${k}".`,
        field: `customAnswers.${k}`,
      };
    }
  }

  const sanitized: Record<string, unknown> = {};

  for (const q of activeQuestions) {
    const val = rawAnswers[q.id];

    if (val === undefined || val === null || val === "") {
      if (q.required) {
        return {
          ok: false,
          error: `"${q.label}" is required.`,
          field: `customAnswers.${q.id}`,
        };
      }
      continue;
    }

    if (q.type === "short_text") {
      const strVal = String(val).trim();
      if (!strVal && q.required) {
        return {
          ok: false,
          error: `"${q.label}" is required.`,
          field: `customAnswers.${q.id}`,
        };
      }
      if (strVal) sanitized[q.id] = strVal;
    } else if (q.type === "number") {
      const numVal = typeof val === "number" ? val : Number(val);
      if (Number.isNaN(numVal)) {
        return {
          ok: false,
          error: `"${q.label}" must be a valid number.`,
          field: `customAnswers.${q.id}`,
        };
      }
      sanitized[q.id] = numVal;
    } else if (q.type === "single_choice" || q.type === "dropdown") {
      const strVal = String(val).trim();
      const options = q.options ?? [];
      if (!options.includes(strVal)) {
        return {
          ok: false,
          error: `Invalid option selected for "${q.label}".`,
          field: `customAnswers.${q.id}`,
        };
      }
      sanitized[q.id] = strVal;
    } else if (q.type === "multiple_choice") {
      if (!Array.isArray(val)) {
        return {
          ok: false,
          error: `"${q.label}" expects an array of selected options.`,
          field: `customAnswers.${q.id}`,
        };
      }
      const options = q.options ?? [];
      const selected: string[] = [];
      for (const item of val) {
        const strItem = String(item).trim();
        if (!options.includes(strItem)) {
          return {
            ok: false,
            error: `Invalid option selected for "${q.label}".`,
            field: `customAnswers.${q.id}`,
          };
        }
        if (!selected.includes(strItem)) {
          selected.push(strItem);
        }
      }
      if (selected.length === 0 && q.required) {
        return {
          ok: false,
          error: `"${q.label}" is required.`,
          field: `customAnswers.${q.id}`,
        };
      }
      sanitized[q.id] = selected;
    }
  }

  return { ok: true, sanitizedAnswers: sanitized };
}

/** Configurable fields available for a sport (hides CricHero unless supported). */
export function registrationConfigurableFieldKeysForSport(
  sportId: string | null | undefined,
): RegistrationConfigurableFieldKey[] {
  const caps = getSportCapabilities(sportId);
  return REGISTRATION_CONFIGURABLE_FIELD_KEYS.filter((key) => {
    if (key === "cricheroUrl") return caps.hasLegacyCricketSpecs;
    return true;
  });
}

/** Legacy alias for backwards compatibility. */
export const registrationOptionalFieldKeysForSport =
  registrationConfigurableFieldKeysForSport;

export const REGISTRATION_CONFIGURABLE_FIELD_LABELS: Record<
  RegistrationConfigurableFieldKey,
  string
> = {
  photo: "Player Photo",
  role: "Playing Role",
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

/** Backwards-compatible alias for existing code. */
export const REGISTRATION_OPTIONAL_FIELD_LABELS =
  REGISTRATION_CONFIGURABLE_FIELD_LABELS;

export function parseRegistrationFieldsConfig(
  raw: unknown,
): RegistrationFieldsConfig {
  if (!raw || typeof raw !== "object") {
    return { hidden: [], required: undefined, customQuestions: [] };
  }
  const obj = raw as RegistrationFieldsConfig;
  const hiddenRaw = obj.hidden;
  const hidden = Array.isArray(hiddenRaw)
    ? hiddenRaw.filter(
        (key): key is RegistrationConfigurableFieldKey =>
          typeof key === "string" &&
          CONFIGURABLE_KEY_SET.has(key) &&
          key !== ("name" as string) &&
          key !== ("mobile" as string),
      )
    : [];

  const hiddenSet = new Set(hidden);

  let required: RegistrationConfigurableFieldKey[] | undefined = undefined;
  if (Array.isArray(obj.required)) {
    required = obj.required.filter(
      (key): key is RegistrationConfigurableFieldKey =>
        typeof key === "string" &&
        CONFIGURABLE_KEY_SET.has(key) &&
        !hiddenSet.has(key as RegistrationConfigurableFieldKey),
    );
  }

  const customQuestions = parseRegistrationCustomQuestions(obj.customQuestions);

  return {
    hidden: [...new Set(hidden)],
    ...(required !== undefined ? { required: [...new Set(required)] } : {}),
    customQuestions,
  };
}

export function buildRegistrationFieldVisibility(
  config: RegistrationFieldsConfig | null | undefined,
  sportId?: string | null,
): Record<RegistrationConfigurableFieldKey, boolean> {
  const hidden = new Set(config?.hidden ?? []);
  const allowed = new Set(registrationConfigurableFieldKeysForSport(sportId));
  return Object.fromEntries(
    REGISTRATION_CONFIGURABLE_FIELD_KEYS.map((key) => [
      key,
      allowed.has(key) && !hidden.has(key),
    ]),
  ) as Record<RegistrationConfigurableFieldKey, boolean>;
}

export function isRegistrationFieldVisible(
  key: RegistrationConfigurableFieldKey,
  config: RegistrationFieldsConfig | null | undefined,
  sportId?: string | null,
): boolean {
  return buildRegistrationFieldVisibility(config, sportId)[key];
}

/**
 * Builds the effective requirement state (true = mandatory, false = optional) for every
 * configurable field.
 *
 * Rules:
 * - Hidden fields CANNOT be required (always return false).
 * - If `config.required` is explicitly provided, uses the organizer's configured fields.
 * - If `config.required` is undefined (legacy tournament), defaults to photo and role being required.
 */
export function buildRegistrationFieldRequirements(
  config: RegistrationFieldsConfig | null | undefined,
  sportId?: string | null,
): Record<RegistrationConfigurableFieldKey, boolean> {
  const visibility = buildRegistrationFieldVisibility(config, sportId);
  const isExplicit = Array.isArray(config?.required);
  const requiredSet = isExplicit
    ? new Set(config!.required)
    : DEFAULT_REQUIRED_SET;

  return Object.fromEntries(
    REGISTRATION_CONFIGURABLE_FIELD_KEYS.map((key) => [
      key,
      Boolean(visibility[key] && requiredSet.has(key)),
    ]),
  ) as Record<RegistrationConfigurableFieldKey, boolean>;
}

/**
 * Returns whether a registration field is required.
 * Name and Mobile are permanently mandatory and unconditionally return true.
 */
export function isRegistrationFieldRequired(
  key: string,
  config: RegistrationFieldsConfig | null | undefined,
  sportId?: string | null,
): boolean {
  if (key === "name" || key === "mobile") return true;
  if (!CONFIGURABLE_KEY_SET.has(key)) return false;
  return buildRegistrationFieldRequirements(config, sportId)[
    key as RegistrationConfigurableFieldKey
  ];
}

export function serializeRegistrationFieldsConfig(
  hidden: RegistrationConfigurableFieldKey[],
  requiredOrCustomQuestions?:
    | RegistrationConfigurableFieldKey[]
    | RegistrationCustomQuestion[],
  customQuestions?: RegistrationCustomQuestion[],
): RegistrationFieldsConfig {
  const validHidden = hidden.filter(
    (key) =>
      CONFIGURABLE_KEY_SET.has(key) &&
      key !== ("name" as string) &&
      key !== ("mobile" as string),
  );
  const hiddenSet = new Set(validHidden);

  let required: RegistrationConfigurableFieldKey[] | undefined = undefined;
  let questions: RegistrationCustomQuestion[] | undefined = undefined;

  if (Array.isArray(requiredOrCustomQuestions)) {
    if (
      requiredOrCustomQuestions.length > 0 &&
      typeof requiredOrCustomQuestions[0] === "object" &&
      requiredOrCustomQuestions[0] !== null &&
      "id" in requiredOrCustomQuestions[0]
    ) {
      questions = requiredOrCustomQuestions as RegistrationCustomQuestion[];
    } else {
      required = requiredOrCustomQuestions as RegistrationConfigurableFieldKey[];
      questions = customQuestions;
    }
  } else {
    questions = customQuestions;
  }

  const result: RegistrationFieldsConfig = {
    hidden: [...new Set(validHidden)],
  };

  if (required !== undefined) {
    const validRequired = required.filter(
      (key) => CONFIGURABLE_KEY_SET.has(key) && !hiddenSet.has(key),
    );
    result.required = [...new Set(validRequired)];
  }

  if (questions !== undefined) {
    result.customQuestions = parseRegistrationCustomQuestions(questions);
  }

  return result;
}

export function validateRegistrationFieldsUpdate(data: unknown):
  | { ok: true; config: RegistrationFieldsConfig }
  | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      error: "Registration fields configuration must be an object.",
    };
  }

  const obj = data as Partial<RegistrationFieldsConfig>;

  if (obj.hidden !== undefined) {
    if (!Array.isArray(obj.hidden)) {
      return { ok: false, error: "Hidden fields must be an array." };
    }
    for (const k of obj.hidden) {
      if (k === ("name" as string) || k === ("mobile" as string)) {
        return {
          ok: false,
          error: "Player name and mobile number cannot be hidden.",
        };
      }
      if (!CONFIGURABLE_KEY_SET.has(k)) {
        return { ok: false, error: `Invalid hidden field key: "${k}".` };
      }
    }
  }

  if (obj.required !== undefined) {
    if (!Array.isArray(obj.required)) {
      return { ok: false, error: "Required fields must be an array." };
    }
    for (const k of obj.required) {
      if (
        !CONFIGURABLE_KEY_SET.has(k) &&
        k !== ("name" as string) &&
        k !== ("mobile" as string)
      ) {
        return { ok: false, error: `Invalid required field key: "${k}".` };
      }
    }
    const hiddenSet = new Set(obj.hidden ?? []);
    for (const k of obj.required) {
      if (hiddenSet.has(k as RegistrationConfigurableFieldKey)) {
        return {
          ok: false,
          error: `Hidden fields cannot be required: "${k}".`,
        };
      }
    }
  }

  if (obj.customQuestions !== undefined) {
    const qVal = validateCustomQuestionsDefinition(obj.customQuestions);
    if (!qVal.ok) {
      return { ok: false, error: qVal.error };
    }
  }

  return { ok: true, config: parseRegistrationFieldsConfig(data) };
}

/**
 * Validates player registration input against tournament configuration.
 * Always requires Name and Mobile Number.
 * Evaluates configured requirements for each configurable field.
 */
export function validatePlayerRegistrationRequirements(
  input: {
    name?: string | null;
    mobileNumber?: string | null;
    photoUrl?: string | null;
    role?: string | null;
    email?: string | null;
    city?: string | null;
    age?: number | string | null;
    gender?: string | null;
    jerseyNumber?: number | string | null;
    jerseySize?: string | null;
    achievements?: string | null;
    cricheroUrl?: string | null;
    availabilityDates?: string | null;
    whatsappConsent?: boolean | null;
  },
  config: RegistrationFieldsConfig | null | undefined,
  context?: {
    sportId?: string | null;
    hasMatchDates?: boolean;
    isClosedUpdate?: boolean;
  },
): { ok: true } | { ok: false; error: string; field: string } {
  // Always mandatory fields
  if (!input.name?.trim()) {
    return { ok: false, error: "Full name is required.", field: "name" };
  }
  if (!input.mobileNumber?.trim()) {
    return {
      ok: false,
      error: "Mobile number is required.",
      field: "mobileNumber",
    };
  }

  const reqs = buildRegistrationFieldRequirements(config, context?.sportId);

  // Photo
  if (reqs.photo && !input.photoUrl?.trim()) {
    return { ok: false, error: "Player photo is required.", field: "photoUrl" };
  }

  // Role
  if (reqs.role && !input.role?.trim()) {
    return { ok: false, error: "Role is required.", field: "role" };
  }

  // In closed self-update mode, only photo and role/specs are updated; other fields are locked.
  if (context?.isClosedUpdate) {
    return { ok: true };
  }

  // Email
  if (reqs.email && !input.email?.trim()) {
    return { ok: false, error: "Email address is required.", field: "email" };
  }

  // City
  if (reqs.city && !input.city?.trim()) {
    return { ok: false, error: "City is required.", field: "city" };
  }

  // Age
  if (reqs.age) {
    const ageNum =
      typeof input.age === "number"
        ? input.age
        : parseInt(String(input.age || ""), 10);
    if (!Number.isFinite(ageNum) || ageNum <= 0) {
      return { ok: false, error: "Age is required.", field: "age" };
    }
  }

  // Gender
  if (reqs.gender) {
    const g = input.gender?.trim();
    if (!g || (g !== "M" && g !== "F")) {
      return { ok: false, error: "Gender is required.", field: "gender" };
    }
  }

  // Jersey Number
  if (
    reqs.jerseyNumber &&
    (input.jerseyNumber == null || String(input.jerseyNumber).trim() === "")
  ) {
    return {
      ok: false,
      error: "Jersey number is required.",
      field: "jerseyNumber",
    };
  }

  // Jersey Size
  if (reqs.jerseySize && !input.jerseySize?.trim()) {
    return { ok: false, error: "Jersey size is required.", field: "jerseySize" };
  }

  // Achievements
  if (reqs.achievements && !input.achievements?.trim()) {
    return {
      ok: false,
      error: "Achievements / bio is required.",
      field: "achievements",
    };
  }

  // CricHero Profile URL
  if (reqs.cricheroUrl && !input.cricheroUrl?.trim()) {
    return {
      ok: false,
      error: "CricHero profile URL is required.",
      field: "cricheroUrl",
    };
  }

  // Match Availability
  if (
    reqs.matchAvailability &&
    context?.hasMatchDates !== false &&
    !input.availabilityDates?.trim()
  ) {
    return {
      ok: false,
      error: "Match availability is required.",
      field: "availabilityDates",
    };
  }

  // WhatsApp Consent
  if (reqs.whatsappConsent && !input.whatsappConsent) {
    return {
      ok: false,
      error: "WhatsApp updates consent is required.",
      field: "whatsappConsent",
    };
  }

  return { ok: true };
}

/**
 * Shared validation helper for name, mobile, photo, role.
 * Backward compatible: if `config` is omitted, requires photo and role.
 * If `config` is provided, obeys tournament's requirement settings for photo and role.
 */
export function validateMandatoryRegistrationFields(
  input: {
    name?: string | null;
    mobileNumber?: string | null;
    photoUrl?: string | null;
    role?: string | null;
  },
  config?: RegistrationFieldsConfig | null,
): { ok: true } | { ok: false; error: string; field: string } {
  if (!input.name?.trim()) {
    return { ok: false, error: "Full name is required.", field: "name" };
  }
  if (!input.mobileNumber?.trim()) {
    return {
      ok: false,
      error: "Mobile number is required.",
      field: "mobileNumber",
    };
  }
  const photoRequired =
    config !== undefined ? isRegistrationFieldRequired("photo", config) : true;
  if (photoRequired && !input.photoUrl?.trim()) {
    return { ok: false, error: "Player photo is required.", field: "photoUrl" };
  }
  const roleRequired =
    config !== undefined ? isRegistrationFieldRequired("role", config) : true;
  if (roleRequired && !input.role?.trim()) {
    return { ok: false, error: "Role is required.", field: "role" };
  }
  return { ok: true };
}
