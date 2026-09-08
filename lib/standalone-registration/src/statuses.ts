/**
 * Explicit registration + payment state machines for the standalone module.
 * Isolated from BidWar `players.registration_payment_status` (pending|approved|rejected).
 */

export const SR_REGISTRATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PAYMENT_PENDING",
  "PAYMENT_INITIATED",
  "PAYMENT_FAILED",
  "PAID",
  "CONFIRMED",
  "CANCELLED",
] as const;

export type SrRegistrationStatus = (typeof SR_REGISTRATION_STATUSES)[number];

export const SR_PAYMENT_STATUSES = [
  "PENDING",
  "PAYMENT_INITIATED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type SrPaymentStatus = (typeof SR_PAYMENT_STATUSES)[number];

export function isSrRegistrationStatus(value: unknown): value is SrRegistrationStatus {
  return (
    typeof value === "string" &&
    (SR_REGISTRATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isSrPaymentStatus(value: unknown): value is SrPaymentStatus {
  return (
    typeof value === "string" && (SR_PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

/** Initial status after a valid public submission (fee may still be zero). */
export function initialRegistrationStatus(registrationFee: number): SrRegistrationStatus {
  if (registrationFee > 0) return "PAYMENT_PENDING";
  return "SUBMITTED";
}
