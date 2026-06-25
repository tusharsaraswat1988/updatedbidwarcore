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
    <div className="dark min-h-screen flex items-center justify-center bg-[#09090b] p-6">
      <div className="max-w-md space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <div className="flex justify-center text-amber-300">
          <MonitorDown className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-semibold text-white">BidWar Local — venue mode</h1>
        <p className="text-sm text-[#a1a1aa]">
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
      <div className="dark min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLocalVenueAllowedPath(location)) {
    const path = location.split("?")[0].replace(/\/$/, "") || "/";
    if (!defaultTournamentId && path === "/") {
      return <LocalVenueBlocked />;
    }
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
