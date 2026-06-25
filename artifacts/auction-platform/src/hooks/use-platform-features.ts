import { useState, useEffect } from "react";

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

function normalizeFeatures(data: Partial<PlatformFeatures>): PlatformFeatures {
  const scoring = data.scoring ?? data.badminton ?? data.cricket ?? false;
  return { scoring, badminton: scoring, cricket: scoring };
}

export function usePlatformFeatures(): PlatformFeaturesState {
  const [features, setFeatures] = useState<PlatformFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/features")
      .then((r) => (r.ok ? r.json() : DEFAULT_FEATURES))
      .then((data: Partial<PlatformFeatures>) => {
        if (!cancelled) setFeatures(normalizeFeatures(data));
      })
      .catch(() => {
        if (!cancelled) setFeatures(DEFAULT_FEATURES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...features, loading };
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
