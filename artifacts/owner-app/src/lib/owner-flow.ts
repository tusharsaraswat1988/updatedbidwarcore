import { ownerDashboardAppPath } from "@workspace/api-base/owner-urls";

/** Unified onboarding state machine — mobile → team pick → access code → dashboard. */

export type OwnerOnboardingEntry = {
  tournamentId: number;
  tournamentName: string;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string | null;
  licenseStatus: string;
  tournamentStatus: string;
  auctionStatus: string | null;
  requiresAccessCode: boolean;
};

export type OwnerDeepLink = {
  tournamentId: number;
  teamId: number;
};

export const ONBOARDING_ENTRIES_KEY = "owner_onboarding_entries";

export type OwnerFlowStep = "mobile" | "team-pick" | "access-code" | "dashboard";

export type MobileSubmitResult =
  | { kind: "route"; path: string }
  | { kind: "teams" }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function parseOwnerDeepLink(search: string): OwnerDeepLink | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tournamentId = parseInt(params.get("tournamentId") ?? "", 10);
  const teamId = parseInt(params.get("teamId") ?? "", 10);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(teamId)) return null;
  return { tournamentId, teamId };
}

export function saveOnboardingEntries(entries: OwnerOnboardingEntry[]) {
  sessionStorage.setItem(ONBOARDING_ENTRIES_KEY, JSON.stringify(entries));
}

export function loadOnboardingEntries(): OwnerOnboardingEntry[] {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_ENTRIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OwnerOnboardingEntry[];
  } catch {
    return [];
  }
}

export function clearOnboardingEntries() {
  sessionStorage.removeItem(ONBOARDING_ENTRIES_KEY);
}

export async function lookupOwnerTeams(mobile: string): Promise<OwnerOnboardingEntry[]> {
  const res = await fetch("/api/owner/onboarding/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: mobile.trim() }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Lookup failed. Please try again.");
  }

  const data = (await res.json()) as { entries?: OwnerOnboardingEntry[] };
  return data.entries ?? [];
}

/** After mobile lookup: prefer deep-link team, else single entry, else team picker. */
export function resolveAfterMobileLookup(
  entries: OwnerOnboardingEntry[],
  deepLink: OwnerDeepLink | null,
): { kind: "route"; entry: OwnerOnboardingEntry } | { kind: "teams" } {
  if (deepLink) {
    const match = entries.find(
      (e) => e.tournamentId === deepLink.tournamentId && e.teamId === deepLink.teamId,
    );
    if (match) return { kind: "route", entry: match };
  }
  if (entries.length === 1) return { kind: "route", entry: entries[0]! };
  return { kind: "teams" };
}

export function ownerDashboardRoute(tournamentId: number, teamId: number): string {
  return ownerDashboardAppPath(tournamentId, teamId);
}

export async function submitOwnerMobile(
  mobile: string,
  deepLink: OwnerDeepLink | null,
): Promise<MobileSubmitResult> {
  try {
    const entries = await lookupOwnerTeams(mobile);
    if (entries.length === 0) {
      return { kind: "empty" };
    }

    saveOnboardingEntries(entries);
    const resolved = resolveAfterMobileLookup(entries, deepLink);

    if (resolved.kind === "route") {
      clearOnboardingEntries();
      return {
        kind: "route",
        path: ownerDashboardRoute(resolved.entry.tournamentId, resolved.entry.teamId),
      };
    }

    return { kind: "teams" };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Lookup failed. Please try again.",
    };
  }
}
