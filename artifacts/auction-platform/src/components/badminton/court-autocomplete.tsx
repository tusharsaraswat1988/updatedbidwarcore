import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { inputClass, AsyncLoadingInline } from "@/components/badminton/form-ui";

export type BadmintonCourtOption = {
  id: number;
  name: string;
  shortName?: string | null;
  location?: string | null;
  status: string;
  sortOrder: number;
};

function courtLabel(court: BadmintonCourtOption): string {
  return court.shortName?.trim() || court.name;
}

function courtMatchesQuery(court: BadmintonCourtOption, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return (
    court.name.toLowerCase().includes(q) ||
    (court.shortName?.toLowerCase().includes(q) ?? false) ||
    (court.location?.toLowerCase().includes(q) ?? false)
  );
}

export function CourtAutocomplete({
  tournamentId,
  value,
  courtId,
  onChange,
  placeholder = "Search courts…",
  className,
}: {
  tournamentId: number;
  value: string;
  courtId?: number | null;
  onChange: (next: { courtNumber: string; courtId: number | null }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: courts = [], isLoading } = useQuery<BadmintonCourtOption[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, "/courts"),
    enabled: !!tournamentId,
  });

  const sorted = useMemo(
    () => [...courts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [courts],
  );

  const filtered = useMemo(
    () => sorted.filter((court) => courtMatchesQuery(court, value)),
    [sorted, value],
  );

  const showDropdown = open && (isLoading || filtered.length > 0 || value.trim().length > 0);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function selectCourt(court: BadmintonCourtOption) {
    onChange({ courtNumber: courtLabel(court), courtId: court.id });
    setOpen(false);
  }

  function handleInputChange(next: string) {
    const matched = sorted.find((court) => courtLabel(court) === next);
    onChange({ courtNumber: next, courtId: matched?.id ?? null });
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={cn(inputClass, className)}
        autoComplete="off"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
      />
      {showDropdown ? (
        <div
          className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          role="listbox"
        >
          {isLoading ? (
            <AsyncLoadingInline message="Loading courts…" />
          ) : filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">
              {value.trim() ? "No courts match your search" : "No courts configured yet"}
            </p>
          ) : (
            filtered.map((court) => {
              const label = courtLabel(court);
              const selected = courtId === court.id || value === label;
              return (
                <button
                  key={court.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/40 last:border-0",
                    selected && "bg-accent/50",
                  )}
                  onMouseDown={() => selectCourt(court)}
                >
                  <span className="block font-medium truncate">{label}</span>
                  {(court.shortName && court.shortName !== court.name) || court.location ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                      {court.shortName && court.shortName !== court.name ? (
                        <span className="truncate">{court.name}</span>
                      ) : null}
                      {court.location ? (
                        <>
                          {court.shortName && court.shortName !== court.name ? (
                            <span aria-hidden="true">·</span>
                          ) : null}
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{court.location}</span>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
