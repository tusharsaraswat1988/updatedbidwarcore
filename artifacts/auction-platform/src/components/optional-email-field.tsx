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
  className?: string;
  inputClassName?: string;
};

export function OptionalEmailField({
  id = "email",
  label = "Email Address (Optional)",
  value,
  onChange,
  error,
  className,
  inputClassName,
}: OptionalEmailFieldProps) {
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
        placeholder="you@example.com"
        className={inputClassName}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{OPTIONAL_EMAIL_HINT}</p>
      )}
    </div>
  );
}
