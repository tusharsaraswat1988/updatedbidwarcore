import { memo, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AcademySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const AcademySearch = memo(function AcademySearch({ value, onChange }: AcademySearchProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <div className="relative max-w-xl">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={handleChange}
        placeholder="Search by title, episode, category, or description…"
        className="pl-9 h-11"
        aria-label="Search academy lessons"
      />
    </div>
  );
});
