/**
 * Display & Broadcast — soft redirect into Live Control (Mission Control screens).
 * Route: /tournament/:id/badminton/broadcast
 *
 * Legacy URL kept for bookmarks; content lives under Live Control → Mission Control.
 */

import { useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { badmintonIaLiveControlPath } from "@/lib/badminton-routes";
import { BtnPrimary, hubPanelClass } from "@/components/badminton/page-chrome";
import { cn } from "@/lib/utils";

export default function BadmintonBroadcastPage() {
  const [, params] = useRoute("/tournament/:id/badminton/broadcast");
  const tournamentId = parseInt(params?.id ?? "0", 10);
  const [, navigate] = useLocation();
  const dest =
    tournamentId > 0
      ? badmintonIaLiveControlPath(tournamentId, "broadcast")
      : "/";

  useEffect(() => {
    if (tournamentId <= 0) return;
    const timer = window.setTimeout(() => {
      navigate(dest, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [dest, navigate, tournamentId]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center px-6">
      <div
        className={cn(
          hubPanelClass,
          "max-w-lg w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 !p-5 border-primary/20 bg-primary/5",
        )}
        role="status"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Opening Live Control</p>
          <p className="text-sm text-muted-foreground mt-1">
            Displays and broadcast tools live under Live Control → Mission Control.
          </p>
        </div>
        <Link href={dest}>
          <BtnPrimary className="w-full sm:w-auto shrink-0">
            Open Live Control
            <ArrowRight className="w-4 h-4" aria-hidden />
          </BtnPrimary>
        </Link>
      </div>
    </div>
  );
}
