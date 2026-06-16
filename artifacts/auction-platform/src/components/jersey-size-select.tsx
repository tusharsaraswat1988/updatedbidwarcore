import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JERSEY_SIZE_VALUES, type JerseySize } from "@workspace/api-base/jersey-size";

type Props = {
  value: string;
  onChange: (v: JerseySize | "") => void;
  id?: string;
  label?: string;
  triggerClassName?: string;
};

export function JerseySizeSelect({
  value,
  onChange,
  id = "jersey-size",
  label = "Jersey Size",
  triggerClassName,
}: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : (v as JerseySize))}
      >
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select size" />
        </SelectTrigger>
        <SelectContent className="dark">
          <SelectItem value="none">Not specified</SelectItem>
          {JERSEY_SIZE_VALUES.map(size => (
            <SelectItem key={size} value={size}>{size}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
