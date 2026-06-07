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
