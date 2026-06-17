import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AppLayout } from "@/components/layout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, MonitorDown } from "lucide-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";

export function OrganizerGuard({ tournamentId, children }: { tournamentId: number; children: ReactNode }) {
  const { isLoggedIn, isLoading } = useOrganizerAuth(tournamentId);
  const [, navigate] = useLocation();

  const [location] = useLocation();
  const badmintonRoute = isBadmintonOrganizerPath(location);

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: isLoggedIn && !isLoading,
    tournamentId,
  });

  useEffect(() => {
    if (!isLoading && !isLoggedIn && tournamentId && !isBidWarLocalHost()) {
      navigate(`/organizer?next=${encodeURIComponent(location)}`);
    }
  }, [isLoggedIn, isLoading, tournamentId, navigate, location]);

  if (isLoading) {
    if (badmintonRoute) {
      return (
        <div
          className={BADMINTON_ROUTE_LOADING_CLASS}
          aria-busy="true"
          aria-label="Checking organizer access"
        />
      );
    }
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="w-5 h-5 animate-pulse" />
            <span className="text-sm">Checking access...</span>
          </div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }
  if (!isLoggedIn) {
    if (isBidWarLocalHost()) {
      return (
        <AppLayout tournamentId={tournamentId}>
          <div className="max-w-lg space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2 text-amber-300">
              <MonitorDown className="h-5 w-5" />
              <span className="font-semibold">Import required</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open the BidWar Local app on this computer, import your tournament export file, then return here to run the auction.
            </p>
          </div>
        </AppLayout>
      );
    }
    return null;
  }

  return (
    <>
      {children}
      {warningVisible && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}
    </>
  );
}
