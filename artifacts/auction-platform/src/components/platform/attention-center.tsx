import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlatformSurface } from "@/components/platform/platform-surface";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";

/**
 * AttentionCenter
 * Auction: TournamentInsightsSection density (partial twin)
 * Badminton: mission-control-alerts.tsx (partial twin)
 */
export type AttentionItem = {
  id: string;
  moduleId: ModuleWorkspaceId;
  moduleLabel: string;
  kind: "blocker" | "warning" | "recommendation";
  message: string;
  action?: {
    label: string;
    href?: string;
    moduleId?: ModuleWorkspaceId;
    onClick?: () => void;
  };
};

export function AttentionCenter({
  items,
  onModuleAction,
  className,
}: {
  items: AttentionItem[];
  onModuleAction?: (moduleId: ModuleWorkspaceId) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  const blockers = items.filter((i) => i.kind === "blocker");
  const warnings = items.filter((i) => i.kind === "warning");
  const recommendations = items.filter((i) => i.kind === "recommendation");

  return (
    <PlatformSurface className={cn("space-y-3", className)}>
      <div>
        <h2 className="text-base font-display font-bold">Attention</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Blockers, warnings, and recommendations by module.
        </p>
      </div>

      <AttentionGroup title="Blockers" items={blockers} tone="blocker" onModuleAction={onModuleAction} />
      <AttentionGroup title="Warnings" items={warnings} tone="warning" onModuleAction={onModuleAction} />
      <AttentionGroup
        title="Recommendations"
        items={recommendations}
        tone="recommendation"
        onModuleAction={onModuleAction}
      />
    </PlatformSurface>
  );
}

function AttentionGroup({
  title,
  items,
  tone,
  onModuleAction,
}: {
  title: string;
  items: AttentionItem[];
  tone: AttentionItem["kind"];
  onModuleAction?: (moduleId: ModuleWorkspaceId) => void;
}) {
  if (items.length === 0) return null;

  const Icon = tone === "blocker" ? AlertTriangle : tone === "warning" ? AlertTriangle : Lightbulb;
  const iconClass =
    tone === "blocker"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-500"
        : "text-primary";

  const byModule = new Map<string, AttentionItem[]>();
  for (const item of items) {
    const list = byModule.get(item.moduleLabel) ?? [];
    list.push(item);
    byModule.set(item.moduleLabel, list);
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5", iconClass)} aria-hidden />
        {title}
        <span className="text-muted-foreground/70">({items.length})</span>
      </p>
      <ul className="space-y-1.5">
        {[...byModule.entries()].map(([moduleLabel, moduleItems]) => (
          <li
            key={`${tone}-${moduleLabel}`}
            className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-foreground/90 mb-1">{moduleLabel}</p>
            <ul className="space-y-1.5">
              {moduleItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground min-w-0">
                    <Info className="w-3 h-3 shrink-0 mt-0.5 opacity-60" aria-hidden />
                    <span>{item.message}</span>
                  </div>
                  {item.action ? (
                    <AttentionAction item={item} onModuleAction={onModuleAction} />
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttentionAction({
  item,
  onModuleAction,
}: {
  item: AttentionItem;
  onModuleAction?: (moduleId: ModuleWorkspaceId) => void;
}) {
  if (!item.action) return null;

  const handleClick = () => {
    if (item.action?.onClick) {
      item.action.onClick();
      return;
    }
    if (item.action?.moduleId && onModuleAction) {
      onModuleAction(item.action.moduleId);
    }
  };

  if (item.action.href) {
    return (
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0">
        <Link href={item.action.href}>{item.action.label} →</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs shrink-0"
      onClick={handleClick}
    >
      {item.action.label} →
    </Button>
  );
}
