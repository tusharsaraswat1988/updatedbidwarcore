import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimal full-bleed chrome for scorer / LED / public surfaces — not the auction shell. */
export function FullscreenLayout({
  children,
  className,
  backdrop = true,
}: {
  children: ReactNode;
  /** Extra classes; lovable navy/gold theme is always applied. */
  className?: string;
  /** Decorative stage glow. Registration uses a flat surface instead. */
  backdrop?: boolean;
}) {
  const hasCustomHeight = className?.includes("h-") || className?.includes("fixed") || className?.includes("absolute");

  return (
    <div
      className={cn(
        "lovable-theme bg-background text-foreground selection:bg-primary selection:text-primary-foreground dark overflow-x-hidden relative",
        !hasCustomHeight && "min-h-screen",
        className,
      )}
    >
      {backdrop ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% -10%, oklch(0.42 0.15 265 / 0.45), transparent 55%), radial-gradient(ellipse at 90% 0%, oklch(0.85 0.17 88 / 0.1), transparent 50%)",
          }}
        />
      ) : null}
      <div className="relative z-10 w-full h-full min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
