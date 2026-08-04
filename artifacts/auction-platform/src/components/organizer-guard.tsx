import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { useOrganizerAuth, useOrganizerAccountAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { AccessStateView } from "@/components/access-state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, MonitorDown } from "lucide-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import {
  checkOrganizerAuth,
  logoutOrganizerAccount,
} from "@/lib/auth";
import {
  clearOrganizerClientState,
  syncOrganizerAccountAuth,
} from "@/lib/organizer-account-auth-cache";
import { useQueryClient } from "@tanstack/react-query";

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

function scoringLoginUrl(returnTo: string): string {
  return `${SCORING_APP_BASE}/login?next=${encodeURIComponent(returnTo)}`;
}

export function OrganizerGuard({ tournamentId, children }: { tournamentId: number; children: ReactNode }) {
  const { isLoggedIn, isLoading, refetch } = useOrganizerAuth(tournamentId);
  const { isLoading: accountLoading } = useOrganizerAccountAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [location] = useLocation();
  const badmintonRoute = isBadmintonOrganizerPath(location);
  const inScoringApp =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(SCORING_APP_BASE);

  const [accessDenied, setAccessDenied] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);

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
  const authSettled = !isLoading && !accountLoading;

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!authSettled || isLoggedIn || !tournamentId || isBidWarLocalHost()) return;

    redirectedRef.current = true;
    setResolvingAccount(true);
    const returnTo = `${window.location.pathname}${window.location.search}`;

    void (async () => {
      try {
        // Refresh shared account query (session restore / claim) then retry tournament auth.
        const account = await syncOrganizerAccountAuth(queryClient);

        if (account.serverError) {
          setSessionExpired(true);
          setResolvingAccount(false);
          return;
        }

        if (account.loggedIn) {
          const ok = await checkOrganizerAuth(tournamentId);
          if (ok) {
            await refetch();
            setResolvingAccount(false);
            redirectedRef.current = false;
            return;
          }

          // Account present but not owner after claim — scoring shows 403.
          // Auction keeps the per-tournament password / operator gate.
          if (inScoringApp) {
            setAccessDenied(true);
            setResolvingAccount(false);
            return;
          }

          const loginPath = `/tournament/${tournamentId}/login?next=${encodeURIComponent(returnTo)}`;
          navigate(loginPath);
          return;
        }

        // No organizer account — scoring-local login (never Auction homepage).
        if (inScoringApp) {
          window.location.href = scoringLoginUrl(returnTo);
          return;
        }
        navigate(`/organizer?next=${encodeURIComponent(returnTo)}`);
      } catch {
        setSessionExpired(true);
        setResolvingAccount(false);
      }
    })();
  }, [authSettled, isLoggedIn, tournamentId, navigate, inScoringApp, refetch, queryClient]);

  if (sessionExpired) {
    return (
      <AccessStateView
        code={401}
        actionLabel="Sign in again"
        onAction={() => {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          if (inScoringApp) {
            window.location.href = scoringLoginUrl(returnTo);
            return;
          }
          navigate(`/organizer?next=${encodeURIComponent(returnTo)}`);
        }}
      />
    );
  }

  if (accessDenied) {
    return (
      <AccessStateView
        code={403}
        actionLabel="Sign in with another account"
        onAction={() => {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          void (async () => {
            await logoutOrganizerAccount();
            clearOrganizerClientState(queryClient);
            window.location.href = scoringLoginUrl(returnTo);
          })();
        }}
      />
    );
  }

  if (!authSettled || resolvingAccount) {
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
