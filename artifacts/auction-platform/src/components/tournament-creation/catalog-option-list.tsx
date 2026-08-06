import type { ReactNode } from "react";
import { CatalogRegistry, type CatalogEntryBase } from "@workspace/platform-core/catalog";
import { cn } from "@/lib/utils";

type CatalogOptionListProps<T extends CatalogEntryBase> = {
  entries: T[];
  value: string;
  onSelect: (entry: T) => void;
  emptyLabel?: string;
};

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function CatalogOptionList<T extends CatalogEntryBase>({
  entries,
  value,
  onSelect,
  emptyLabel = "No options for this selection.",
}: CatalogOptionListProps<T>) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const grouped = CatalogRegistry.groupByRecommendation(entries);

  const renderCard = (entry: T) => {
    const selected = entry.id === value;
    return (
      <button
        key={`${entry.id}@${entry.version}`}
        type="button"
        onClick={() => onSelect(entry)}
        className={cn(
          "w-full text-left rounded-xl border px-4 py-3.5 min-h-[56px] transition-colors",
          selected
            ? "border-primary bg-primary/10"
            : "border-border/60 bg-card/40 hover:border-primary/40",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug">{entry.displayName}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {entry.description}
            </p>
          </div>
          {entry.recommendation === "recommended" ? (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Recommended
            </span>
          ) : entry.status === "beta" ? (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-400">
              Beta
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <Section label="Auto Suggested">{grouped.autoSuggested.map(renderCard)}</Section>
      <Section label="Recommended">{grouped.recommended.map(renderCard)}</Section>
      <Section label="Advanced">{grouped.advanced.map(renderCard)}</Section>
    </div>
  );
}
