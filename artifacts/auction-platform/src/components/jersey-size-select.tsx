import type { CSSProperties } from "react";
import { Label } from "@/components/ui/label";
import { RegAutofillMark } from "@/components/registration/registration-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JERSEY_SIZE_VALUES, jerseySizeLabel, type JerseySize } from "@workspace/api-base/jersey-size";

type Props = {
  value: string;
  onChange: (v: JerseySize | "") => void;
  id?: string;
  label?: string;
  triggerClassName?: string;
  contentClassName?: string;
  marker?: "required" | "optional";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  autofilled?: boolean;
};

export function JerseySizeSelect({
  value,
  onChange,
  id = "jersey-size",
  label = "Jersey Size",
  triggerClassName,
  contentClassName,
  marker,
  disabled = false,
  className,
  style,
  autofilled = false,
}: Props) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"} style={style}>
      <div className="reg-label-row">
        <Label htmlFor={id}>{label}</Label>
        <span className="reg-label-meta">
          {autofilled ? <RegAutofillMark /> : null}
          {marker === "required" ? (
            <span className="reg-badge reg-badge--req">Required</span>
          ) : marker === "optional" ? (
            <span className="reg-badge reg-badge--opt">Optional</span>
          ) : null}
        </span>
      </div>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : (v as JerseySize))}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select size" />
        </SelectTrigger>
        <SelectContent position="popper" className={contentClassName ?? "max-h-60"}>
          <SelectItem value="none">Not specified</SelectItem>
          {JERSEY_SIZE_VALUES.map(size => (
            <SelectItem key={size} value={size}>{jerseySizeLabel(size)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
