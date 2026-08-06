import { cn } from "@/lib/utils";

/**
 * HistoryPanel
 * Auction: recommendations on Competition summary
 * Badminton: setup review / history callouts
 *
 * Display-only — content comes from product views.
 */
export type HistoryEntry = {
  id: string;
  label: string;
  detail?: string;
  timestamp?: string;
};

export function HistoryPanel({
  entries,
  title = "History & recommendations",
  className,
}: {
  entries: HistoryEntry[];
  title?: string;
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-md border border-border/40 bg-muted/10 px-2.5 py-2 text-xs"
          >
            <p className="font-medium text-foreground/90">{entry.label}</p>
            {entry.detail ? (
              <p className="text-muted-foreground mt-0.5">{entry.detail}</p>
            ) : null}
            {entry.timestamp ? (
              <p className="text-[10px] text-muted-foreground/80 mt-1">{entry.timestamp}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
