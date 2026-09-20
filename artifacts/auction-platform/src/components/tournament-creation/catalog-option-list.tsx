import { type CatalogEntryBase } from "@workspace/platform-core/catalog";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

function getSportEmoji(id: string) {
  const s = (id || "").toLowerCase();
  if (s.includes("cricket")) return "🏏";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("football") || s.includes("soccer")) return "⚽";
  if (s.includes("tennis") || s.includes("pickleball")) return "🎾";
  if (s.includes("kabaddi")) return "🤼";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("basketball")) return "🏀";
  return "🏆";
}

type CatalogOptionListProps<T extends CatalogEntryBase> = {
  entries: T[];
  value: string;
  onSelect: (entry: T) => void;
  emptyLabel?: string;
};

/** Flat option cards with modern, accessible, and soothing UI */
export function CatalogOptionList<T extends CatalogEntryBase>({
  entries,
  value,
  onSelect,
  emptyLabel = "No options for this selection.",
}: CatalogOptionListProps<T>) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  const ordered = [...entries].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  return (
    <div className="grid grid-cols-1 gap-3">
      {ordered.map((entry) => {
        const selected = entry.id === value;
        const emoji = getSportEmoji(entry.id);
        return (
          <button
            key={`${entry.id}@${entry.version}`}
            type="button"
            onClick={() => onSelect(entry)}
            className={cn(
              "group relative flex items-center gap-3.5 w-full text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none",
              selected
                ? "border-sky-500/50 bg-sky-500/[0.08] shadow-md shadow-sky-500/5 ring-1 ring-sky-500/30"
                : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50",
            )}
          >
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all text-2xl",
                selected
                  ? "bg-sky-500/20 border-sky-500/40 shadow-inner scale-105"
                  : "bg-slate-800/80 border-slate-700/60 group-hover:border-slate-600 group-hover:scale-105",
              )}
            >
              {emoji}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "font-semibold text-sm sm:text-base tracking-tight leading-snug",
                    selected ? "text-sky-300" : "text-slate-200 group-hover:text-slate-100",
                  )}
                >
                  {entry.displayName}
                </p>
                {selected && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Selected
                  </span>
                )}
              </div>
              {entry.description ? (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {entry.description}
                </p>
              ) : null}
            </div>

            <div className="shrink-0">
              {selected ? (
                <CheckCircle2 className="w-5 h-5 text-sky-400" />
              ) : (
                <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
