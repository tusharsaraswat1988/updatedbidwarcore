import {
  buildRegistrationFieldVisibility,
  buildRegistrationFieldRequirements,
  parseRegistrationFieldsConfig,
  type RegistrationConfigurableFieldKey,
  type RegistrationFieldsConfig,
} from "@workspace/api-base/registration-fields";

type PlayerRegistrationInput = {
  email?: string | null;
  city?: string | null;
  age?: number | null;
  gender?: string | null;
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  lowerSize?: string | null;
  achievements?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  whatsappConsent?: boolean | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  role?: string | null;
};

/** Drop values for fields hidden by the organizer. */
export function sanitizeRegistrationInputByVisibility(
  input: PlayerRegistrationInput,
  visibility: Record<RegistrationConfigurableFieldKey, boolean>,
): PlayerRegistrationInput {
  const next = { ...input };
  if (!visibility.email) next.email = undefined;
  if (!visibility.city) next.city = undefined;
  if (!visibility.age) next.age = undefined;
  if (!visibility.gender) next.gender = undefined;
  if (!visibility.jerseyNumber) next.jerseyNumber = undefined;
  if (!visibility.jerseySize) next.jerseySize = undefined;
  if (!visibility.lowerSize) next.lowerSize = undefined;
  if (!visibility.achievements) next.achievements = undefined;
  if (!visibility.cricheroUrl) next.cricheroUrl = undefined;
  if (!visibility.matchAvailability) next.availabilityDates = undefined;
  if (!visibility.whatsappConsent) next.whatsappConsent = false;
  if (visibility.photo === false) {
    next.photoUrl = undefined;
    next.photoPublicId = undefined;
  }
  if (visibility.role === false) {
    next.role = undefined;
  }
  return next;
}

export function resolveRegistrationFieldVisibilityFromTournament(
  raw: unknown,
  sportId?: string | null,
): Record<RegistrationConfigurableFieldKey, boolean> {
  return buildRegistrationFieldVisibility(
    parseRegistrationFieldsConfig(raw),
    sportId,
  );
}

export function resolveRegistrationFieldRequirementsFromTournament(
  raw: unknown,
  sportId?: string | null,
): Record<RegistrationConfigurableFieldKey, boolean> {
  return buildRegistrationFieldRequirements(
    parseRegistrationFieldsConfig(raw),
    sportId,
  );
}
