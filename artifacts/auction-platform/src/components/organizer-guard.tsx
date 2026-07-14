import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AppLayout } from "@/components/layout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, MonitorDown } from "lucide-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import { checkOrganizerAccountAuth } from "@/lib/auth";

export function OrganizerGuard({ tournamentId, children }: { tournamentId: number; children: ReactNode }) {
  const { isLoggedIn, isLoading } = useOrganizerAuth(tournamentId);
  const [, navigate] = useLocation();

  const [location] = useLocation();
  const badmintonRoute = isBadmintonOrganizerPath(location);
  const inScoringApp =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(SCORING_APP_BASE);

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: isLoggedIn && !isLoading,
    tournamentId,
  });

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!isLoading && !isLoggedIn && tournamentId && !isBidWarLocalHost()) {
      redirectedRef.current = true;
      const returnTo = `${window.location.pathname}${window.location.search}`;

      void (async () => {
        const account = await checkOrganizerAccountAuth();

        // Logged-in organizer account but no tournament session — send to the
        // per-tournament login gate. Sending them to /organizer?next=… causes an
        // infinite loop because the portal auto-navigates back to `next`.
        if (account.loggedIn) {
          const loginPath = `/tournament/${tournamentId}/login?next=${encodeURIComponent(returnTo)}`;
          if (inScoringApp) {
            window.location.href = loginPath;
            return;
          }
          navigate(loginPath);
          return;
        }

        // No organizer account — always use regular signup/login (incl. scoring-app).
        const organizerPath = `/organizer?next=${encodeURIComponent(returnTo)}`;
        if (inScoringApp) {
          window.location.href = organizerPath;
          return;
        }
        navigate(organizerPath);
      })();
    }
  }, [isLoggedIn, isLoading, tournamentId, navigate, inScoringApp]);

  if (isLoading) {
    if (badmintonRoute || inScoringApp) {
      return (
        <div
          className={badmintonRoute ? BADMINTON_ROUTE_LOADING_CLASS : "min-h-screen bg-background"}
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
      if (inScoringApp) {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="max-w-lg space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
              <div className="flex items-center gap-2 text-amber-300">
                <MonitorDown className="h-5 w-5" />
                <span className="font-semibold">Import required</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Open the BidWar Local app on this computer, import your tournament export file, then return here to score matches.
              </p>
            </div>
          </div>
        );
      }
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
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
