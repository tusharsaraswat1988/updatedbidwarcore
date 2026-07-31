export const ORGANIZER_LICENSE_ACTIVE = "active";
export const ORGANIZER_LICENSE_SUSPENDED = "suspended";
/** Suspended organisers are locked out of tournament management. */
export function isOrganizerAccountLocked(licenseStatus) {
    return licenseStatus === ORGANIZER_LICENSE_SUSPENDED;
}
/** Active by default; legacy `pending` rows are treated as active. */
export function isOrganizerAccountActive(licenseStatus) {
    return !isOrganizerAccountLocked(licenseStatus);
}
export function organizerAccessLabel(licenseStatus) {
    return isOrganizerAccountLocked(licenseStatus) ? "locked" : "active";
}
export function organizerPhoneStatusLabel(input) {
    if (!input.mobile)
        return "missing_phone";
    if (input.phoneVerified === true)
        return "verified";
    return "incomplete_profile";
}
