import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const OPTIONAL_EMAIL_HINT =
  "Add your email so you don't miss important updates like schedule changes, auction timings, and tournament announcements.";

type OptionalEmailFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Pass an empty string to hide the default helper line. Errors still show. */
  hint?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
};

export function OptionalEmailField({
  id = "email",
  label = "Email Address (Optional)",
  value,
  onChange,
  error,
  hint = OPTIONAL_EMAIL_HINT,
  className,
  inputClassName,
  disabled = false,
}: OptionalEmailFieldProps) {
  const hintId = `${id}-hint`;
  const hintText = error || hint;
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputClassName}
        disabled={disabled}
        readOnly={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintText ? hintId : undefined}
      />
      {hintText ? (
        <p id={hintId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {hintText}
        </p>
      ) : null}
    </div>
  );
}
