import { useQuery } from "@tanstack/react-query";

export type PlatformFeatures = {
  /** Platform kill-switch — SCORING=true on the host enables sport scoring modules */
  scoring: boolean;
  /**
   * Per-sport platform gates. When the API only returns `scoring`, both inherit it.
   * Structured so cricket/badminton can diverge without Auction UI changes.
   */
  badminton: boolean;
  cricket: boolean;
  /** Future Broadcast product gate (defaults false until API exposes it). */
  broadcast: boolean;
  /** Future Auction product gate (defaults true when omitted — Auction remains default). */
  auction: boolean;
};

export type PlatformFeaturesState = PlatformFeatures & {
  /** True until the first /api/settings/features response settles. */
  loading: boolean;
};

const DEFAULT_FEATURES: PlatformFeatures = {
  scoring: false,
  badminton: false,
  cricket: false,
  broadcast: false,
  auction: true,
};

const PLATFORM_FEATURES_QUERY_KEY = ["platform-features"] as const;

function normalizeFeatures(data: Partial<PlatformFeatures>): PlatformFeatures {
  // Legacy clients may only send one of scoring/badminton/cricket.
  const scoringFallback = data.scoring ?? data.badminton ?? data.cricket ?? false;
  // Prefer explicit per-sport flags when present; else inherit scoring fallback.
  const badminton = data.badminton ?? scoringFallback;
  const cricket = data.cricket ?? scoringFallback;
  return {
    scoring: data.scoring ?? (badminton || cricket),
    badminton,
    cricket,
    broadcast: data.broadcast ?? false,
    auction: data.auction ?? true,
  };
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

/** Platform sport gate + per-tournament admin toggle. */
export function useTournamentScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const features = usePlatformFeatures();
  if (!isTournamentScoringSport(sport) || scoringEnabled !== true) return false;
  if (sport === "cricket") return features.cricket;
  if (sport === "badminton") return features.badminton;
  return features.scoring;
}

/** Platform cricket gate + per-tournament admin toggle. */
export function useCricketScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const { cricket } = usePlatformFeatures();
  return cricket && sport === "cricket" && scoringEnabled === true;
}

/** Platform badminton gate + per-tournament admin toggle. */
export function useBadmintonScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const { badminton } = usePlatformFeatures();
  return badminton && sport === "badminton" && scoringEnabled === true;
}
