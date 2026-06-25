import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CricketOrganizerShell,
  CricketPublicBrandMark,
  useCricketBidWarTheme,
} from "@/components/scoring/cricket-branding";

/** Standard cricket hub card — matches auction `Card`. */
export const cricketCardClass =
  "rounded-xl border bg-card border-border text-card-foreground shadow";

export const cricketPanelClass = cn(cricketCardClass, "p-4 sm:p-5");

export const cricketEyebrowClass =
  "text-xs font-bold uppercase tracking-[0.2em] text-primary";

export const cricketSectionTitleClass =
  "text-sm font-semibold uppercase tracking-wider text-muted-foreground";

export const cricketTableWrapClass = "overflow-x-auto rounded-xl border border-border";

export const cricketTableHeadRowClass =
  "border-b border-border text-left text-muted-foreground";

export function CricketFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-colors",
        active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/25",
      )}
    >
      {children}
    </button>
  );
}

/** Public cricket pages — auction radial shell + optional BidWar footer credit. */
export function CricketPublicShell({
  children,
  className,
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  const { shellStyle } = useCricketBidWarTheme();

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground antialiased relative flex flex-col dark",
        className,
      )}
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
      <div className={cn("relative z-10 flex-1 w-full mx-auto px-4 py-6 sm:py-8", maxWidth)}>
        {children}
      </div>
      <footer className="relative z-10 flex justify-center pb-6 pt-2">
        <CricketPublicBrandMark variant="footer" />
      </footer>
    </div>
  );
}

/** Organizer cricket pages with BidWar brand bar + optional tournament hub link. */
export function CricketOrganizerPageShell({
  children,
  className,
  tournamentId,
}: {
  children: ReactNode;
  className?: string;
  tournamentId?: number;
}) {
  return (
    <CricketOrganizerShell className={className} tournamentId={tournamentId}>
      {children}
    </CricketOrganizerShell>
  );
}

export function CricketPublicPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-3 mb-6 sm:mb-8 border-b border-border pb-6">
      {eyebrow ? <p className={cricketEyebrowClass}>{eyebrow}</p> : null}
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
      {actions}
    </header>
  );
}

export function CricketLoadingShell({ lines = 2 }: { lines?: number }) {
  return (
    <CricketPublicShell>
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 bg-muted" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted" />
        ))}
      </div>
    </CricketPublicShell>
  );
}

export function CricketEmptyState({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <CricketPublicShell>
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-muted-foreground text-center">
        <p>{message}</p>
        {children}
      </div>
    </CricketPublicShell>
  );
}
