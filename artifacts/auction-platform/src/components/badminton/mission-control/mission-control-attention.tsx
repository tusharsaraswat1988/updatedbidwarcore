/**
 * Needs Attention — surfaces operational problems with one primary action each.
 */

import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { AttentionItem } from "@/lib/mission-control-ops";

export function MissionControlAttentionPanel({
  items,
  dismissedIds,
  onDismiss,
  onAction,
}: {
  items: AttentionItem[];
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  onAction: (item: AttentionItem) => void;
}) {
  const visible = items.filter((i) => !dismissedIds.has(i.id));
  if (visible.length === 0) return null;

  return (
    <section
      className={cn(hubCardClass, "p-3 sm:p-4 border-orange-500/30 bg-orange-500/5")}
      aria-label="Needs attention"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-orange-200/90">
          Needs attention · {visible.length}
        </h2>
      </div>
      <ul className="space-y-2">
        {visible.slice(0, 6).map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3",
              item.severity === "critical"
                ? "border-red-500/35 bg-red-500/10"
                : "border-orange-500/25 bg-orange-500/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {item.problem}
                <span className="text-muted-foreground font-medium"> · {item.courtLabel}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => onAction(item)}
                  className="min-h-10 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-50 text-xs font-bold inline-flex items-center"
                >
                  {item.actionLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onAction(item)}
                  className="min-h-10 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-50 text-xs font-bold"
                >
                  {item.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-xs font-semibold"
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
