import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSportOptions } from "@/hooks/use-sports";

type SportSelectProps = {
  value: string;
  onValueChange: (slug: string) => void;
  /** Keeps deactivated sports visible when editing an existing record. */
  currentSlug?: string | null;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function SportSelect({
  value,
  onValueChange,
  currentSlug,
  triggerClassName,
  contentClassName = "dark",
  placeholder = "Select sport",
  disabled,
}: SportSelectProps) {
  const { options, loading } = useSportOptions(currentSlug ?? value);

  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled || loading}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={loading ? "Loading sports…" : placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((s) => (
          <SelectItem key={s.slug} value={s.slug}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
