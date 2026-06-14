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
  required?: boolean;
};

export function PlayerGenderSelect({
  value,
  onChange,
  id = "player-gender",
  label = "Gender",
  triggerClassName,
  required,
}: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : (v as "M" | "F"))}
      >
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select gender" />
        </SelectTrigger>
        <SelectContent>
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
