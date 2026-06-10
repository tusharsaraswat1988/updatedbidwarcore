import type { ReactNode } from "react";
import { usePlatformFeatures } from "@/hooks/use-platform-features";
import NotFound from "@/pages/not-found";

/** Gates cricket, badminton, and future sport scoring UIs behind platform SCORING=true. */
export function ScoringFeatureGuard({ children }: { children: ReactNode }) {
  const { scoring } = usePlatformFeatures();
  if (!scoring) return <NotFound />;
  return <>{children}</>;
}

/** @deprecated Use ScoringFeatureGuard */
export const BadmintonFeatureGuard = ScoringFeatureGuard;
