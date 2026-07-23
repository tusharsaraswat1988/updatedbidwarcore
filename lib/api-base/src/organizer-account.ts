export const ORGANIZER_LICENSE_ACTIVE = "active";
export const ORGANIZER_LICENSE_SUSPENDED = "suspended";

/** Suspended organisers are locked out of tournament management. */
export function isOrganizerAccountLocked(licenseStatus: string): boolean {
  return licenseStatus === ORGANIZER_LICENSE_SUSPENDED;
}

/** Active by default; legacy `pending` rows are treated as active. */
export function isOrganizerAccountActive(licenseStatus: string): boolean {
  return !isOrganizerAccountLocked(licenseStatus);
}

export function organizerAccessLabel(licenseStatus: string): "active" | "locked" {
  return isOrganizerAccountLocked(licenseStatus) ? "locked" : "active";
}

/** Admin filter buckets for phone verification status. */
export type OrganizerPhoneFilter = "all" | "verified" | "missing_phone" | "incomplete_profile";

export function organizerPhoneStatusLabel(input: {
  mobile: string | null | undefined;
  phoneVerified?: boolean | null;
}): "verified" | "missing_phone" | "incomplete_profile" {
  if (!input.mobile) return "missing_phone";
  if (input.phoneVerified === true) return "verified";
  return "incomplete_profile";
}
