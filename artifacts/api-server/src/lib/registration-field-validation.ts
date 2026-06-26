import {
  buildRegistrationFieldVisibility,
  type RegistrationFieldsConfig,
  type RegistrationOptionalFieldKey,
} from "@workspace/api-base/registration-fields";

type PlayerRegistrationInput = {
  email?: string | null;
  city?: string | null;
  age?: number | null;
  gender?: string | null;
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  achievements?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  whatsappConsent?: boolean | null;
};

/** Drop values for optional fields hidden by the organizer. */
export function sanitizeRegistrationInputByVisibility(
  input: PlayerRegistrationInput,
  visibility: Record<RegistrationOptionalFieldKey, boolean>,
): PlayerRegistrationInput {
  const next = { ...input };
  if (!visibility.email) next.email = undefined;
  if (!visibility.city) next.city = undefined;
  if (!visibility.age) next.age = undefined;
  if (!visibility.gender) next.gender = undefined;
  if (!visibility.jerseyNumber) next.jerseyNumber = undefined;
  if (!visibility.jerseySize) next.jerseySize = undefined;
  if (!visibility.achievements) next.achievements = undefined;
  if (!visibility.cricheroUrl) next.cricheroUrl = undefined;
  if (!visibility.matchAvailability) next.availabilityDates = undefined;
  if (!visibility.whatsappConsent) next.whatsappConsent = false;
  return next;
}

export function resolveRegistrationFieldVisibilityFromTournament(
  raw: unknown,
): Record<RegistrationOptionalFieldKey, boolean> {
  return buildRegistrationFieldVisibility(raw as RegistrationFieldsConfig | null | undefined);
}
