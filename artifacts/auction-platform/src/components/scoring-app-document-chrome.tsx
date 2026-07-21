import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { applyPwaHeadBranding } from "@/lib/branding-pwa";

const DEFAULT_TITLE = "BidWar Scoring";

/** Human-readable browser tab title for scoring-app routes. */
export function resolveScoringDocumentTitle(pathname: string, search = ""): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const overlayType = (params.get("type") ?? "compact").toLowerCase();

  if (/^\/badminton\/[^/]+\/overlay\/?$/.test(pathname)) {
    if (overlayType === "full") return "OBS Overlay (Full) — BidWar";
    if (overlayType === "intro") return "OBS Overlay (Intro) — BidWar";
    if (overlayType === "winner") return "OBS Overlay (Winner) — BidWar";
    if (overlayType === "sponsor") return "OBS Overlay (Sponsor) — BidWar";
    return "OBS Overlay — BidWar";
  }

  if (/^\/badminton\/[^/]+\/display\/?$/.test(pathname)) {
    return "Venue Scoreboard Display — BidWar";
  }

  if (/^\/badminton\/[^/]+\/score\/?$/.test(pathname)) {
    return "Scorer Console — BidWar";
  }

  if (/^\/badminton\/scorer\/?$/.test(pathname)) {
    return "Scorer Home — BidWar";
  }

  if (/\/tournament\/\d+\/score-display\/?$/.test(pathname)) {
    return "Cricket Score Display — BidWar";
  }

  if (/\/tournament\/\d+\/cricket(\/|$)/.test(pathname)) {
    return "Cricket Scoring — BidWar";
  }

  if (/\/tournament\/\d+\/score(\/|$)/.test(pathname)) {
    return "Cricket Match Scoring — BidWar";
  }

  const badmintonPage = pathname.match(/\/tournament\/\d+\/badminton(?:\/([^/?#]+))?/);
  if (badmintonPage) {
    const segment = badmintonPage[1] ?? "";
    const labels: Record<string, string> = {
      "": "Tournament Hub",
      players: "Players",
      matches: "Matches",
      courts: "Courts",
      scorers: "Scorers",
      categories: "Categories",
      fixtures: "Fixtures",
      schedule: "Schedule",
      control: "Operator Panel",
      results: "Results",
      summary: "Summary",
      "scoring-format": "Scoring Format",
      analytics: "Analytics",
      branding: "Branding",
      broadcast: "Broadcast Director",
    };
    if (segment === "matches" && /\/matches\/[^/]+\/control/.test(pathname)) {
      return "Match Control — BidWar";
    }
    if (segment === "control") {
      const focus = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      ).get("focus");
      if (focus === "broadcast") return "Broadcast Director — BidWar";
      return "Operator Panel — BidWar";
    }
    const label = labels[segment] ?? "Badminton";
    return `${label} — BidWar`;
  }

  if (/\/cricket\/leaderboards/.test(pathname)) {
    return "Cricket Leaderboards — BidWar";
  }

  if (/^\/player\//.test(pathname)) {
    return "Player Profile — BidWar";
  }

  return DEFAULT_TITLE;
}

/**
 * Applies admin favicon + per-panel document titles for the scoring app.
 */
export function ScoringAppDocumentChrome() {
  const [location] = useLocation();
  const search = useSearch();
  const { logos, brandName, iconVersion } = useBranding();

  useEffect(() => {
    applyPwaHeadBranding(logos, "/site.webmanifest", iconVersion);
  }, [logos.favicon, logos.appleTouchIcon, logos.pwaIcon, logos.appIcon, iconVersion]);

  useEffect(() => {
    const base = resolveScoringDocumentTitle(location, search);
    document.title =
      brandName && brandName !== "BidWar" ? base.replace(/BidWar/g, brandName) : base;
  }, [location, search, brandName]);

  return null;
}
