import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { applyPwaHeadBranding, SCORER_MANIFEST_HREF } from "@/lib/branding-pwa";

const DEFAULT_TITLE = "BidWar Scoring";

/** Human-readable browser tab title for scoring-app routes. */
export function resolveScoringDocumentTitle(pathname: string, search = ""): string {
  const [pathOnly, inlineQuery] = pathname.split("#")[0]?.split("?") ?? ["/", ""];
  const normalizedPath = (pathOnly ?? "").replace(/\/+$/, "") || "/";
  const searchStr = search || (inlineQuery ? `?${inlineQuery}` : "");
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  const overlayType = (params.get("type") ?? "compact").toLowerCase();

  // Login
  if (normalizedPath === "/login") {
    return "BidWar Scoring Login";
  }

  // Mission Control
  if (/^\/tournament\/\d+\/mission-control$/.test(normalizedPath)) {
    return "BidWar Mission Control";
  }

  // Score Display / Scoreboard
  if (/^\/tournament\/\d+\/score-display$/.test(normalizedPath)) {
    return "BidWar Score Display";
  }

  // Cricket OBS Overlay
  if (/^\/tournament\/\d+\/cricket\/obs(\/.*)?$/.test(normalizedPath)) {
    return "BidWar Cricket OBS";
  }

  // Badminton Match Overlay
  if (/^\/badminton\/[^/]+\/overlay$/.test(normalizedPath)) {
    if (overlayType === "full") return "BidWar OBS Overlay (Full)";
    if (overlayType === "intro") return "BidWar OBS Overlay (Intro)";
    if (overlayType === "winner") return "BidWar OBS Overlay (Winner)";
    if (overlayType === "sponsor") return "BidWar OBS Overlay (Sponsor)";
    return "BidWar OBS Overlay";
  }

  // Badminton Match Display
  if (/^\/badminton\/[^/]+\/display$/.test(normalizedPath)) {
    return "BidWar Scoreboard Display";
  }

  // Badminton Match Score (Umpire Scoring)
  if (/^\/badminton\/[^/]+\/score$/.test(normalizedPath)) {
    return "BidWar Scoring";
  }

  // Badminton Scorer Home
  if (normalizedPath === "/badminton/scorer") {
    return "BidWar Scorer Home";
  }

  // Badminton Standings
  if (normalizedPath === "/badminton/standings") {
    return "BidWar Standings";
  }

  // Badminton Organizer Hub & Sub-pages: /tournament/:id/badminton/...
  const badmintonMatch = normalizedPath.match(
    /^\/tournament\/\d+\/badminton(?:\/([^/?#]+))?(?:\/([^/?#]+))?(?:\/([^/?#]+))?$/,
  );
  if (badmintonMatch) {
    const segment = badmintonMatch[1] ?? "";
    const action = badmintonMatch[3] ?? "";

    if (segment === "matches" && action === "control") {
      return "BidWar Match Control";
    }
    if (segment === "control") {
      const focus = params.get("focus");
      if (focus === "broadcast") return "BidWar Broadcast Director";
      return "BidWar Control Center";
    }

    const badmintonLabels: Record<string, string> = {
      "": "BidWar Tournament Hub",
      players: "BidWar Players",
      matches: "BidWar Matches",
      courts: "BidWar Courts",
      scorers: "BidWar Scorers",
      categories: "BidWar Categories",
      fixtures: "BidWar Fixtures",
      schedule: "BidWar Schedule",
      control: "BidWar Control Center",
      results: "BidWar Results",
      summary: "BidWar Summary",
      "scoring-format": "BidWar Scoring Format",
      analytics: "BidWar Analytics",
      branding: "BidWar Branding",
      broadcast: "BidWar Broadcast Director",
    };

    return badmintonLabels[segment] ?? "BidWar Badminton";
  }

  // Cricket Organizer Sub-pages: /tournament/:id/score/...
  const cricketScoreMatch = normalizedPath.match(/^\/tournament\/\d+\/score(?:\/(.*))?$/);
  if (cricketScoreMatch) {
    const subpath = (cricketScoreMatch[1] ?? "").trim();
    if (!subpath) {
      return "BidWar Matches";
    }

    const cricketLabels: Record<string, string> = {
      dashboard: "BidWar Dashboard",
      "live-control": "BidWar Live Control",
      schedule: "BidWar Schedule",
      fixtures: "BidWar Fixtures",
      teams: "BidWar Teams",
      players: "BidWar Players",
      standings: "BidWar Standings",
      stats: "BidWar Stats",
      officials: "BidWar Officials",
      awards: "BidWar Awards",
      reports: "BidWar Reports",
      rules: "BidWar Rules",
      settings: "BidWar Settings",
      links: "BidWar Links",
    };

    if (cricketLabels[subpath]) {
      return cricketLabels[subpath];
    }

    // Match live scoring under organizer: /tournament/:id/score/:matchId/live
    if (/^\d+\/live$/.test(subpath)) {
      return "BidWar Scoring";
    }

    // Match center under organizer: /tournament/:id/score/:matchId
    if (/^\d+$/.test(subpath)) {
      return "BidWar Match Center";
    }

    return "BidWar Scoring";
  }

  // Dedicated Cricket Umpire Scoring console: /cricket/:matchId/score
  if (/^\/cricket\/[^/]+\/score$/.test(normalizedPath)) {
    return "BidWar Scoring";
  }

  // Cricket Scorer Home Portal: /cricket/scorer
  if (normalizedPath === "/cricket/scorer") {
    return "BidWar Scorer Home";
  }

  // Cricket Public Tournament Pages: /tournament/:id/cricket/...
  const cricketPublicMatch = normalizedPath.match(/^\/tournament\/\d+\/cricket(?:\/(.*))?$/);
  if (cricketPublicMatch) {
    const subpath = (cricketPublicMatch[1] ?? "").trim();
    if (!subpath) {
      return "BidWar Cricket";
    }
    if (/^match\//.test(subpath)) return "BidWar Match";
    if (/^player\//.test(subpath)) return "BidWar Player Profile";
    if (/^team\//.test(subpath)) return "BidWar Team Profile";
    if (subpath === "matches") return "BidWar Matches";
    if (subpath === "standings") return "BidWar Standings";
    if (subpath === "teams") return "BidWar Teams";
    if (subpath === "players") return "BidWar Players";
    if (subpath === "statistics") return "BidWar Statistics";
    if (subpath === "sponsors") return "BidWar Sponsors";
    return "BidWar Cricket";
  }

  // Fan Hub & Leaderboard routes
  if (
    normalizedPath === "/cricket/leaderboards" ||
    /^\/tournament\/\d+\/cricket\/leaderboards$/.test(normalizedPath)
  ) {
    return "BidWar Leaderboards";
  }

  if (/^\/player\//.test(normalizedPath)) {
    return "BidWar Player Profile";
  }

  if (
    /^\/tournament\/\d+\/fan$/.test(normalizedPath) ||
    /^\/fan\//.test(normalizedPath) ||
    /^\/fanpage\//.test(normalizedPath) ||
    /^\/[^/]+\/fanpage$/.test(normalizedPath)
  ) {
    return "BidWar Fan Hub";
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
    applyPwaHeadBranding(logos, SCORER_MANIFEST_HREF, iconVersion);
  }, [logos.favicon, logos.appleTouchIcon, logos.pwaIcon, logos.appIcon, iconVersion]);

  useEffect(() => {
    const base = resolveScoringDocumentTitle(location, search);
    document.title =
      brandName && brandName !== "BidWar" ? base.replace(/BidWar/g, brandName) : base;
  }, [location, search, brandName]);

  return null;
}
