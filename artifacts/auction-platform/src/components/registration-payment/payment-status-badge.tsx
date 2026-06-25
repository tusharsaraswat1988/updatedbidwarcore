import { registrationPaymentStatusLabel, type RegistrationPaymentStatus } from "@workspace/api-base/registration-payment";

const STATUS_STYLES: Record<RegistrationPaymentStatus, { emoji: string; className: string }> = {
  approved: { emoji: "🟢", className: "text-green-400" },
  pending: { emoji: "🟡", className: "text-amber-400" },
  rejected: { emoji: "🔴", className: "text-red-400" },
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
  const style = STATUS_STYLES[status];
  if (!label) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${style.className} ${className}`}>
      <span aria-hidden>{style.emoji}</span>
      {compact ? label.replace("Payment ", "") : label}
    </span>
  );
}
