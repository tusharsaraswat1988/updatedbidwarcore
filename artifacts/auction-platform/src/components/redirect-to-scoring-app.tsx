import { useEffect } from "react";
import { scoringAppPath, SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";

/** Legacy auction-platform scoring URLs → canonical scoring-app URL (same path under /scoring-app). */
export function RedirectToScoringApp() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith(SCORING_APP_BASE)) {
      return;
    }
    window.location.replace(`${scoringAppPath(pathname)}${search}${hash}`);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Opening scoring app…</p>
    </div>
  );
}
