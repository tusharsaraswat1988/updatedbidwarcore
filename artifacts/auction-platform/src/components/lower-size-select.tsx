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
import { LOWER_SIZE_VALUES, lowerSizeLabel, type LowerSize } from "@workspace/api-base/lower-size";

type Props = {
  value: string;
  onChange: (v: LowerSize | "") => void;
  id?: string;
  label?: string;
  hideLabel?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  marker?: "required" | "optional";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  autofilled?: boolean;
};

export function LowerSizeSelect({
  value,
  onChange,
  id = "lower-size",
  label = "Lower Size",
  hideLabel = false,
  triggerClassName,
  contentClassName,
  marker,
  disabled = false,
  className,
  style,
  autofilled = false,
}: Props) {
  const select = (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : (v as LowerSize))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={triggerClassName}>
        <SelectValue placeholder="Select size" />
      </SelectTrigger>
      <SelectContent position="popper" className={contentClassName ?? "max-h-60"}>
        <SelectItem value="none">Not specified</SelectItem>
        {LOWER_SIZE_VALUES.map(size => (
          <SelectItem key={size} value={size}>{lowerSizeLabel(size)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideLabel) {
    return className || style ? <div className={className} style={style}>{select}</div> : select;
  }

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
      {select}
    </div>
  );
}
