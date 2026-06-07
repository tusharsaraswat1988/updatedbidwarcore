import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout";

type ScorerShellProps = {
  tournamentId: number;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  backHref: string;
  children: ReactNode;
};

export function ScorerShell({
  tournamentId,
  title,
  subtitle,
  onRefresh,
  refreshing,
  backHref,
  children,
}: ScorerShellProps) {
  return (
    <AppLayout tournamentId={tournamentId} noPadding>
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2 px-3 py-2.5 safe-area-inset-top">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate leading-tight">{title}</h1>
              {subtitle ? (
                <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
              ) : null}
            </div>
            {onRefresh ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={onRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            ) : null}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </div>
    </AppLayout>
  );
}
