import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { SmartSuggestion } from "@/lib/mission-control-ops";

export function MissionControlSuggestions({
  suggestions,
  dismissedIds,
  onDismiss,
  onAction,
}: {
  suggestions: SmartSuggestion[];
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  onAction: (s: SmartSuggestion) => void;
}) {
  const visible = suggestions.filter((s) => !dismissedIds.has(s.id));
  if (visible.length === 0) return null;

  return (
    <section className={cn(hubCardClass, "p-3 space-y-2")} aria-label="Suggestions">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/45">
        Suggestions · optional
      </h2>
      <ul className="space-y-2">
        {visible.map((s) => (
          <li
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <p className="text-xs text-foreground/90 flex-1 min-w-0">{s.message}</p>
            <div className="flex gap-2 shrink-0">
              {s.href ? (
                <Link
                  href={s.href}
                  onClick={() => onAction(s)}
                  className="min-h-9 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 text-[11px] font-bold inline-flex items-center"
                >
                  {s.actionLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onAction(s)}
                  className="min-h-9 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 text-[11px] font-bold"
                >
                  {s.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDismiss(s.id)}
                className="min-h-9 px-2 rounded-lg text-[11px] text-white/45 hover:text-white/70"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
