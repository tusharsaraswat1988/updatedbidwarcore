/**
 * Sticky navigation for all badminton organizer hub pages —
 * contextual back control + quick jumps to every main section.
 */

import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BADMINTON_HUB_NAV,
  getBadmintonHubBackNav,
} from "@/lib/badminton-routes";

export function BadmintonHubNav({ tournamentId }: { tournamentId: number }) {
  const [location] = useLocation();
  const back = getBadmintonHubBackNav(tournamentId, location);

  return (
    <nav
      className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md"
      aria-label="Badminton tournament navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 space-y-2.5">
        {back.kind === "history" ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {back.label}
          </button>
        ) : (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {back.label}
          </Link>
        )}

        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none"
          role="tablist"
          aria-label="Badminton sections"
        >
          {BADMINTON_HUB_NAV.map((item) => {
            const active = item.isActive(location, tournamentId);
            return (
              <Link
                key={item.id}
                href={item.href(tournamentId)}
                role="tab"
                aria-selected={active}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border",
                  active
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-secondary/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-accent hover:border-border",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
