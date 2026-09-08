import type { SrPaymentStatus, SrRegistrationStatus } from "./statuses";

/**
 * Allowed registration state transitions for the standalone module.
 */
const REGISTRATION_TRANSITIONS: Record<SrRegistrationStatus, readonly SrRegistrationStatus[]> = {
  DRAFT: ["SUBMITTED", "PAYMENT_PENDING", "CANCELLED"],
  SUBMITTED: ["PAYMENT_PENDING", "CONFIRMED", "CANCELLED"],
  PAYMENT_PENDING: ["PAYMENT_INITIATED", "CANCELLED"],
  PAYMENT_INITIATED: ["PAID", "PAYMENT_FAILED", "PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "PAYMENT_INITIATED", "CANCELLED"],
  PAID: ["CONFIRMED"],
  CONFIRMED: [],
  CANCELLED: [],
};

const PAYMENT_TRANSITIONS: Record<SrPaymentStatus, readonly SrPaymentStatus[]> = {
  PENDING: ["PAYMENT_INITIATED", "CANCELLED"],
  PAYMENT_INITIATED: ["PAID", "FAILED", "CANCELLED"],
  FAILED: ["PENDING", "PAYMENT_INITIATED", "CANCELLED"],
  PAID: ["REFUNDED"],
  CANCELLED: ["PENDING"],
  REFUNDED: [],
};

export function canTransitionRegistration(
  from: SrRegistrationStatus,
  to: SrRegistrationStatus,
): boolean {
  if (from === to) return true;
  return REGISTRATION_TRANSITIONS[from].includes(to);
}

export function canTransitionPayment(from: SrPaymentStatus, to: SrPaymentStatus): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertRegistrationTransition(
  from: SrRegistrationStatus,
  to: SrRegistrationStatus,
): { ok: true } | { ok: false; error: string } {
  if (!canTransitionRegistration(from, to)) {
    return { ok: false, error: `Invalid registration status transition: ${from} → ${to}` };
  }
  return { ok: true };
}

export function assertPaymentTransition(
  from: SrPaymentStatus,
  to: SrPaymentStatus,
): { ok: true } | { ok: false; error: string } {
  if (!canTransitionPayment(from, to)) {
    return { ok: false, error: `Invalid payment status transition: ${from} → ${to}` };
  }
  return { ok: true };
}

/** Already-paid registrations must not be charged again. */
export function canInitiatePaymentForRegistration(status: SrRegistrationStatus): boolean {
  return (
    status === "PAYMENT_PENDING" ||
    status === "PAYMENT_FAILED" ||
    status === "PAYMENT_INITIATED" ||
    status === "SUBMITTED"
  );
}
