import { useEffect } from "react";
import { scoringAppPath, SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";

/** Legacy auction-platform scoring URLs → canonical scoring-app URL (same path under /scoring-app). */
export function RedirectToScoringApp() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith(SCORING_APP_BASE)) {
      return;
    }
    window.location.replace(`${scoringAppPath(pathname)}${search}${hash}`);
  }, []);

  return <GlobalLoadingScreen label="Opening scoring console…" />;
}
