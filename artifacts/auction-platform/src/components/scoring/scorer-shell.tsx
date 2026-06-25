import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CricketPublicBrandMark, useCricketBidWarTheme } from "@/components/scoring/cricket-branding";

type ScorerShellProps = {
  tournamentId: number;
  title: string;
  subtitle?: string;
  statusBanner?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  backHref: string;
  children: ReactNode;
};

export function ScorerShell({
  title,
  subtitle,
  statusBanner,
  onRefresh,
  refreshing,
  backHref,
  children,
}: ScorerShellProps) {
  const { shellStyle } = useCricketBidWarTheme();

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background text-foreground relative dark"
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/15 via-background to-background pointer-events-none" />
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 relative">
        <div className="flex items-center gap-2 px-3 py-2 safe-area-inset-top max-w-lg mx-auto w-full">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Live scorer</p>
            <h1 className="text-base font-display font-bold truncate leading-tight text-foreground">{title}</h1>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
          <CricketPublicBrandMark variant="scorer-header" className="hidden sm:inline-flex" />
          {onRefresh ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          ) : null}
        </div>
        <div className="px-3 pb-2 max-w-lg mx-auto w-full sm:hidden">
          <CricketPublicBrandMark variant="scorer-bar" />
        </div>
      </header>
      {statusBanner ? <div className="max-w-lg mx-auto w-full px-3 pt-2 relative z-10">{statusBanner}</div> : null}
      <main className="flex-1 overflow-y-auto overscroll-contain max-w-lg mx-auto w-full relative z-10">
        {children}
      </main>
    </div>
  );
}
