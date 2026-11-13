import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared elevated surface for tournament settings cards. */
export const settingsCardSurfaceClass =
  "border border-border bg-card rounded-xl shadow-card transition-all duration-200";

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
            "px-5 py-4 border-b border-border bg-slate-50/70",
            headerClassName,
          )}
        >
          <CardTitle className="text-sm font-bold flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-slate-900">
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
            <CardDescription className="text-xs leading-relaxed text-slate-600 mt-1">
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
        "rounded-xl border border-border bg-slate-50/70 p-4 sm:p-5 space-y-3",
        className,
      )}
    >
      {title ? <p className="text-xs font-bold text-slate-900 tracking-tight">{title}</p> : null}
      {description ? (
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

