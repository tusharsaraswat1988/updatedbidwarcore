import { useState, useEffect } from "react";

export type PlatformFeatures = {
  /** Platform kill-switch — SCORING=true on the host enables all sport scoring modules */
  scoring: boolean;
  /** Same as scoring — kept for older UI checks */
  badminton: boolean;
  cricket: boolean;
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

export function usePlatformFeatures(): PlatformFeatures {
  const [features, setFeatures] = useState<PlatformFeatures>(DEFAULT_FEATURES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/features")
      .then((r) => (r.ok ? r.json() : DEFAULT_FEATURES))
      .then((data: Partial<PlatformFeatures>) => {
        if (!cancelled) setFeatures(normalizeFeatures(data));
      })
      .catch(() => {
        if (!cancelled) setFeatures(DEFAULT_FEATURES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return features;
}

export function useScoringPlatformEnabled(): boolean {
  return usePlatformFeatures().scoring;
}

/** Platform SCORING=true plus per-tournament admin toggle for cricket. */
export function useCricketScoringActive(
  sport: string | undefined,
  scoringEnabled: boolean | undefined,
): boolean {
  const scoringPlatform = useScoringPlatformEnabled();
  return scoringPlatform && sport === "cricket" && scoringEnabled === true;
}
