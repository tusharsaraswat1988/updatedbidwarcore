import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { usePlatformFeatures } from "@/hooks/use-platform-features";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import NotFound from "@/pages/not-found";

/** Gates cricket, badminton, and future sport scoring UIs behind platform SCORING=true. */
export function ScoringFeatureGuard({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { scoring, loading } = usePlatformFeatures();
  if (loading) {
    const loadingClass = isBadmintonOrganizerPath(location)
      ? BADMINTON_ROUTE_LOADING_CLASS
      : "min-h-screen bg-background";
    return (
      <div className={loadingClass} aria-busy="true" aria-label="Loading scoring features" />
    );
  }
  if (!scoring) return <NotFound />;
  return <>{children}</>;
}

/** @deprecated Use ScoringFeatureGuard */
export const BadmintonFeatureGuard = ScoringFeatureGuard;
