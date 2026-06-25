import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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
  title,
  subtitle,
  onRefresh,
  refreshing,
  backHref,
  children,
}: ScorerShellProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0a0f1a] text-foreground">
      <header className="sticky top-0 z-20 border-b border-amber-500/20 bg-gradient-to-b from-[#121a2e] to-[#0a0f1a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0f1a]/90">
        <div className="flex items-center gap-2 px-3 py-2.5 safe-area-inset-top max-w-lg mx-auto w-full">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-white hover:bg-white/10" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">Live scorer</p>
            <h1 className="text-base font-bold truncate leading-tight text-white">{title}</h1>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
          {onRefresh ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-white hover:bg-white/10"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          ) : null}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto overscroll-contain max-w-lg mx-auto w-full">{children}</main>
    </div>
  );
}
