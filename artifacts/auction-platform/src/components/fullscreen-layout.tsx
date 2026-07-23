import type { ReactNode } from "react";

/** Minimal full-bleed chrome for scorer / LED / public surfaces — not the auction shell. */
export function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground dark overflow-x-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/30 via-background to-background pointer-events-none" />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
