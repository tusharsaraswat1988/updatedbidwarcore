import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scrollable list panels inside AdminShell (tournaments, players, organisers). */
export const ADMIN_LIST_SCROLL_CLASS =
  "max-h-[calc(100dvh-22rem)] overflow-y-auto overscroll-y-contain";

/** Scroll region that fills a flex column parent (detail panels, sidebars). */
export const ADMIN_FLEX_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain";

export function AdminScrollPanel({
  children,
  className,
  flex,
}: {
  children: ReactNode;
  className?: string;
  /** Use flex-fill scroll instead of fixed max-height list scroll. */
  flex?: boolean;
}) {
  return (
    <div className={cn(flex ? ADMIN_FLEX_SCROLL_CLASS : ADMIN_LIST_SCROLL_CLASS, className)}>
      {children}
    </div>
  );
}
