/**
 * Reusable default configuration for a standalone tournament.
 * Sample "bpl" slug is for development/testing only — not hard-coded into the engine.
 */

export type SeedFormField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  section: string;
  required: boolean;
  optionsJson: string[] | null;
  sortOrder: number;
  isActive: boolean;
};

export type SeedCategory = {
  code: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  gender: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SeedTournamentConfig = {
  slug: string;
  name: string;
  registrationTitle: string;
  registrationDescription: string;
  registrationFee: number;
  currency: string;
  registrationIdPrefix: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  termsAndConditions: string;
  privacyNotice: string;
  successMessage: string;
  paymentInstructions: string;
  isActive: boolean;
  allowDuplicateRegistrations: boolean;
  formFields: SeedFormField[];
  categories: SeedCategory[];
};

const DEFAULT_FORM_FIELDS: SeedFormField[] = [
  {
    fieldKey: "playerName",
    label: "Full Name",
    fieldType: "text",
    section: "personal",
    required: true,
    optionsJson: null,
    sortOrder: 10,
    isActive: true,
  },
  {
    fieldKey: "parentName",
    label: "Father's / Mother's Name",
    fieldType: "text",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 20,
    isActive: true,
  },
  {
    fieldKey: "dateOfBirth",
    label: "Date of Birth",
    fieldType: "date",
    section: "personal",
    required: true,
    optionsJson: null,
    sortOrder: 30,
    isActive: true,
  },
  {
    fieldKey: "gender",
    label: "Gender",
    fieldType: "select",
    section: "personal",
    required: true,
    optionsJson: ["Male", "Female", "Other"],
    sortOrder: 40,
    isActive: true,
  },
  {
    fieldKey: "mobile",
    label: "Mobile Number",
    fieldType: "tel",
    section: "personal",
    required: true,
    optionsJson: null,
    sortOrder: 50,
    isActive: true,
  },
  {
    fieldKey: "whatsapp",
    label: "WhatsApp Number",
    fieldType: "tel",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 60,
    isActive: true,
  },
  {
    fieldKey: "email",
    label: "Email",
    fieldType: "email",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 70,
    isActive: true,
  },
  {
    fieldKey: "address",
    label: "Address",
    fieldType: "textarea",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 80,
    isActive: true,
  },
  {
    fieldKey: "city",
    label: "City",
    fieldType: "text",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 90,
    isActive: true,
  },
  {
    fieldKey: "state",
    label: "State",
    fieldType: "text",
    section: "personal",
    required: false,
    optionsJson: null,
    sortOrder: 100,
    isActive: true,
  },
  {
    fieldKey: "playingRole",
    label: "Playing Role",
    fieldType: "select",
    section: "cricket",
    required: true,
    optionsJson: ["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"],
    sortOrder: 110,
    isActive: true,
  },
  {
    fieldKey: "battingStyle",
    label: "Batting Style",
    fieldType: "select",
    section: "cricket",
    required: false,
    optionsJson: ["Right Hand", "Left Hand"],
    sortOrder: 120,
    isActive: true,
  },
  {
    fieldKey: "bowlingStyle",
    label: "Bowling Style",
    fieldType: "select",
    section: "cricket",
    required: false,
    optionsJson: [
      "Right Arm Fast",
      "Right Arm Medium",
      "Right Arm Spin",
      "Left Arm Fast",
      "Left Arm Medium",
      "Left Arm Spin",
      "Does Not Bowl",
    ],
    sortOrder: 130,
    isActive: true,
  },
  {
    fieldKey: "cricketExperience",
    label: "Cricket Experience",
    fieldType: "textarea",
    section: "cricket",
    required: false,
    optionsJson: null,
    sortOrder: 140,
    isActive: true,
  },
  {
    fieldKey: "previousTournamentExperience",
    label: "Previous Tournament Experience",
    fieldType: "textarea",
    section: "cricket",
    required: false,
    optionsJson: null,
    sortOrder: 150,
    isActive: true,
  },
  {
    fieldKey: "jerseySize",
    label: "Jersey Size",
    fieldType: "select",
    section: "cricket",
    required: false,
    optionsJson: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
    sortOrder: 160,
    isActive: true,
  },
  {
    fieldKey: "preferredJerseyNumber",
    label: "Preferred Jersey Number",
    fieldType: "text",
    section: "cricket",
    required: false,
    optionsJson: null,
    sortOrder: 170,
    isActive: true,
  },
];

/**
 * Build a seed config for any tournament. Defaults illustrate a sample BPL-style
 * event when called with `buildSampleTournamentSeed("bpl")`, but any slug works.
 */
export function buildSampleTournamentSeed(
  slug: string,
  overrides?: Partial<SeedTournamentConfig>,
): SeedTournamentConfig {
  const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "sample";
  const yearSuffix = String(new Date().getUTCFullYear()).slice(-2);
  const prefixBase = normalizedSlug.replace(/-/g, "").toUpperCase().slice(0, 8) || "SR";

  return {
    slug: normalizedSlug,
    name: overrides?.name ?? `${normalizedSlug.toUpperCase()} Cricket Tournament`,
    registrationTitle: overrides?.registrationTitle ?? "Player Registration",
    registrationDescription:
      overrides?.registrationDescription ??
      "Register to participate. Complete your details and proceed to payment.",
    registrationFee: overrides?.registrationFee ?? 500,
    currency: overrides?.currency ?? "INR",
    registrationIdPrefix: overrides?.registrationIdPrefix ?? `${prefixBase}${yearSuffix}`,
    contactName: overrides?.contactName ?? "Tournament Desk",
    contactMobile: overrides?.contactMobile ?? "9999999999",
    contactEmail: overrides?.contactEmail ?? "registrations@example.com",
    termsAndConditions:
      overrides?.termsAndConditions ??
      "By registering you confirm the details provided are accurate and agree to tournament rules.",
    privacyNotice:
      overrides?.privacyNotice ??
      "Your data is used only for tournament registration and related communication.",
    successMessage:
      overrides?.successMessage ??
      "Registration received. Complete payment to confirm your spot.",
    paymentInstructions:
      overrides?.paymentInstructions ??
      "You will be redirected to the payment gateway to complete registration.",
    isActive: overrides?.isActive ?? true,
    allowDuplicateRegistrations: overrides?.allowDuplicateRegistrations ?? false,
    formFields: overrides?.formFields ?? DEFAULT_FORM_FIELDS,
    categories: overrides?.categories ?? [
      {
        code: "open",
        name: "Open",
        minAge: null,
        maxAge: null,
        gender: null,
        sortOrder: 10,
        isActive: true,
      },
      {
        code: "u19",
        name: "Under 19",
        minAge: null,
        maxAge: 19,
        gender: null,
        sortOrder: 20,
        isActive: true,
      },
    ],
  };
}

/** Dev/test convenience — sample config for slug `bpl`. Engine remains slug-agnostic. */
export function buildBplSampleSeed(): SeedTournamentConfig {
  return buildSampleTournamentSeed("bpl", {
    name: "BPL Cricket Tournament",
    registrationTitle: "BPL Player Registration",
    registrationIdPrefix: `BPL${String(new Date().getUTCFullYear()).slice(-2)}`,
    registrationFee: 500,
  });
}
