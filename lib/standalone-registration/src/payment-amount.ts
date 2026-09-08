/**
 * Server-controlled payment amount — never trust frontend amount.
 */

export type PaymentAmountSource = {
  registrationFee: number;
  currency: string;
};

export type ResolvePaymentAmountResult =
  | { ok: true; amount: number; currency: string; source: "tournament_config" }
  | { ok: false; error: string };

/**
 * Resolve the chargeable amount exclusively from tournament configuration.
 * Any client-supplied amount is ignored (and rejected if mismatched when provided).
 */
export function resolveServerPaymentAmount(
  config: PaymentAmountSource,
  clientAmount?: unknown,
): ResolvePaymentAmountResult {
  const fee = config.registrationFee;
  if (!Number.isInteger(fee) || fee < 0) {
    return { ok: false, error: "Tournament registration fee is misconfigured." };
  }
  if (fee === 0) {
    return { ok: false, error: "No payment required for this tournament." };
  }

  if (clientAmount !== undefined && clientAmount !== null) {
    const numeric = typeof clientAmount === "number" ? clientAmount : Number(clientAmount);
    if (!Number.isFinite(numeric) || numeric !== fee) {
      return {
        ok: false,
        error: "Payment amount must be determined by the server. Client amount rejected.",
      };
    }
  }

  const currency = (config.currency || "INR").trim().toUpperCase() || "INR";
  return { ok: true, amount: fee, currency, source: "tournament_config" };
}
