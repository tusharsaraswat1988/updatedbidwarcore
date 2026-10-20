import { registrationPaymentStatusLabel, type RegistrationPaymentStatus } from "@workspace/api-base/registration-payment";

const STATUS_CLASS: Record<RegistrationPaymentStatus, string> = {
  approved: "ops-pay-badge ops-pay-badge--approved",
  pending: "ops-pay-badge ops-pay-badge--pending",
  rejected: "ops-pay-badge ops-pay-badge--rejected",
};

export function PaymentStatusBadge({
  status,
  className = "",
  compact = false,
}: {
  status: RegistrationPaymentStatus | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!status) return null;
  const label = registrationPaymentStatusLabel(status);
  const tone = STATUS_CLASS[status];
  if (!label || !tone) return null;

  return (
    <span className={`${tone} ${className}`}>
      {compact ? label.replace("Payment ", "") : label}
    </span>
  );
}
