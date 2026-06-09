import { useState, useEffect } from "react";

export type PlatformFeatures = {
  badminton: boolean;
};

const DEFAULT_FEATURES: PlatformFeatures = { badminton: false };

export function usePlatformFeatures(): PlatformFeatures {
  const [features, setFeatures] = useState<PlatformFeatures>(DEFAULT_FEATURES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/features")
      .then((r) => (r.ok ? r.json() : DEFAULT_FEATURES))
      .then((data: PlatformFeatures) => {
        if (!cancelled) setFeatures(data);
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
