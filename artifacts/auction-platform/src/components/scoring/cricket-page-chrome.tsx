import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CricketOrganizerShell,
  CricketPublicBrandMark,
  useCricketBidWarTheme,
} from "@/components/scoring/cricket-branding";
import { cricketPublicPath, scoringSchedulePath } from "@/lib/tournament-navigation";
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

/** Sticky nav for cricket organizer scoring pages (matches, schedule, fan page). */
export function CricketScoringNav({ tournamentId }: { tournamentId: number }) {
  const [location] = useLocation();
  const schedulePath = scoringSchedulePath(tournamentId);
  const fanPath = cricketPublicPath(tournamentId);
  const matchesPath = `/tournament/${tournamentId}/score`;

  const items = [
    {
      label: "Matches",
      href: matchesPath,
      active:
        location === matchesPath ||
        (location.startsWith(`${matchesPath}/`) && !location.startsWith(schedulePath)),
    },
    { label: "Schedule", href: schedulePath, active: location.startsWith(schedulePath) },
    { label: "Fan page", href: fanPath, active: location.startsWith(fanPath) },
  ] as const;

  return (
    <nav
      className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md"
      aria-label="Cricket scoring navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 space-y-2.5">
        <a
          href={`/tournament/${tournamentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Auction Hub
        </a>

        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none"
          role="tablist"
          aria-label="Cricket scoring sections"
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="tab"
              aria-selected={item.active}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border",
                item.active
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-secondary/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-accent hover:border-border",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** Organizer cricket pages with BidWar brand bar + scoring nav. */
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
      {tournamentId ? <CricketScoringNav tournamentId={tournamentId} /> : null}
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
