import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const AUDIT_REASON_MIN = 10;

type AuditReasonFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  optional?: boolean;
};

export function AuditReasonField({
  value,
  onChange,
  label,
  placeholder,
  optional = false,
}: AuditReasonFieldProps) {
  const trimmed = value.trim();
  const valid = optional
    ? trimmed.length === 0 || trimmed.length >= AUDIT_REASON_MIN
    : trimmed.length >= AUDIT_REASON_MIN;

  const resolvedLabel =
    label ?? (optional ? "Reason (optional)" : "Reason (required)");
  const resolvedPlaceholder =
    placeholder ??
    (optional
      ? "Optional note for the audit log (min 10 characters if provided)…"
      : "Explain why this action is being taken (min 10 characters)…");

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{resolvedLabel}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        rows={3}
        className="resize-none text-sm"
      />
      <p className={`text-[10px] ${valid ? "text-muted-foreground" : "text-amber-400"}`}>
        {valid
          ? optional && trimmed.length === 0
            ? "Leave blank to auto-log that the operator applied this change."
            : "Reason will be stored in the audit log."
          : `Minimum ${AUDIT_REASON_MIN} characters required when provided.`}
      </p>
    </div>
  );
}

export function isAuditReasonValid(reason: string): boolean {
  return reason.trim().length >= AUDIT_REASON_MIN;
}

export function isOptionalAuditReasonValid(reason: string): boolean {
  const trimmed = reason.trim();
  return trimmed.length === 0 || trimmed.length >= AUDIT_REASON_MIN;
}
