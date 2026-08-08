import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared elevated surface for tournament settings — lovable panel tokens only. */
export const settingsCardSurfaceClass =
  "panel border-border/80 shadow-md ring-1 ring-inset ring-white/[0.06]";

type SettingsCardProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

export function SettingsCard({
  title,
  description,
  icon,
  headerAction,
  children,
  className,
  contentClassName,
  headerClassName,
}: SettingsCardProps) {
  return (
    <Card className={cn(settingsCardSurfaceClass, className)}>
      {title ? (
        <CardHeader
          className={cn(
            "pb-3 pt-4 px-4 sm:px-5 border-b border-border/50 bg-white/[0.03]",
            headerClassName,
          )}
        >
          <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="flex items-center gap-2 min-w-0">
              {icon}
              {title}
            </span>
            {headerAction ? (
              <span className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 ml-auto">
                {headerAction}
              </span>
            ) : null}
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs leading-relaxed text-muted-foreground/90">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          title ? "px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 bg-stage/50" : "p-0",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

type SettingsTabPanelProps = {
  children: ReactNode;
  className?: string;
};

/** Outer shell for each settings tab — separates tab content from page background. */
export function SettingsTabPanel({ children, className }: SettingsTabPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-stage p-4 sm:p-5 shadow-lg ring-1 ring-white/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type SettingsInsetBlockProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
};

/** Nested block inside a settings card for grouped controls. */
export function SettingsInsetBlock({
  children,
  className,
  title,
  description,
}: SettingsInsetBlockProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-panel-2 p-3 sm:p-4",
        className,
      )}
    >
      {title ? <p className="text-xs font-medium text-foreground mb-1">{title}</p> : null}
      {description ? (
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
