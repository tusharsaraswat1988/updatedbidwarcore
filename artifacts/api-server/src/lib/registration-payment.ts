import {
  PAYMENT_VERIFICATION_METHODS,
  type PaymentVerificationMethod,
} from "@workspace/api-base/registration-payment";

export type TournamentPaymentSettings = {
  enableRegistrationPayment: boolean;
  registrationFee: number | null;
  upiId: string | null;
  paymentVerificationMethod: string | null;
};

export function tournamentPaymentSettingsFromRow(row: {
  enableRegistrationPayment?: boolean | null;
  registrationFee?: number | null;
  upiId?: string | null;
  paymentVerificationMethod?: string | null;
}): TournamentPaymentSettings {
  return {
    enableRegistrationPayment: row.enableRegistrationPayment ?? false,
    registrationFee: row.registrationFee ?? null,
    upiId: row.upiId ?? null,
    paymentVerificationMethod: row.paymentVerificationMethod ?? null,
  };
}

export function validateTournamentPaymentSettings(settings: {
  enableRegistrationPayment?: boolean;
  registrationFee?: number | null;
  upiId?: string | null;
  paymentVerificationMethod?: string | null;
}): { ok: true } | { ok: false; error: string; field?: string } {
  if (!settings.enableRegistrationPayment) {
    return { ok: true };
  }
  const fee = settings.registrationFee;
  if (fee == null || fee <= 0) {
    return { ok: false, error: "Registration fee is required when payment collection is enabled.", field: "registrationFee" };
  }
  if (!settings.upiId?.trim()) {
    return { ok: false, error: "UPI ID is required when payment collection is enabled.", field: "upiId" };
  }
  const method = settings.paymentVerificationMethod;
  if (!method || !PAYMENT_VERIFICATION_METHODS.includes(method as PaymentVerificationMethod)) {
    return { ok: false, error: "Payment verification method is required.", field: "paymentVerificationMethod" };
  }
  return { ok: true };
}

export function validatePlayerPaymentProof(
  method: PaymentVerificationMethod,
  input: { utrNumber?: string | null; paymentScreenshotUrl?: string | null },
): { ok: true } | { ok: false; error: string; field: string } {
  const utr = input.utrNumber?.trim() ?? "";
  const screenshot = input.paymentScreenshotUrl?.trim() ?? "";

  if (method === "utr" || method === "utr_and_screenshot") {
    if (!utr) {
      return { ok: false, error: "UTR number is required.", field: "utrNumber" };
    }
    if (utr.length < 8) {
      return { ok: false, error: "UTR number must be at least 8 characters.", field: "utrNumber" };
    }
  }

  if (method === "screenshot" || method === "utr_and_screenshot") {
    if (!screenshot) {
      return { ok: false, error: "Payment screenshot is required.", field: "paymentScreenshotUrl" };
    }
    if (!screenshot.startsWith("https://")) {
      return { ok: false, error: "Payment screenshot must be a valid uploaded image URL.", field: "paymentScreenshotUrl" };
    }
  }

  return { ok: true };
}

export function resolveOrganizerPaymentStatus(
  paymentEnabled: boolean,
  markPaymentCompleted?: boolean,
): "pending" | "approved" | null {
  if (!paymentEnabled) return null;
  return markPaymentCompleted ? "approved" : "pending";
}

export function resolvePublicPaymentStatus(paymentEnabled: boolean): "pending" | null {
  return paymentEnabled ? "pending" : null;
}
