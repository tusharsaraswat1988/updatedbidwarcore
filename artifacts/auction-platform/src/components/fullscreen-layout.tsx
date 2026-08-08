import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimal full-bleed chrome for scorer / LED / public surfaces — not the auction shell. */
export function FullscreenLayout({
  children,
  className,
}: {
  children: ReactNode;
  /** Extra classes; lovable navy/gold theme is always applied. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lovable-theme min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground dark overflow-x-hidden relative",
        className,
      )}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% -10%, oklch(0.42 0.15 265 / 0.45), transparent 55%), radial-gradient(ellipse at 90% 0%, oklch(0.85 0.17 88 / 0.1), transparent 50%)",
        }}
      />
      <div className="relative z-10 w-full h-full min-h-0">{children}</div>
    </div>
  );
}
