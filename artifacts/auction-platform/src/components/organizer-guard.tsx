import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, MonitorDown } from "lucide-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import { checkOrganizerAccountAuth } from "@/lib/auth";

function OrganizerAccessLoading({ badmintonRoute }: { badmintonRoute: boolean }) {
  if (badmintonRoute) {
    return (
      <div
        className={BADMINTON_ROUTE_LOADING_CLASS}
        aria-busy="true"
        aria-label="Checking organizer access"
      />
    );
  }
  // Do not import AppLayout here — it pulls the full auction organizer shell
  // into every scoring-app / badminton cold load.
  return (
    <div className="min-h-screen bg-background p-8" aria-busy="true" aria-label="Checking organizer access">
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Checking access...</span>
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

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
    return <OrganizerAccessLoading badmintonRoute={badmintonRoute || inScoringApp} />;
  }
  if (!isLoggedIn) {
    if (isBidWarLocalHost()) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2 text-amber-300">
              <MonitorDown className="h-5 w-5" />
              <span className="font-semibold">Import required</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {inScoringApp
                ? "Open the BidWar Local app on this computer, import your tournament export file, then return here to score matches."
                : "Open the BidWar Local app on this computer, import your tournament export file, then return here to run the auction."}
            </p>
          </div>
        </div>
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
