import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { useInactivityLock, IDLE_WARNING_MS } from "@/hooks/use-inactivity-lock";
import { logoutOrganizer, logoutOrganizerAccount } from "@/lib/auth";
import { clearOrganizerClientState } from "@/lib/organizer-account-auth-cache";

export const ORGANIZER_IDLE_TIMEOUT_MINUTES = 30;
export const ORGANIZER_IDLE_TIMEOUT_MS = ORGANIZER_IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const ORGANIZER_IDLE_WARNING_MS = IDLE_WARNING_MS;

type UseOrganizerInactivityLogoutOptions = {
  enabled: boolean;
  tournamentId?: number;
  /** Called after server logout, before redirect */
  onTimeout?: () => void;
};

function postLogoutDestination(returnTo: string): string {
  const inScoringApp =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(SCORING_APP_BASE);
  if (inScoringApp) {
    return returnTo.startsWith("/")
      ? `${SCORING_APP_BASE}/login?next=${encodeURIComponent(returnTo)}`
      : `${SCORING_APP_BASE}/login`;
  }
  return returnTo.startsWith("/")
    ? `/organizer?next=${encodeURIComponent(returnTo)}`
    : "/organizer";
}

/**
 * Signs the organizer out after 30 minutes of inactivity (with a 90s warning).
 * Clears both the organizer account session and per-tournament access when applicable.
 */
export function useOrganizerInactivityLogout({
  enabled,
  tournamentId,
  onTimeout,
}: UseOrganizerInactivityLogoutOptions) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
  } = useInactivityLock({
    enabled,
    timeoutMs: ORGANIZER_IDLE_TIMEOUT_MS,
    warningMs: ORGANIZER_IDLE_WARNING_MS,
  });

  useEffect(() => {
    if (!locked) return;
    void (async () => {
      const returnTo =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "";
      if (tournamentId) {
        await logoutOrganizer(tournamentId);
      }
      await logoutOrganizerAccount();
      clearOrganizerClientState(queryClient);
      onTimeout?.();
      const dest = postLogoutDestination(returnTo);
      if (dest.startsWith(SCORING_APP_BASE) || dest.startsWith("/organizer")) {
        window.location.href = dest;
        return;
      }
      navigate(dest);
    })();
  }, [locked, tournamentId, navigate, onTimeout, queryClient]);

  return {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes: ORGANIZER_IDLE_TIMEOUT_MINUTES,
    warningSeconds: Math.round(ORGANIZER_IDLE_WARNING_MS / 1000),
  };
}
