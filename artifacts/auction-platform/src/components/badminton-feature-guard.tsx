import type { ReactNode } from "react";
import { usePlatformFeatures } from "@/hooks/use-platform-features";
import NotFound from "@/pages/not-found";

export function BadmintonFeatureGuard({ children }: { children: ReactNode }) {
  const { badminton } = usePlatformFeatures();
  if (!badminton) return <NotFound />;
  return <>{children}</>;
}
