import { type CatalogEntryBase } from "@workspace/platform-core/catalog";
import { cn } from "@/lib/utils";

type CatalogOptionListProps<T extends CatalogEntryBase> = {
  entries: T[];
  value: string;
  onSelect: (entry: T) => void;
  emptyLabel?: string;
};

/** Flat option cards — no Auto Suggested / Recommended / Advanced grouping. */
export function CatalogOptionList<T extends CatalogEntryBase>({
  entries,
  value,
  onSelect,
  emptyLabel = "No options for this selection.",
}: CatalogOptionListProps<T>) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const ordered = [...entries].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  return (
    <div className="space-y-2">
      {ordered.map((entry) => {
        const selected = entry.id === value;
        return (
          <button
            key={`${entry.id}@${entry.version}`}
            type="button"
            onClick={() => onSelect(entry)}
            className={cn(
              "w-full text-left rounded-xl border px-4 py-3.5 min-h-[56px] transition-colors",
              selected
                ? "border-primary bg-primary/15 shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.06)]"
                : "border-border bg-rail hover:border-primary/45 hover:bg-[color-mix(in_oklab,var(--rail)_90%,white)]",
            )}
          >
            <p className="font-semibold text-sm leading-snug">{entry.displayName}</p>
            {entry.description ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {entry.description}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
