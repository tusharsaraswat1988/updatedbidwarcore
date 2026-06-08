import { useEffect } from "react";
import { useLocation } from "wouter";
import { useInactivityLock } from "@/hooks/use-inactivity-lock";
import { logoutOrganizer, logoutOrganizerAccount } from "@/lib/auth";

export const ORGANIZER_IDLE_TIMEOUT_MINUTES = 30;
export const ORGANIZER_IDLE_TIMEOUT_MS = ORGANIZER_IDLE_TIMEOUT_MINUTES * 60 * 1000;

type UseOrganizerInactivityLogoutOptions = {
  enabled: boolean;
  tournamentId?: number;
  /** Called after server logout, before redirect to /organizer */
  onTimeout?: () => void;
};

/**
 * Signs the organizer out after 30 minutes of inactivity (with a 60s warning).
 * Clears both the organizer account session and per-tournament access when applicable.
 */
export function useOrganizerInactivityLogout({
  enabled,
  tournamentId,
  onTimeout,
}: UseOrganizerInactivityLogoutOptions) {
  const [, navigate] = useLocation();

  const {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
  } = useInactivityLock({
    enabled,
    timeoutMs: ORGANIZER_IDLE_TIMEOUT_MS,
  });

  useEffect(() => {
    if (!locked) return;
    void (async () => {
      if (tournamentId) {
        await logoutOrganizer(tournamentId);
      }
      await logoutOrganizerAccount();
      onTimeout?.();
      navigate("/organizer");
    })();
  }, [locked, tournamentId, navigate, onTimeout]);

  return {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes: ORGANIZER_IDLE_TIMEOUT_MINUTES,
  };
}
