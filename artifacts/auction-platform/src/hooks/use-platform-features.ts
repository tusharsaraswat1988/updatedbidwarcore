import { useQuery } from "@tanstack/react-query";

export type PlatformFeatures = {
  /** Platform kill-switch — SCORING=true on the host enables all sport scoring modules */
  scoring: boolean;
  /** Same as scoring — kept for older UI checks */
  badminton: boolean;
  cricket: boolean;
};

export type PlatformFeaturesState = PlatformFeatures & {
  /** True until the first /api/settings/features response settles. */
  loading: boolean;
};

const DEFAULT_FEATURES: PlatformFeatures = {
  scoring: false,
  badminton: false,
  cricket: false,
};

const PLATFORM_FEATURES_QUERY_KEY = ["platform-features"] as const;

function normalizeFeatures(data: Partial<PlatformFeatures>): PlatformFeatures {
  const scoring = data.scoring ?? data.badminton ?? data.cricket ?? false;
  return { scoring, badminton: scoring, cricket: scoring };
}

async function fetchPlatformFeatures(): Promise<PlatformFeatures> {
  const r = await fetch("/api/settings/features");
  const data: Partial<PlatformFeatures> = r.ok ? await r.json() : DEFAULT_FEATURES;
  return normalizeFeatures(data);
}

export function usePlatformFeatures(): PlatformFeaturesState {
  const { data, isPending } = useQuery({
    queryKey: PLATFORM_FEATURES_QUERY_KEY,
    queryFn: fetchPlatformFeatures,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    ...(data ?? DEFAULT_FEATURES),
    // Only block UI on the cold first fetch — remounts reuse cache instantly.
    loading: isPending && data === undefined,
  };
}

export function useScoringPlatformEnabled(): boolean {
  return usePlatformFeatures().scoring;
}

/** Sports that support per-tournament match scoring (admin toggle + organizer nav). */
export const TOURNAMENT_SCORING_SPORTS = ["cricket", "badminton"] as const;

export type TournamentScoringSport = (typeof TOURNAMENT_SCORING_SPORTS)[number];

export function isTournamentScoringSport(
  sport: string | undefined,
): sport is TournamentScoringSport {
  return TOURNAMENT_SCORING_SPORTS.includes(sport as TournamentScoringSport);
}

/** Platform SCORING=true plus per-tournament admin toggle. */
export function useTournamentScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const scoringPlatform = useScoringPlatformEnabled();
  return scoringPlatform && isTournamentScoringSport(sport) && scoringEnabled === true;
}

/** Platform SCORING=true plus per-tournament admin toggle for cricket. */
export function useCricketScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const scoringPlatform = useScoringPlatformEnabled();
  return scoringPlatform && sport === "cricket" && scoringEnabled === true;
}

/** Platform SCORING=true plus per-tournament admin toggle for badminton. */
export function useBadmintonScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const scoringPlatform = useScoringPlatformEnabled();
  return scoringPlatform && sport === "badminton" && scoringEnabled === true;
}
