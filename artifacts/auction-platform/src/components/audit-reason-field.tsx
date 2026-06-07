import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const AUDIT_REASON_MIN = 10;

type AuditReasonFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function AuditReasonField({
  value,
  onChange,
  label = "Reason (required)",
  placeholder = "Explain why this action is being taken (min 10 characters)…",
}: AuditReasonFieldProps) {
  const valid = value.trim().length >= AUDIT_REASON_MIN;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none text-sm"
      />
      <p className={`text-[10px] ${valid ? "text-muted-foreground" : "text-amber-400"}`}>
        {valid ? "Reason will be stored in the audit log." : `Minimum ${AUDIT_REASON_MIN} characters required.`}
      </p>
    </div>
  );
}

export function isAuditReasonValid(reason: string): boolean {
  return reason.trim().length >= AUDIT_REASON_MIN;
}
