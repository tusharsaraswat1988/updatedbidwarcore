import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared elevated surface for tournament settings cards. */
export const settingsCardSurfaceClass =
  "border border-border/70 bg-card/90 rounded-xl shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-border/90";

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
            "px-5 py-4 border-b border-border/50 bg-white/[0.02]",
            headerClassName,
          )}
        >
          <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-foreground">
            <span className="flex items-center gap-2 min-w-0">
              {icon}
              {title}
            </span>
            {headerAction ? (
              <span className="flex flex-wrap items-center justify-end gap-2 shrink-0 ml-auto font-normal">
                {headerAction}
              </span>
            ) : null}
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs leading-relaxed text-muted-foreground mt-1">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          title ? "p-5 space-y-4" : "p-0",
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

/** Wrapper for each settings tab content. */
export function SettingsTabPanel({ children, className }: SettingsTabPanelProps) {
  return (
    <div className={cn("w-full space-y-6", className)}>
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
        "rounded-lg border border-border/50 bg-muted/20 p-3.5 sm:p-4 space-y-2.5",
        className,
      )}
    >
      {title ? <p className="text-xs font-semibold text-foreground tracking-tight">{title}</p> : null}
      {description ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

