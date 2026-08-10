import type { QueryClient } from "@tanstack/react-query";
import {
  checkOrganizerAccountAuth,
  type OrganizerInfo,
} from "@/lib/auth";

export const ORGANIZER_ACCOUNT_AUTH_QUERY_KEY = ["organizer-account-auth"] as const;

export type OrganizerAccountTournament = {
  id: number;
  name: string;
  sport: string;
  status: string;
  licenseStatus: string;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  createdAt: string;
  auctionRulesPdfReady?: boolean;
  auctionRulesPdfBlockedReason?: string | null;
  /** Admin toggle — required for Scoring entry on cricket/badminton. */
  scoringEnabled?: boolean;
};

export type OrganizerAccountAuthState = {
  loggedIn: boolean;
  serverError?: boolean;
  organizer?: OrganizerInfo;
  tournaments?: OrganizerAccountTournament[];
};

/**
 * Canonical queryFn for the shared Organizer account auth query.
 * On serverError, preserves a previously authenticated cache entry so a
 * transient outage never silently logs the user out.
 */
export async function fetchOrganizerAccountAuthState(
  queryClient: QueryClient,
): Promise<OrganizerAccountAuthState> {
  const me = await checkOrganizerAccountAuth();
  if (me.serverError) {
    const prev = queryClient.getQueryData<OrganizerAccountAuthState>(
      ORGANIZER_ACCOUNT_AUTH_QUERY_KEY,
    );
    if (prev?.loggedIn && prev.organizer) {
      return { ...prev, serverError: true };
    }
    return { loggedIn: false, serverError: true };
  }
  return {
    loggedIn: me.loggedIn,
    serverError: false,
    organizer: me.organizer,
    tournaments: me.tournaments,
  };
}

/** After login / signup / Google / profile payloads that already include organizer. */
export function setOrganizerAccountAuthData(
  queryClient: QueryClient,
  data: { organizer: OrganizerInfo; tournaments?: OrganizerAccountTournament[] },
): void {
  queryClient.setQueryData<OrganizerAccountAuthState>(ORGANIZER_ACCOUNT_AUTH_QUERY_KEY, {
    loggedIn: true,
    serverError: false,
    organizer: data.organizer,
    tournaments: data.tournaments ?? [],
  });
}

/** Patch organizer fields while keeping tournaments / logged-in flag. */
export function patchOrganizerAccountAuthOrganizer(
  queryClient: QueryClient,
  organizer: OrganizerInfo,
): void {
  const prev = queryClient.getQueryData<OrganizerAccountAuthState>(
    ORGANIZER_ACCOUNT_AUTH_QUERY_KEY,
  );
  queryClient.setQueryData<OrganizerAccountAuthState>(ORGANIZER_ACCOUNT_AUTH_QUERY_KEY, {
    loggedIn: true,
    serverError: false,
    organizer,
    tournaments: prev?.tournaments ?? [],
  });
}

/** After logout / inactivity — every consumer becomes anonymous immediately. */
export function clearOrganizerAccountAuth(queryClient: QueryClient): void {
  queryClient.setQueryData<OrganizerAccountAuthState>(ORGANIZER_ACCOUNT_AUTH_QUERY_KEY, {
    loggedIn: false,
    serverError: false,
  });
}

/**
 * Full client-side organizer logout cleanup.
 * Clears account auth, per-tournament organizer auth, and tournament query caches
 * so a later session restore cannot reuse stale ownership.
 */
export function clearOrganizerClientState(queryClient: QueryClient): void {
  clearOrganizerAccountAuth(queryClient);
  queryClient.removeQueries({ queryKey: ["organizer-auth"] });
  queryClient.removeQueries({ queryKey: ["organizer-account-auth"] });
  queryClient.removeQueries({ queryKey: ["/api/tournaments"] });
  queryClient.removeQueries({ predicate: (q) => {
    const key = q.queryKey;
    if (!Array.isArray(key) || key.length === 0) return false;
    const head = String(key[0] ?? "");
    return (
      head.includes("tournament") ||
      head.includes("badminton") ||
      head.includes("organizer")
    );
  }});
}

/** Force a fresh `/me` via the shared query (same queryFn + serverError semantics). */
export async function syncOrganizerAccountAuth(
  queryClient: QueryClient,
): Promise<OrganizerAccountAuthState> {
  return queryClient.fetchQuery({
    queryKey: ORGANIZER_ACCOUNT_AUTH_QUERY_KEY,
    queryFn: () => fetchOrganizerAccountAuthState(queryClient),
  });
}
