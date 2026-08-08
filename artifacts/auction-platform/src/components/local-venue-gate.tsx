import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { MonitorDown } from "lucide-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import {
  isLocalVenueAllowedPath,
  localVenueRedirectPath,
} from "@/lib/local-venue-routes";

function LocalVenueBlocked() {
  return (
    <div className="lovable-theme dark min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center panel">
        <div className="flex justify-center text-primary">
          <MonitorDown className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">BidWar Local — venue mode</h1>
        <p className="text-sm text-muted-foreground">
          Import a tournament in the BidWar Local desktop app, then open Auction Control from the app or connection kit.
        </p>
      </div>
    </div>
  );
}

/**
 * On BidWar Local (port 3741), block cloud/marketing routes and keep operators
 * inside tournament auction workflows only.
 */
export function LocalVenueGate({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [defaultTournamentId, setDefaultTournamentId] = useState<number | null>(null);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(!isBidWarLocalHost());

  useEffect(() => {
    if (!isBidWarLocalHost()) return;

    let cancelled = false;
    void fetch("/api/tournaments")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ id?: number }>) => {
        if (cancelled) return;
        const first = rows.find((t) => typeof t.id === "number" && t.id > 0);
        setDefaultTournamentId(first?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setDefaultTournamentId(null);
      })
      .finally(() => {
        if (!cancelled) setTournamentsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isBidWarLocalHost()) return;
    if (!tournamentsLoaded) return;
    if (isLocalVenueAllowedPath(location)) return;

    const target = localVenueRedirectPath(location, defaultTournamentId);
    if (target !== location) {
      navigate(target, { replace: true });
    }
  }, [location, navigate, defaultTournamentId, tournamentsLoaded]);

  if (!isBidWarLocalHost()) {
    return <>{children}</>;
  }

  if (!tournamentsLoaded) {
    return (
      <div className="lovable-theme dark min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLocalVenueAllowedPath(location)) {
    const path = location.split("?")[0].replace(/\/$/, "") || "/";
    if (!defaultTournamentId && path === "/") {
      return <LocalVenueBlocked />;
    }
    return (
      <div className="lovable-theme dark min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
