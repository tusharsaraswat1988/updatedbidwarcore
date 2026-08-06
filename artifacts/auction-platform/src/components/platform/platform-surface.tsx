import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PlatformSurface
 * Auction: `.org-surface-rail` / `.org-surface-card` (EPIC setup cards, hub checklist)
 * Badminton: `hubPanelClass` / `hubCardClass` (formerly form-ui)
 */

/** Standard hub card — matches shared `Card` (extracted from badminton form-ui) */
export const hubCardClass =
  "rounded-xl border bg-card border-border text-card-foreground shadow panel";

export const hubPanelClass = cn(hubCardClass, "p-5");

export function PlatformSurface({
  children,
  className,
  variant = "rail",
}: {
  children: ReactNode;
  className?: string;
  /** `rail` = organizer hub surface; `panel` = badminton hub panel */
  variant?: "rail" | "panel";
}) {
  if (variant === "panel") {
    return <div className={cn(hubPanelClass, className)}>{children}</div>;
  }

  return <div className={cn("org-surface-rail p-5", className)}>{children}</div>;
}
