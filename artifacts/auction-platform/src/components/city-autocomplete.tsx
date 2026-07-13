import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchIndianCities } from "@/data/indian-cities";
import { cn } from "@/lib/utils";

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  showHint?: boolean;
  disabled?: boolean;
  /** Minimum typed characters before suggestions open. Default 2; tournament forms use 3. */
  minChars?: number;
};

export function CityAutocomplete({
  value,
  onChange,
  id,
  placeholder = "",
  className,
  showHint = true,
  disabled = false,
  minChars = 2,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => searchIndianCities(value), [value]);
  const showDropdown = !disabled && open && value.trim().length >= minChars && suggestions.length > 0;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div>
      <div ref={containerRef} className="relative">
        <Input
          id={id}
          value={value}
          onChange={e => {
            if (disabled) return;
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          disabled={disabled}
          readOnly={disabled}
        />
        {showDropdown && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.map(city => (
              <button
                key={city}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors",
                  "border-b border-border/40 last:border-0",
                  value === city && "bg-accent/50",
                )}
                onMouseDown={() => {
                  onChange(city);
                  setOpen(false);
                }}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>
      {showHint ? (
        <p className="text-xs text-muted-foreground mt-1.5">
          Type at least {minChars} letters for city suggestions
        </p>
      ) : null}
    </div>
  );
}
