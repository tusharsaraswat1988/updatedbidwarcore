import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: string;
  onChange: (v: "M" | "F" | "") => void;
  id?: string;
  label?: string;
  triggerClassName?: string;
  contentClassName?: string;
  required?: boolean;
  marker?: "required" | "optional";
  disabled?: boolean;
};

export function PlayerGenderSelect({
  value,
  onChange,
  id = "player-gender",
  label = "Gender",
  triggerClassName,
  contentClassName,
  required,
  marker,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="reg-label-row">
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        {marker === "required" ? (
          <span className="reg-badge reg-badge--req">Required</span>
        ) : marker === "optional" ? (
          <span className="reg-badge reg-badge--opt">Optional</span>
        ) : null}
      </div>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : (v as "M" | "F"))}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select gender" />
        </SelectTrigger>
        <SelectContent position="popper" className={contentClassName ?? "max-h-60 w-[var(--radix-select-trigger-width)]"}>
          <SelectItem value="none">Not specified</SelectItem>
          <SelectItem value="M">Male</SelectItem>
          <SelectItem value="F">Female</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function formatPlayerGender(code: string | null | undefined): string {
  if (code === "M") return "Male";
  if (code === "F") return "Female";
  return "";
}
