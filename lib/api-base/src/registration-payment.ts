/** Registration payment verification — isolated from auction workflows. */

export const PAYMENT_COLLECTION_MODES = [
  "manual_verification",
  "cashfree",
  "razorpay",
] as const;
export type PaymentCollectionMode = (typeof PAYMENT_COLLECTION_MODES)[number];

export const PAYMENT_VERIFICATION_METHODS = [
  "utr",
  "screenshot",
  "utr_and_screenshot",
] as const;
export type PaymentVerificationMethod = (typeof PAYMENT_VERIFICATION_METHODS)[number];

export const REGISTRATION_PAYMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type RegistrationPaymentStatus = (typeof REGISTRATION_PAYMENT_STATUSES)[number];

export function buildUpiPaymentUrl(upiId: string, amount: number, payeeName?: string): string {
  const params = new URLSearchParams({
    pa: upiId.trim(),
    am: String(amount),
    cu: "INR",
  });
  if (payeeName?.trim()) {
    params.set("pn", payeeName.trim());
  }
  return `upi://pay?${params.toString()}`;
}

export function registrationPaymentStatusLabel(status: RegistrationPaymentStatus | null | undefined): string {
  switch (status) {
    case "approved":
      return "Payment Verified";
    case "pending":
      return "Verification Pending";
    case "rejected":
      return "Rejected";
    default:
      return "";
  }
}
