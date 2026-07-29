/**
 * Combined alerts — attention items + optional suggestions in one panel.
 */

import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { AttentionItem, SmartSuggestion } from "@/lib/mission-control-ops";

export function MissionControlAlerts({
  attention,
  suggestions,
  dismissedAttention,
  dismissedSuggestions,
  onDismissAttention,
  onDismissSuggestion,
  onAttentionAction,
  onSuggestionAction,
}: {
  attention: AttentionItem[];
  suggestions: SmartSuggestion[];
  dismissedAttention: Set<string>;
  dismissedSuggestions: Set<string>;
  onDismissAttention: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
  onAttentionAction: (item: AttentionItem) => void;
  onSuggestionAction: (s: SmartSuggestion) => void;
}) {
  const critical = attention.filter(
    (i) => !dismissedAttention.has(i.id) && i.severity === "critical",
  );
  const warnings = attention.filter(
    (i) => !dismissedAttention.has(i.id) && i.severity === "warning",
  );
  const tips = suggestions.filter((s) => !dismissedSuggestions.has(s.id));

  if (critical.length === 0 && warnings.length === 0 && tips.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2" aria-label="Alerts">
      {critical.length > 0 ? (
        <AlertBlock
          title={`Needs action · ${critical.length}`}
          tone="critical"
          items={critical.map((item) => ({
            key: item.id,
            message: (
              <>
                <span className="font-semibold text-foreground">{item.problem}</span>
                <span className="text-muted-foreground"> · {item.courtLabel}</span>
              </>
            ),
            detail: item.reason,
            action: item.href ? (
              <Link
                href={item.href}
                onClick={() => onAttentionAction(item)}
                className={actionClass("critical")}
              >
                {item.actionLabel}
              </Link>
            ) : (
              <button type="button" onClick={() => onAttentionAction(item)} className={actionClass("critical")}>
                {item.actionLabel}
              </button>
            ),
            onDismiss: () => onDismissAttention(item.id),
          }))}
        />
      ) : null}

      {warnings.length > 0 ? (
        <AlertBlock
          title={`Warnings · ${warnings.length}`}
          tone="warning"
          items={warnings.map((item) => ({
            key: item.id,
            message: (
              <>
                <span className="font-semibold text-foreground">{item.problem}</span>
                <span className="text-muted-foreground"> · {item.courtLabel}</span>
              </>
            ),
            detail: item.reason,
            action: item.href ? (
              <Link
                href={item.href}
                onClick={() => onAttentionAction(item)}
                className={actionClass("warning")}
              >
                {item.actionLabel}
              </Link>
            ) : (
              <button type="button" onClick={() => onAttentionAction(item)} className={actionClass("warning")}>
                {item.actionLabel}
              </button>
            ),
            onDismiss: () => onDismissAttention(item.id),
          }))}
        />
      ) : null}

      {tips.length > 0 ? (
        <AlertBlock
          title="Suggestions"
          tone="tip"
          items={tips.map((s) => ({
            key: s.id,
            message: <span className="text-foreground/90">{s.message}</span>,
            action: s.href ? (
              <Link href={s.href} onClick={() => onSuggestionAction(s)} className={actionClass("tip")}>
                {s.actionLabel}
              </Link>
            ) : (
              <button type="button" onClick={() => onSuggestionAction(s)} className={actionClass("tip")}>
                {s.actionLabel}
              </button>
            ),
            onDismiss: () => onDismissSuggestion(s.id),
          }))}
        />
      ) : null}
    </section>
  );
}

function AlertBlock({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "critical" | "warning" | "tip";
  items: Array<{
    key: string;
    message: React.ReactNode;
    detail?: string;
    action: React.ReactNode;
    onDismiss: () => void;
  }>;
}) {
  const border =
    tone === "critical"
      ? "border-red-500/30 bg-red-500/5"
      : tone === "warning"
        ? "border-orange-500/25 bg-orange-500/5"
        : "border-white/10 bg-white/[0.02]";

  return (
    <div className={cn(hubCardClass, "p-3", border)}>
      <h2
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest mb-2",
          tone === "critical" ? "text-red-200/90" : tone === "warning" ? "text-orange-200/80" : "text-white/45",
        )}
      >
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{item.message}</p>
              {item.detail ? <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p> : null}
            </div>
            <div className="flex gap-2 shrink-0">
              {item.action}
              <button
                type="button"
                onClick={item.onDismiss}
                className="min-h-9 px-2 rounded-lg text-[11px] text-white/45 hover:text-white/70"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function actionClass(tone: "critical" | "warning" | "tip"): string {
  const base = "min-h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center";
  if (tone === "critical") return `${base} bg-red-500/25 hover:bg-red-500/35 text-red-50`;
  if (tone === "warning") return `${base} bg-amber-500/25 hover:bg-amber-500/35 text-amber-50`;
  return `${base} bg-sky-500/20 hover:bg-sky-500/30 text-sky-100`;
}
