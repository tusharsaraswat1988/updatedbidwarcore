/**
 * Stadium Ground LED Mid-Screen Overlays — Dedicated high-contrast presentation renderer
 * for stadium LED screens, scoreboards, and projectors (/tournament/:id/score-display).
 *
 * Consistently unified with the BIDWAR Cricket Broadcast Design System:
 * - none: returns null (renders regular live cricket scoreboard arena)
 * - sponsors: Full Single-Sponsor Focal Showcase (Auto-Rotating, Tier-Glow)
 * - standings: Points Table & Standings
 * - fixtures: Upcoming Matches & Tournament Schedule
 * - scorecard: Full Match Scorecard (Innings Batting & Bowling figures)
 * - summary: Post-Match Summary & Top Performers
 * - intro: Match Intro / VS Presentation
 */

import { useEffect, useMemo, useState } from "react";
import {
  competitionGroupTitle,
  competitionSelectionLabel,
  formatNetRunRate,
  formatPointsPercentage,
  parseCompetitionSelection,
  resolveKnockoutStageSelection,
  rowsForCompetitionSelection,
} from "@workspace/scoring-core/cricket";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  getScoringStandings,
  listScoringMatches,
  getPublicMatchScorecard,
  getCricketTournamentRoster,
  cricketBrandingQueryKey,
  getCricketBranding,
  getCricketMasterTeams,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  resolveBatterView,
  resolveBowlerView,
  type CricketObsMidOverlayKind,
} from "@/lib/cricket-obs-view-model";
import { useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
  type CricketScorerPlayer,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type {
  CricketMatchSummary,
  CricketScoreboardState,
} from "@workspace/scoring-core";
import { getActiveInnings, oversText } from "@/lib/scoring-ball";
import {
  Trophy,
  Award,
  Calendar,
  BarChart3,
  FileText,
  Sparkles,
  Swords,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CricketLedMidOverlaysProps = {
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  match?: ScoringMatchJson | null;
  state?: CricketScoreboardState | null;
  summary?: CricketMatchSummary | null;
  teams?: CricketScorerTeam[];
  players?: CricketScorerPlayer[];
  sponsors?: SponsorLogo[];
  onClose?: () => void;
};

export function CricketLedMidOverlays({
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  match,
  state,
  summary,
  teams = [],
  players = [],
  sponsors = [],
  onClose,
}: CricketLedMidOverlaysProps) {
  const { logoSrc, logoAlt } = useCricketBidWarTheme();

  // Standings data query
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Matches/Fixtures data query
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: (overlay === "fixtures" || overlay === "intro" || overlay === "summary" || overlay === "scorecard" || overlay === "standings") && tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
  });

  // Resolve active match
  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found;
    }
    return match ?? (matches && matches.length > 0 ? matches[0] : null);
  }, [overlayMatchId, matches, match]);

  const targetMatchId = activeMatch?.id ?? match?.id;

  // Scorecard data query
  const { data: fullScorecard } = useQuery({
    queryKey: ["public-match-scorecard", tournamentId, targetMatchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, targetMatchId!),
    enabled: (overlay === "scorecard" || overlay === "summary") && !!tournamentId && !!targetMatchId,
    staleTime: 5000,
  });

  // Auto-rotating sponsor index for single large showcase
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);

  useEffect(() => {
    if (overlay !== "sponsors" || sponsors.length <= 1 || (overlaySponsorName && overlaySponsorName !== "all")) return;
    const interval = setInterval(() => {
      setCurrentSponsorIndex((prev) => (prev + 1) % sponsors.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [overlay, sponsors.length, overlaySponsorName]);

  // Standings filter resolution
  const resolvedStandings = useMemo(() => {
    return rowsForCompetitionSelection(
      standings?.groups ?? [],
      standings ?? [],
      parseCompetitionSelection(overlayStageOrGroup),
    );
  }, [overlayStageOrGroup, standings]);
  const matchedGroup = resolvedStandings.group;

  const stageSelection = useMemo(
    () => parseCompetitionSelection(overlayStageOrGroup),
    [overlayStageOrGroup],
  );
  const knockoutStage = useMemo(
    () => resolveKnockoutStageSelection(fixtures ?? [], matches ?? [], stageSelection),
    [fixtures, matches, stageSelection],
  );
  const stageLabel = competitionSelectionLabel(overlayStageOrGroup);
  const isKnockoutStage =
    !matchedGroup &&
    (stageSelection.kind === "round" ||
      knockoutStage.ambiguous ||
      knockoutStage.fixtures.length > 0 ||
      knockoutStage.matches.length > 0);

  // Standings Pagination State (up to 12 teams per page, auto-paginating every 8 seconds if > 12 teams)
  const [standingsPage, setStandingsPage] = useState(0);
  const allStandingsRows = resolvedStandings.rows;
  const standingsQualifiers = resolvedStandings.qualifiers;

  const STANDINGS_PAGE_SIZE = 12;
  const totalStandingsPages = Math.ceil(allStandingsRows.length / STANDINGS_PAGE_SIZE) || 1;
  const paginatedStandingsRows = useMemo(() => {
    if (allStandingsRows.length === 0) return [];
    const start = (standingsPage % totalStandingsPages) * STANDINGS_PAGE_SIZE;
    return allStandingsRows.slice(start, start + STANDINGS_PAGE_SIZE);
  }, [allStandingsRows, standingsPage, totalStandingsPages]);

  // Auto-cycle Standings pages every 8 seconds IF more than 12 teams
  useEffect(() => {
    if (overlay !== "standings" || totalStandingsPages <= 1) return;
    const interval = setInterval(() => {
      setStandingsPage((prev) => (prev + 1) % totalStandingsPages);
    }, 8000);
    return () => clearInterval(interval);
  }, [overlay, totalStandingsPages]);

  // Master teams fallback query if teams prop is empty
  const { data: fetchedMasterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: (!teams || teams.length === 0) && tournamentId > 0,
    staleTime: 60_000,
  });

  const effectiveTeams: CricketScorerTeam[] = useMemo(() => {
    if (teams && teams.length > 0) return teams;
    return (fetchedMasterTeams ?? []).map(cricketMasterTeamToScorerTeam);
  }, [teams, fetchedMasterTeams]);

  const teamMap = useMemo(() => new Map(effectiveTeams.map((t) => [t.id, t])), [effectiveTeams]);

  // Fixtures slate is upcoming-only. A live or finished selection does not become "Upcoming Match".
  const activeFixtureMatch = useMemo(() => {
    const upcoming = (matches ?? [])
      .filter((m) => m.status === "upcoming" || m.status === "scheduled")
      .sort((a, b) => (a.tournamentMatchNumber ?? a.id) - (b.tournamentMatchNumber ?? b.id));
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found && (found.status === "upcoming" || found.status === "scheduled")) return found;
    }
    return upcoming[0] ?? null;
  }, [overlayMatchId, matches]);

  const fixtureHomeTeam = useMemo(() => {
    if (!activeFixtureMatch) return null;
    return teamMap.get(activeFixtureMatch.homeTeamId) || (activeFixtureMatch as any).homeTeam || null;
  }, [activeFixtureMatch, teamMap]);

  const fixtureAwayTeam = useMemo(() => {
    if (!activeFixtureMatch) return null;
    return teamMap.get(activeFixtureMatch.awayTeamId) || (activeFixtureMatch as any).awayTeam || null;
  }, [activeFixtureMatch, teamMap]);

  // Active sponsor for focal showcase
  const targetedSponsor = useMemo(() => {
    if (!overlaySponsorName || overlaySponsorName === "all" || sponsors.length === 0) return null;
    return sponsors.find((s) => s.name?.toLowerCase().trim() === overlaySponsorName.toLowerCase().trim()) ?? null;
  }, [overlaySponsorName, sponsors]);

  // Fallback tournament roster query if players prop is empty
  const { data: fallbackRosterData } = useQuery({
    queryKey: ["cricket-tournament-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: (!players || players.length === 0) && tournamentId > 0,
    staleTime: 120_000,
  });

  const effectivePlayers: CricketScorerPlayer[] = useMemo(() => {
    if (players && players.length > 0) return players;
    return Array.isArray(fallbackRosterData) ? fallbackRosterData.map(cricketRosterToScorerPlayer) : [];
  }, [players, fallbackRosterData]);

  const homeTeam = teamMap.get(activeMatch?.homeTeamId ?? 0) || (activeMatch as any)?.homeTeam;
  const awayTeam = teamMap.get(activeMatch?.awayTeamId ?? 0) || (activeMatch as any)?.awayTeam;
  const innings = state ? getActiveInnings(state) : null;
  const battingTeam = teams.find((t) => t.id === innings?.battingTeamId) || homeTeam;
  const bowlingTeam = teams.find((t) => t.id === innings?.bowlingTeamId) || awayTeam;
  const strikerPlayer = effectivePlayers.find((p) => p.id === state?.strikerId);
  const nonStrikerPlayer = effectivePlayers.find((p) => p.id === state?.nonStrikerId);
  const bowlerPlayer = effectivePlayers.find((p) => p.id === state?.bowlerId);

  const strikerStats = strikerPlayer
    ? resolveBatterView(
        strikerPlayer.id,
        true,
        effectivePlayers,
        fullScorecard?.scorecard,
        innings?.innings ?? 1,
      )
    : null;

  const nonStrikerStats = nonStrikerPlayer
    ? resolveBatterView(
        nonStrikerPlayer.id,
        false,
        effectivePlayers,
        fullScorecard?.scorecard,
        innings?.innings ?? 1,
      )
    : null;

  const bowlerStats = bowlerPlayer
    ? resolveBowlerView(
        bowlerPlayer.id,
        effectivePlayers,
        fullScorecard?.scorecard,
        innings?.innings ?? 1,
      )
    : null;

  // Scorecard innings breakdown for match summary & top performers
  const scorecardInnings = fullScorecard?.scorecard?.innings || [];

  const getTopBatterFromInnings = (inn?: any) => {
    if (!inn?.batting || inn.batting.length === 0) return null;
    const sorted = [...inn.batting].sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      if (b.strikeRate !== a.strikeRate) return b.strikeRate - a.strikeRate;
      return a.balls - b.balls;
    });
    const best = sorted[0];
    if (!best) return null;
    const pl = effectivePlayers.find((p) => p.id === best.playerId);
    return {
      id: best.playerId,
      name: pl?.name || `Batter #${best.playerId}`,
      photoUrl: pl?.photoUrl || null,
      runs: best.runs,
      balls: best.balls,
      fours: best.fours,
      sixes: best.sixes,
      strikeRate: best.strikeRate,
    };
  };

  const getTopBowlerFromInnings = (inn?: any) => {
    if (!inn?.bowling || inn.bowling.length === 0) return null;
    const sorted = [...inn.bowling].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      if (a.runs !== b.runs) return a.runs - b.runs;
      return a.economy - b.economy;
    });
    const best = sorted[0];
    if (!best) return null;
    const pl = effectivePlayers.find((p) => p.id === best.playerId);
    return {
      id: best.playerId,
      name: pl?.name || `Bowler #${best.playerId}`,
      photoUrl: pl?.photoUrl || null,
      overs: best.overs,
      maidens: best.maidens,
      runsConceded: best.runs,
      wickets: best.wickets,
      economy: best.economy,
    };
  };

  const activeSponsor = targetedSponsor ?? (sponsors.length > 0 ? sponsors[currentSponsorIndex % sponsors.length] : null);
  const customType = activeSponsor?.type?.trim() || "";
  const priorityTypeStr = (activeSponsor?.priorityType || "").toLowerCase();
  const isTitle =
    Boolean(activeSponsor?.isTitleSponsor) ||
    priorityTypeStr.includes("title") ||
    priorityTypeStr.includes("gold") ||
    (customType ? /title\s*sponsor|gold/i.test(customType) : false);
  const isCo =
    Boolean(activeSponsor?.isCoSponsor) ||
    priorityTypeStr.includes("co") ||
    priorityTypeStr.includes("silver") ||
    (customType ? /co[\s-]*sponsor|silver/i.test(customType) : false);

  // Show defined Category / Designation (e.g. "BOUNDARY SPONSOR", "GIFTING SPONSOR"), never "NORMAL"
  const sponsorTypeLabel = (
    (customType && !["normal", "standard"].includes(customType.toLowerCase()) ? customType : null) ||
    (isTitle ? "TITLE SPONSOR" : null) ||
    (isCo ? "CO-SPONSOR" : null) ||
    (priorityTypeStr && !["normal", "standard"].includes(priorityTypeStr) ? activeSponsor?.priorityType?.replace(/_/g, " ") : null) ||
    "OFFICIAL PARTNER"
  ).toUpperCase();

  // Tournament details for banner
  const { data: tournamentData } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: overlay === "banner" && tournamentId > 0 },
  });

  // Branding query for custom venue banner
  const { data: brandingData } = useQuery<BadmintonBranding>({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<BadmintonBranding>(tournamentId),
    enabled: overlay === "banner" && tournamentId > 0,
    staleTime: 10_000,
  });

  const resolvedBannerUrl =
    brandingData?.resolvedVenueBannerUrl ||
    brandingData?.venueBannerUrl ||
    tournamentData?.mainBannerUrl ||
    brandingData?.auctionMainBannerUrl ||
    null;

  const resolvedBannerFit =
    brandingData?.resolvedVenueBannerFit ||
    tournamentData?.mainBannerFit ||
    "cover";

  if (overlay === "none" || overlay === "neutral") return null;

  // 0. FULL SCREEN ZERO MARGIN TOURNAMENT BANNER
  if (overlay === "banner") {
    return (
      <AnimatePresence>
        <motion.div
          key="led-banner-fullscreen"
          initial={{ opacity: 0, x: "-100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "-100%" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center p-0 m-0 w-screen h-screen overflow-hidden select-none"
        >
          {resolvedBannerUrl ? (
            <img
              src={resolvedBannerUrl}
              alt={tournamentName || "Tournament Banner"}
              className="w-full h-full"
              style={{ objectFit: (resolvedBannerFit as "cover" | "contain") || "cover" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 text-white space-y-4 max-w-xl">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-4xl">
                🖼️
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-black uppercase tracking-wider text-amber-400">
                {tournamentName || "Tournament Banner"}
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                No banner uploaded yet. Upload a 16:9 banner in Tournament Settings &gt; Branding.
              </p>
            </div>
          )}

          {/* Top-left BidWar watermark brand mark */}
          <div className="absolute top-5 left-6 z-50 flex items-center gap-2 bg-black/70 border border-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-2xl">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={logoAlt || "BidWar"}
                className="h-6 sm:h-7 w-auto object-contain"
                loading="eager"
              />
            ) : (
              <span className="text-xs font-black uppercase tracking-widest text-amber-400 font-display">
                BIDWAR
              </span>
            )}
          </div>

          {/* Close button in top-right corner */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-6 right-6 h-11 w-11 rounded-full border-2 border-white/30 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-xl font-black transition shadow-2xl hover:scale-110 active:scale-95 z-50 backdrop-blur-md"
              title="Close Banner & Return to Scoreboard"
              aria-label="Close Banner"
            >
              ✕
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 md:p-4 pointer-events-auto select-none bg-black/90 backdrop-blur-xl overflow-hidden">
        <motion.div
          key={`led-overlay-${overlay}`}
          initial={{ opacity: 0, x: "-100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "-100%" }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex h-[96vh] w-[98vw] max-w-[1880px] flex-col overflow-hidden rounded-3xl border-2 border-border/80 bg-[#07090e]/95 shadow-[0_30px_90px_rgba(0,0,0,0.95)]"
        >
          {/* Top LED Header Bar — Official BidWar Logo (Left) | Tournament Identity (Center) | Live Status (Right) */}
          <div className="relative flex h-16 sm:h-20 items-center justify-between px-4 sm:px-8 border-b border-border/80 bg-card/90 backdrop-blur-md shrink-0">
            {/* Left Brand Identity: Official BidWar Logo */}
            <div className="flex items-center gap-2.5 w-36 sm:w-56 md:w-64 shrink-0">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={logoAlt || "BidWar"}
                  className="h-7 sm:h-8 md:h-9 w-auto max-w-[130px] sm:max-w-[180px] md:max-w-[210px] object-contain object-left filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-xs font-display font-black uppercase tracking-widest">
                  BIDWAR
                </span>
              )}
            </div>

            {/* Centered Tournament Name & Logo */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 min-w-0 flex-1 max-w-4xl mx-auto">
              {tournamentLogoUrl ? (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-card border-2 border-border p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-black/50">
                  <img src={tournamentLogoUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0 shadow-lg shadow-black/50">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
              )}
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-black tracking-wider text-white uppercase truncate drop-shadow text-center">
                {tournamentName || "LIVE CRICKET TOURNAMENT"}
              </h1>
            </div>

            {/* Right Status & Actions */}
            <div className="flex items-center justify-end gap-3 w-36 sm:w-56 md:w-64 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                LIVE
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 border-white/20 bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-base sm:text-lg font-black transition shadow-lg hover:scale-105 active:scale-95"
                  title="Close"
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* LED Main Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-between">
            {/* 1. SPONSOR SHOWCASE (Single Focal Sponsor Layout) */}
            {overlay === "sponsors" && (
              <div className="flex h-full flex-col justify-between max-w-5xl mx-auto w-full">
                {/* Title without yellow line above — Spaced nicely lower */}
                <div className="text-center pt-8 sm:pt-14 mb-4 sm:mb-6">
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-wider text-white uppercase drop-shadow">
                    {targetedSponsor ? `OFFICIAL PARTNER` : `OUR VALUED PARTNERS`}
                  </h2>
                </div>

                {activeSponsor ? (
                  <div className="my-auto flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
                    <div
                      className={cn(
                        "w-full flex flex-col items-center justify-center rounded-3xl p-8 sm:p-12 transition-all duration-500 backdrop-blur-md",
                        isTitle
                          ? "border-4 border-amber-400 bg-gradient-to-b from-[#1c1404] via-card/95 to-[#07090e] shadow-[0_0_90px_rgba(251,191,36,0.5),0_0_35px_rgba(251,191,36,0.3)] animate-pulse"
                          : isCo
                          ? "border-3 border-cyan-400/80 bg-gradient-to-b from-[#041624] via-card/95 to-[#07090e] shadow-[0_0_50px_rgba(34,211,238,0.35)]"
                          : "border-2 border-border/80 bg-gradient-to-b from-card/95 via-card/85 to-[#07090e] shadow-2xl"
                      )}
                    >
                      {/* 1. Sponsor Logo (Frameless Clean Showcase) */}
                      <div className="w-full h-56 sm:h-72 max-w-xl mx-auto flex items-center justify-center p-2 mb-6 sm:mb-8">
                        {activeSponsor.url ? (
                          <img
                            src={activeSponsor.url}
                            alt={activeSponsor.name || "Sponsor"}
                            className="max-h-full max-w-full object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Award
                              className={cn(
                                "w-24 h-24",
                                isTitle ? "text-amber-400" : isCo ? "text-cyan-400" : "text-primary"
                              )}
                            />
                            <span className="text-base font-black text-muted-foreground uppercase">
                              Official Sponsor
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 2. Sponsor Name (Below Logo) */}
                      <h3
                        title={activeSponsor.name || "Tournament Partner"}
                        className={cn(
                          "font-display font-black uppercase tracking-wide text-white text-center drop-shadow-[0_2px_15px_rgba(0,0,0,0.95)] mb-4 break-words max-w-full leading-tight",
                          (activeSponsor.name?.length ?? 0) > 30
                            ? "text-2xl sm:text-3xl md:text-4xl"
                            : (activeSponsor.name?.length ?? 0) > 18
                            ? "text-2xl sm:text-4xl md:text-5xl"
                            : "text-3xl sm:text-5xl md:text-6xl"
                        )}
                      >
                        {activeSponsor.name || "Tournament Partner"}
                      </h3>

                      {/* 3. Sponsor Type (Below Name) */}
                      <div>
                        <span
                          className={cn(
                            "inline-block px-6 py-2 rounded-full font-display font-black uppercase tracking-[0.25em]",
                            isTitle
                              ? "bg-amber-400 text-black text-base sm:text-lg border-2 border-yellow-200 shadow-[0_0_30px_rgba(251,191,36,0.7)]"
                              : isCo
                              ? "bg-cyan-500/20 border-2 border-cyan-400/70 text-cyan-300 text-sm sm:text-base shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                              : "bg-primary/20 border border-primary/40 text-primary text-xs sm:text-sm"
                          )}
                        >
                          {sponsorTypeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Carousel Indicators (if multiple sponsors and not single targeted) */}
                    {!targetedSponsor && sponsors.length > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-6">
                        {sponsors.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentSponsorIndex(idx)}
                            className={cn(
                              "h-3 rounded-full transition-all duration-300",
                              idx === currentSponsorIndex % sponsors.length
                                ? "w-10 bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.7)]"
                                : "w-3 bg-white/30 hover:bg-white/60"
                            )}
                            aria-label={`Go to sponsor ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-12 rounded-3xl bg-card/60 border-2 border-border/80 shadow-2xl">
                    <Award className="w-20 h-20 text-amber-400/80 mb-4 animate-bounce" />
                    <h3 className="text-3xl sm:text-4xl font-display font-black text-amber-400 uppercase tracking-wide">
                      {tournamentName ? `${tournamentName.toUpperCase()} PARTNERS` : "TOURNAMENT PARTNERS"}
                    </h3>
                    <p className="text-base text-muted-foreground mt-2 max-w-lg font-medium">
                      Official Tournament Live Stadium Presentation Powered by BidWar Sports Platform
                    </p>
                  </div>
                )}

                {/* Footer branding */}
                <div className="text-center pt-4 border-t border-border/50">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-amber-400 font-display">
                    POWERED BY BIDWAR.IN
                  </span>
                </div>
              </div>
            )}

            {/* 2. POINTS TABLE / STANDINGS (LED Display - Maximized Broadcast Layout) */}
            {overlay === "standings" && (
              <div className="flex h-full flex-col max-w-7xl mx-auto w-full justify-between">
                <div className="flex items-center justify-between mb-3 shrink-0 px-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black tracking-wider text-white uppercase drop-shadow">
                      {matchedGroup
                        ? `POINTS TABLE — ${competitionGroupTitle(matchedGroup).toUpperCase()}`
                        : isKnockoutStage
                        ? `STAGE — ${stageLabel.toUpperCase()}`
                        : `POINTS TABLE & RANKINGS`}
                    </h2>
                    {matchedGroup && (
                      <span className="px-3 py-1 rounded-full bg-amber-400 text-black font-display font-black text-xs uppercase tracking-widest">
                        GROUP VIEW
                      </span>
                    )}
                  </div>
                  {totalStandingsPages > 1 && !isKnockoutStage && (
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 font-display font-black text-xs sm:text-sm tracking-widest uppercase">
                      <span>PAGE {(standingsPage % totalStandingsPages) + 1} OF {totalStandingsPages}</span>
                    </div>
                  )}
                </div>

                {isKnockoutStage ? (
                  <div className="flex-1 w-full rounded-2xl border-2 border-border/80 bg-card/90 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col justify-start">
                    {knockoutStage.ambiguous || (knockoutStage.fixtures.length === 0 && knockoutStage.matches.length === 0) ? (
                      <p className="py-16 text-center text-muted-foreground text-base font-medium">
                        {knockoutStage.ambiguous
                          ? "This stage is in more than one competition."
                          : "No fixtures in this stage."}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/50">
                        {(knockoutStage.fixtures.length > 0 ? knockoutStage.fixtures : knockoutStage.matches).map((item, idx) => {
                          const homeId = "homeTeamId" in item ? item.homeTeamId : 0;
                          const awayId = "awayTeamId" in item ? item.awayTeamId : 0;
                          const home = teamMap.get(homeId);
                          const away = teamMap.get(awayId);
                          return (
                            <li key={item.id} className="flex items-center justify-between gap-4 px-6 py-5">
                              <span className="font-display font-black text-amber-400 text-2xl tabular-nums">{idx + 1}</span>
                              <span className="flex-1 text-center font-display font-black text-white text-2xl sm:text-4xl uppercase tracking-wide">
                                {home?.name || "Home"} <span className="text-amber-400">vs</span> {away?.name || "Away"}
                              </span>
                              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                {item.roundName || stageLabel}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                <div className="flex-1 w-full rounded-2xl border-2 border-border/80 bg-card/90 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col justify-start">
                  <table className="w-full border-collapse text-left table-fixed">
                    <thead className="bg-[#0a0d14] border-b-2 border-border text-xs sm:text-base font-black tracking-widest text-muted-foreground uppercase">
                      <tr>
                        <th className="w-16 sm:w-24 py-3.5 px-3 sm:px-4 text-center">POS</th>
                        <th className="py-3.5 px-3 sm:px-5">TEAM</th>
                        <th className="w-20 sm:w-24 py-3.5 px-2 sm:px-4 text-center">PLAYED</th>
                        <th className="w-20 sm:w-24 py-3.5 px-2 sm:px-4 text-center text-emerald-400">WON</th>
                        <th className="w-20 sm:w-24 py-3.5 px-2 sm:px-4 text-center text-red-400">LOST</th>
                        <th className="w-28 sm:w-36 py-3.5 px-2 sm:px-4 text-center text-amber-300">PTS %</th>
                        <th className="w-24 sm:w-32 py-3.5 px-2 sm:px-4 text-center text-cyan-300">NRR</th>
                        <th className="w-24 sm:w-32 py-3.5 px-3 sm:px-6 text-right text-amber-400 font-extrabold">POINTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginatedStandingsRows && paginatedStandingsRows.length > 0 ? (
                        paginatedStandingsRows.map((row, idx) => {
                          const globalIdx = (standingsPage % totalStandingsPages) * STANDINGS_PAGE_SIZE + idx;
                          const isTop4 =
                            typeof row.qualified === "boolean"
                              ? row.qualified
                              : standingsQualifiers > 0 && globalIdx < standingsQualifiers;
                          return (
                            <tr
                              key={`${row.drawId ?? "legacy"}-${row.teamId}`}
                              className={cn(
                                "transition",
                                isTop4 ? "bg-amber-500/10 font-bold" : "hover:bg-white/5",
                              )}
                            >
                              <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-center">
                                <span
                                  className={cn(
                                    "inline-flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-base sm:text-xl md:text-2xl font-black shadow-md",
                                    isTop4
                                      ? "bg-amber-400 text-black border border-yellow-200"
                                      : "bg-muted text-muted-foreground border border-border",
                                  )}
                                >
                                  {globalIdx + 1}
                                </span>
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-3 sm:px-5 truncate">
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                  {row.teamLogoUrl ? (
                                    <img
                                      src={row.teamLogoUrl}
                                      alt=""
                                      className="h-9 w-9 sm:h-11 sm:w-11 object-contain shrink-0 drop-shadow"
                                    />
                                  ) : (
                                    <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                                      <span className="text-xs sm:text-sm font-black text-primary uppercase">
                                        {row.shortCode || "TM"}
                                      </span>
                                    </div>
                                  )}
                                  <span className="font-display font-black text-white text-lg sm:text-2xl md:text-3xl uppercase tracking-wide truncate">
                                    {row.teamName}
                                  </span>
                                  {row.shortCode && (
                                    <span className="text-xs sm:text-sm text-muted-foreground uppercase font-bold shrink-0">
                                      ({row.shortCode})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center tabular-nums text-white/95 font-mono text-xl sm:text-2xl md:text-3xl font-black">
                                {row.played}
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center tabular-nums text-emerald-400 font-mono text-xl sm:text-2xl md:text-3xl font-black">
                                {row.won}
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center tabular-nums text-red-400 font-mono text-xl sm:text-2xl md:text-3xl font-black">
                                {row.lost}
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center tabular-nums font-mono font-black text-amber-300 text-base sm:text-xl md:text-2xl whitespace-nowrap">
                                {formatPointsPercentage(row.pointsPercentage)}
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center tabular-nums font-mono font-black text-cyan-300 text-lg sm:text-2xl md:text-3xl">
                                {formatNetRunRate(row.netRunRate)}
                              </td>
                              <td className="py-2.5 sm:py-3.5 px-3 sm:px-6 text-right font-mono font-black text-2xl sm:text-4xl md:text-5xl tabular-nums text-amber-400">
                                {row.points}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-16 text-center text-muted-foreground text-base font-medium">
                            No tournament standings currently calculated.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}

                {/* Standings Pagination Indicator Dots */}
                {totalStandingsPages > 1 && !isKnockoutStage && (
                  <div className="flex items-center justify-center gap-2 mt-3 shrink-0">
                    {Array.from({ length: totalStandingsPages }).map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "h-2.5 rounded-full transition-all duration-300",
                          idx === standingsPage % totalStandingsPages
                            ? "w-10 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]"
                            : "w-2.5 bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. UPCOMING MATCH / FIXTURE (Full-Screen Single Match Showcase) */}
            {overlay === "fixtures" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-2 sm:py-4">
                {/* Top Subheader with Category Kicker & Group / Stage */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 text-xs sm:text-sm font-display font-black uppercase tracking-[0.25em] shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>UPCOMING MATCH</span>
                    {activeFixtureMatch?.roundName && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="text-white">{activeFixtureMatch.roundName.toUpperCase()}</span>
                      </>
                    )}
                  </div>

                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-wider text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                    {activeFixtureMatch?.roundName
                      ? `${activeFixtureMatch.roundName.toUpperCase()} — MATCH #${activeFixtureMatch.tournamentMatchNumber || activeFixtureMatch.id}`
                      : `MATCH #${activeFixtureMatch?.tournamentMatchNumber || activeFixtureMatch?.id || 1}`}
                  </h2>
                </div>

                {activeFixtureMatch ? (
                  <div className="my-auto flex flex-col items-center justify-center w-full">
                    <div className="w-full grid grid-cols-1 md:grid-cols-11 items-center gap-4 sm:gap-6 p-6 sm:p-10 md:p-12 rounded-3xl border-2 border-border/80 bg-gradient-to-b from-card/95 via-[#0c101a]/95 to-[#07090e]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                      
                      {/* HOME TEAM (Left - Col Span 4) */}
                      <div className="md:col-span-4 flex flex-col items-center text-center space-y-4">
                        {/* Team Logo Frame */}
                        <div className="h-32 w-32 sm:h-44 sm:w-44 md:h-52 md:w-52 rounded-3xl border-4 border-amber-400/80 bg-gradient-to-br from-[#1c1404] via-card to-[#07090e] p-4 flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.35)] overflow-hidden transition-transform duration-300 hover:scale-105">
                          {fixtureHomeTeam?.logoUrl ? (
                            <img
                              src={fixtureHomeTeam.logoUrl}
                              alt={fixtureHomeTeam.name || "Home Team"}
                              className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
                            />
                          ) : (
                            <span className="text-4xl sm:text-6xl font-display font-black text-amber-400 uppercase tracking-wider">
                              {fixtureHomeTeam?.shortCode || "HOME"}
                            </span>
                          )}
                        </div>

                        {/* Team Name & Code */}
                        <div className="space-y-1 max-w-xs">
                          <h3 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white uppercase tracking-wide truncate drop-shadow">
                            {fixtureHomeTeam?.name || "HOME TEAM"}
                          </h3>
                          {fixtureHomeTeam?.shortCode && (
                            <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 text-xs sm:text-sm font-mono font-black uppercase tracking-widest">
                              {fixtureHomeTeam.shortCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* VS CENTERPIECE (Center - Col Span 3) */}
                      <div className="md:col-span-3 flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 py-2">
                        <div className="relative flex items-center justify-center">
                          <span className="text-6xl sm:text-7xl md:text-8xl font-display font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-300 to-amber-500 drop-shadow-[0_0_35px_rgba(251,191,36,0.6)]">
                            VS
                          </span>
                        </div>

                        {/* Match Number Pill */}
                        <div className="px-4 py-1.5 rounded-xl bg-card border-2 border-border/80 shadow-md">
                          <span className="text-xs sm:text-sm font-mono font-black text-white uppercase tracking-widest">
                            MATCH #{activeFixtureMatch.tournamentMatchNumber || activeFixtureMatch.id}
                          </span>
                        </div>

                        {/* Match Overs / Rules if present */}
                        {activeFixtureMatch.rules?.overs ? (
                          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">
                            {activeFixtureMatch.rules.overs} OVERS PER SIDE
                          </span>
                        ) : null}
                      </div>

                      {/* AWAY TEAM (Right - Col Span 4) */}
                      <div className="md:col-span-4 flex flex-col items-center text-center space-y-4">
                        {/* Team Logo Frame */}
                        <div className="h-32 w-32 sm:h-44 sm:w-44 md:h-52 md:w-52 rounded-3xl border-4 border-cyan-400/80 bg-gradient-to-br from-[#041624] via-card to-[#07090e] p-4 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.35)] overflow-hidden transition-transform duration-300 hover:scale-105">
                          {fixtureAwayTeam?.logoUrl ? (
                            <img
                              src={fixtureAwayTeam.logoUrl}
                              alt={fixtureAwayTeam.name || "Away Team"}
                              className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
                            />
                          ) : (
                            <span className="text-4xl sm:text-6xl font-display font-black text-cyan-400 uppercase tracking-wider">
                              {fixtureAwayTeam?.shortCode || "AWAY"}
                            </span>
                          )}
                        </div>

                        {/* Team Name & Code */}
                        <div className="space-y-1 max-w-xs">
                          <h3 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white uppercase tracking-wide truncate drop-shadow">
                            {fixtureAwayTeam?.name || "AWAY TEAM"}
                          </h3>
                          {fixtureAwayTeam?.shortCode && (
                            <span className="inline-block px-3 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 text-xs sm:text-sm font-mono font-black uppercase tracking-widest">
                              {fixtureAwayTeam.shortCode}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* BOTTOM SCHEDULE & VENUE STRIP */}
                    <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-base font-bold text-white/90">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card/80 border border-border shadow-md">
                        <span className="text-amber-400">📍 VENUE:</span>
                        <span className="uppercase">{activeFixtureMatch.venue || "MAIN GROUND"}</span>
                      </div>

                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card/80 border border-border shadow-md">
                        <span className="text-amber-400">🕒 TIME:</span>
                        <span className="font-mono uppercase">
                          {activeFixtureMatch.scheduledAt
                            ? new Date(activeFixtureMatch.scheduledAt).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "SCHEDULED"}
                        </span>
                      </div>

                      {activeFixtureMatch.roundName && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-300 shadow-md">
                          <span className="font-display font-black uppercase tracking-wider">
                            STAGE: {activeFixtureMatch.roundName.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center py-16 text-muted-foreground text-xl font-medium">
                    No upcoming match scheduled.
                  </div>
                )}

                {/* Bottom Watermark */}
                <div className="text-center pt-2">
                  <span className="text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase">
                    BIDWAR SPORTS BROADCAST ENGINE
                  </span>
                </div>
              </div>
            )}

            {/* 4. FULL SCORECARD (LED Optimized) */}
            {overlay === "scorecard" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between border-b-2 border-border pb-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-400 bg-black/80 shadow-lg">
                      <span className="text-2xl font-black text-amber-400 font-display">
                        {battingTeam?.shortCode || "BAT"}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-display font-black tracking-wide text-white uppercase">
                        {battingTeam?.name || "BATTING INNINGS"}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-4xl sm:text-6xl font-black font-mono tabular-nums text-white">
                      {innings?.runs ?? 0}
                      <span className="text-primary mx-1">/</span>
                      {innings?.wickets ?? 0}
                    </div>
                    <p className="text-sm sm:text-base font-bold text-amber-400 uppercase tracking-wider font-mono">
                      {innings ? oversText(innings.over, innings.ball) : "0.0"} OVERS
                    </p>
                  </div>
                </div>

                {/* Scorecard Table Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                  {/* Active Batter Figures */}
                  <div className="rounded-3xl border-2 border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-md flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        🏏 KEY BATSMEN FIGURES
                      </span>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground">
                        R (B) · 4s/6s · SR
                      </span>
                    </div>
                    <div className="space-y-3">
                      {/* Striker */}
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-border/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-emerald-400 font-black text-lg sm:text-xl">*</span>
                          <div>
                            <p className="text-base sm:text-xl md:text-2xl font-black text-white uppercase tracking-wide truncate max-w-[200px] sm:max-w-[260px]">
                              {strikerStats?.name || strikerPlayer?.name || "Striker Batter"}
                            </p>
                            <span className="text-xs text-emerald-400 font-bold uppercase">(On Strike)</span>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          {strikerStats?.hasStats ? (
                            <>
                              <span className="text-2xl sm:text-3xl font-black text-amber-300">
                                {strikerStats.runs}* ({strikerStats.balls})
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {strikerStats.fours}x4 · {strikerStats.sixes}x6 · SR {strikerStats.strikeRate.toFixed(1)}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground/70 italic">
                              {strikerPlayer?.role || "Top Order Batter"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Non-Striker */}
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-border/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground/50 font-black text-lg sm:text-xl">·</span>
                          <div>
                            <p className="text-base sm:text-xl md:text-2xl font-bold text-white/90 uppercase tracking-wide truncate max-w-[200px] sm:max-w-[260px]">
                              {nonStrikerStats?.name || nonStrikerPlayer?.name || "Non-Striker"}
                            </p>
                            <span className="text-xs text-muted-foreground font-bold uppercase">(Non-Striker)</span>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          {nonStrikerStats?.hasStats ? (
                            <>
                              <span className="text-2xl sm:text-3xl font-bold text-white">
                                {nonStrikerStats.runs} ({nonStrikerStats.balls})
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {nonStrikerStats.fours}x4 · {nonStrikerStats.sixes}x6 · SR {nonStrikerStats.strikeRate.toFixed(1)}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground/70 italic">
                              {nonStrikerPlayer?.role || "Batter"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Bowler Figures */}
                  <div className="rounded-3xl border-2 border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-md flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                        🎯 CURRENT BOWLING ATTACK
                      </span>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground">
                        O-M-R-W · ECON
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-border/60">
                        <div>
                          <p className="text-base sm:text-xl md:text-2xl font-black text-white uppercase tracking-wide truncate max-w-[200px] sm:max-w-[260px]">
                            {bowlerStats?.name || bowlerPlayer?.name || "Active Bowler"} *
                          </p>
                          <span className="text-xs text-amber-300 font-bold uppercase">
                            {bowlerPlayer?.role || "Right-Arm Pace"}
                          </span>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          {bowlerStats?.hasStats ? (
                            <>
                              <span className="text-2xl sm:text-3xl font-black text-amber-400">
                                {bowlerStats.overs}-{bowlerStats.maidens}-{bowlerStats.runsConceded}-{bowlerStats.wickets}
                              </span>
                              <p className="text-xs text-cyan-300">
                                Econ: {bowlerStats.economy.toFixed(2)} · Ball {innings?.ball ?? 0}/6
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-sm sm:text-base font-mono font-bold text-amber-300/80">
                                Ball {innings?.ball ?? 0} of 6
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">
                                {bowlerPlayer?.role || "Active Bowler"}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-black/30 border border-border/40 flex items-center justify-between text-xs sm:text-sm font-black uppercase text-muted-foreground">
                        <span>Bowling Team: {bowlingTeam?.name}</span>
                        <span>Overs Limit: {state?.oversLimit ?? 20} Ov</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scorecard Bottom Summary Strip */}
                <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-primary/40 bg-primary/10 px-8 py-3.5 text-sm sm:text-base font-black uppercase tracking-wider text-white shadow-xl">
                  <div>
                    <span className="text-primary">TARGET: </span>
                    <span className="font-mono text-xl font-black ml-1 text-white">{state?.target ?? "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-primary">TOTAL SCORE: </span>
                    <span className="font-mono text-2xl font-black text-amber-400 ml-1">
                      {innings?.runs ?? 0}/{innings?.wickets ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MATCH SUMMARY (LED Optimized) */}
            {overlay === "summary" && (() => {
              const groupOrRoundText =
                (activeMatch as any)?.groupName ||
                stageLabel ||
                activeMatch?.roundName ||
                "";

              const winnerTeamId =
                activeMatch?.winnerTeamId ??
                state?.winnerTeamId ??
                summary?.winnerTeamId ??
                null;

              const rawResult =
                activeMatch?.resultSummary ||
                state?.resultText ||
                match?.resultSummary ||
                summary?.resultText ||
                "MATCH COMPLETED";

              const isHomeWinner = Boolean(
                (winnerTeamId != null && homeTeam?.id === winnerTeamId) ||
                (homeTeam?.name && rawResult.toLowerCase().includes(homeTeam.name.toLowerCase()))
              );

              const isAwayWinner = Boolean(
                (winnerTeamId != null && awayTeam?.id === winnerTeamId) ||
                (awayTeam?.name && rawResult.toLowerCase().includes(awayTeam.name.toLowerCase()))
              );

              const winnerTeam = isHomeWinner ? homeTeam : isAwayWinner ? awayTeam : null;

              let formattedResult = rawResult;
              if (winnerTeam && rawResult.toLowerCase().startsWith("won by")) {
                formattedResult = `${winnerTeam.name} ${rawResult}`;
              }

              // Inning match derivations
              const homeBattingInn = scorecardInnings.find((i: any) => i.battingTeamId === homeTeam?.id);
              const awayBattingInn = scorecardInnings.find((i: any) => i.battingTeamId === awayTeam?.id);
              const homeBowlingInn = scorecardInnings.find((i: any) => i.bowlingTeamId === homeTeam?.id);
              const awayBowlingInn = scorecardInnings.find((i: any) => i.bowlingTeamId === awayTeam?.id);

              const homeScore = homeBattingInn
                ? `${homeBattingInn.totalRuns}/${homeBattingInn.totalWickets}`
                : summary?.homeTeam?.score || `${innings?.runs ?? 0}/${innings?.wickets ?? 0}`;

              const homeOvers = homeBattingInn
                ? `${homeBattingInn.overs} OV`
                : summary?.homeTeam?.overs || (innings ? `${oversText(innings.over, innings.ball)} OV` : "20.0 OV");

              const awayScore = awayBattingInn
                ? `${awayBattingInn.totalRuns}/${awayBattingInn.totalWickets}`
                : summary?.awayTeam?.score || (state?.target ? `${state.target - 1}` : "—");

              const awayOvers = awayBattingInn
                ? `${awayBattingInn.overs} OV`
                : summary?.awayTeam?.overs || `${state?.oversLimit ?? 20}.0 OV`;

              const homeTopBatter =
                getTopBatterFromInnings(homeBattingInn) ||
                (strikerStats?.hasStats ? { ...strikerStats, photoUrl: strikerPlayer?.photoUrl } : null) ||
                (strikerPlayer ? { name: strikerPlayer.name, photoUrl: strikerPlayer.photoUrl, runs: 0, balls: 0 } : null);

              const homeTopBowler =
                getTopBowlerFromInnings(homeBowlingInn) ||
                (bowlerStats?.hasStats && bowlingTeam?.id === homeTeam?.id ? { ...bowlerStats, photoUrl: bowlerPlayer?.photoUrl } : null);

              const awayTopBatter =
                getTopBatterFromInnings(awayBattingInn) ||
                (nonStrikerStats?.hasStats ? { ...nonStrikerStats, photoUrl: nonStrikerPlayer?.photoUrl } : null);

              const awayTopBowler =
                getTopBowlerFromInnings(awayBowlingInn) ||
                (bowlerStats?.hasStats ? { ...bowlerStats, photoUrl: bowlerPlayer?.photoUrl } : null) ||
                (bowlerPlayer ? { name: bowlerPlayer.name, photoUrl: bowlerPlayer.photoUrl, wickets: 0, runsConceded: 0, overs: "0.0" } : null);

              const getInitials = (name?: string | null) => {
                if (!name) return "P";
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                return name.slice(0, 2).toUpperCase();
              };

              return (
                <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                  <div className="text-center mb-3">
                    <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm sm:text-base font-black uppercase tracking-[0.22em] text-amber-400 font-display">
                        {activeMatch ? `MATCH #${activeMatch.tournamentMatchNumber || activeMatch.id}${groupOrRoundText ? ` · ${groupOrRoundText.toUpperCase()}` : ""}` : "OFFICIAL MATCH RESULT"}
                      </span>
                      {activeMatch?.status && (
                        <span className={cn(
                          "text-xs font-black uppercase px-3 py-0.5 rounded-full border tracking-wider",
                          activeMatch.status === "live"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse"
                            : activeMatch.status === "walkover"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : activeMatch.status === "completed"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        )}>
                          {activeMatch.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-wider text-white uppercase drop-shadow">
                      MATCH RESULT &amp; HIGHLIGHTS
                    </h2>
                  </div>

                  {/* 2 Inning Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                    {/* Home Team Card */}
                    <div className={cn(
                      "rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all",
                      isHomeWinner
                        ? "border-2 border-amber-400 bg-gradient-to-br from-amber-500/15 via-card/95 to-card/90 shadow-[0_0_35px_rgba(251,191,36,0.35)]"
                        : "border-2 border-border/80 bg-card/90"
                    )}>
                      {/* Winner Ribbon Tag */}
                      {isHomeWinner && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 via-amber-400 to-yellow-400 text-black px-4 py-1.5 rounded-bl-2xl font-display font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                          <span>👑 WINNER</span>
                        </div>
                      )}

                      {/* Team Logo & Score Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4 gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border-2 border-white/10 p-2 flex items-center justify-center shrink-0 shadow-lg">
                            {homeTeam?.logoUrl ? (
                              <img
                                src={homeTeam.logoUrl}
                                alt={homeTeam.name}
                                className="max-h-full max-w-full object-contain filter drop-shadow"
                              />
                            ) : (
                              <span className="text-2xl sm:text-3xl font-display font-black text-amber-400">
                                {homeTeam?.shortCode || "H"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-white uppercase truncate">
                              {homeTeam?.name || "HOME TEAM"}
                            </h3>
                            <span className="text-xs sm:text-sm font-mono uppercase font-bold text-slate-400">
                              OVERS: <strong className="text-white">{homeOvers}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight block",
                            isHomeWinner ? "text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]" : "text-white"
                          )}>
                            {homeScore}
                          </span>
                        </div>
                      </div>

                      {/* Performers Strip */}
                      <div className="space-y-2.5">
                        {/* Top Batter */}
                        {homeTopBatter && (
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/10 border border-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {homeTopBatter.photoUrl ? (
                                  <img src={homeTopBatter.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-display font-black text-amber-300 text-sm">
                                    {getInitials(homeTopBatter.name)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-400/90 block">
                                  TOP BATTER
                                </span>
                                <p className="text-sm sm:text-base font-black text-white truncate">
                                  {homeTopBatter.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                                {homeTopBatter.runs != null ? `${homeTopBatter.runs} (${homeTopBatter.balls ?? 0}b)` : "—"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Top Bowler */}
                        {homeTopBowler && (
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/10 border border-cyan-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {homeTopBowler.photoUrl ? (
                                  <img src={homeTopBowler.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-display font-black text-cyan-300 text-sm">
                                    {getInitials(homeTopBowler.name)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-cyan-400/90 block">
                                  KEY BOWLER
                                </span>
                                <p className="text-sm sm:text-base font-black text-white truncate">
                                  {homeTopBowler.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-mono font-black text-cyan-300">
                                {homeTopBowler.wickets != null ? `${homeTopBowler.wickets}-${homeTopBowler.runsConceded}` : "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Away Team Card */}
                    <div className={cn(
                      "rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all",
                      isAwayWinner
                        ? "border-2 border-amber-400 bg-gradient-to-br from-amber-500/15 via-card/95 to-card/90 shadow-[0_0_35px_rgba(251,191,36,0.35)]"
                        : "border-2 border-border/80 bg-card/90"
                    )}>
                      {/* Winner Ribbon Tag */}
                      {isAwayWinner && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 via-amber-400 to-yellow-400 text-black px-4 py-1.5 rounded-bl-2xl font-display font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                          <span>👑 WINNER</span>
                        </div>
                      )}

                      {/* Team Logo & Score Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4 gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border-2 border-white/10 p-2 flex items-center justify-center shrink-0 shadow-lg">
                            {awayTeam?.logoUrl ? (
                              <img
                                src={awayTeam.logoUrl}
                                alt={awayTeam.name}
                                className="max-h-full max-w-full object-contain filter drop-shadow"
                              />
                            ) : (
                              <span className="text-2xl sm:text-3xl font-display font-black text-cyan-300">
                                {awayTeam?.shortCode || "A"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-white uppercase truncate">
                              {awayTeam?.name || "AWAY TEAM"}
                            </h3>
                            <span className="text-xs sm:text-sm font-mono uppercase font-bold text-slate-400">
                              OVERS: <strong className="text-white">{awayOvers}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight block",
                            isAwayWinner ? "text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]" : "text-cyan-300"
                          )}>
                            {awayScore}
                          </span>
                        </div>
                      </div>

                      {/* Performers Strip */}
                      <div className="space-y-2.5">
                        {/* Top Batter */}
                        {awayTopBatter && (
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/10 border border-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {awayTopBatter.photoUrl ? (
                                  <img src={awayTopBatter.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-display font-black text-amber-300 text-sm">
                                    {getInitials(awayTopBatter.name)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-400/90 block">
                                  TOP BATTER
                                </span>
                                <p className="text-sm sm:text-base font-black text-white truncate">
                                  {awayTopBatter.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                                {awayTopBatter.runs != null ? `${awayTopBatter.runs} (${awayTopBatter.balls ?? 0}b)` : "—"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Top Bowler */}
                        {awayTopBowler && (
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/10 border border-cyan-400/40 overflow-hidden shrink-0 flex items-center justify-center">
                                {awayTopBowler.photoUrl ? (
                                  <img src={awayTopBowler.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-display font-black text-cyan-300 text-sm">
                                    {getInitials(awayTopBowler.name)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-cyan-400/90 block">
                                  KEY BOWLER
                                </span>
                                <p className="text-sm sm:text-base font-black text-white truncate">
                                  {awayTopBowler.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-mono font-black text-cyan-300">
                                {awayTopBowler.wickets != null ? `${awayTopBowler.wickets}-${awayTopBowler.runsConceded}` : "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Champion Result Banner */}
                  <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-600/40 via-amber-500/25 to-amber-600/40 p-5 text-center shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                    <p className="text-2xl sm:text-4xl font-display font-black uppercase tracking-widest text-amber-300 drop-shadow">
                      🏆 {formattedResult}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 6. MATCH INTRO / VS (Clean Frameless Broadcast Presentation) */}
            {overlay === "intro" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-400 font-display">
                      {activeMatch ? `MATCH #${activeMatch.tournamentMatchNumber || activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}` : "MATCH PRESENTATION"}
                    </span>
                    {activeMatch?.status && (
                      <span className={cn(
                        "text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border tracking-wider",
                        activeMatch.status === "live"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse"
                          : activeMatch.status === "walkover"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : activeMatch.status === "completed"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      )}>
                        {activeMatch.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-wider text-white uppercase drop-shadow">
                    {homeTeam?.name || "TEAM 1"} <span className="text-amber-400 italic">VS</span> {awayTeam?.name || "TEAM 2"}
                  </h2>
                </div>

                {/* Team Badges and VS — CLEAN & FRAMELESS */}
                <div className="flex items-center justify-center gap-12 sm:gap-24 my-auto">
                  {/* Home Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-36 w-36 sm:h-52 sm:w-52 items-center justify-center">
                      {homeTeam?.logoUrl ? (
                        <img
                          src={homeTeam.logoUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain filter drop-shadow-[0_15px_40px_rgba(251,191,36,0.4)]"
                        />
                      ) : (
                        <span className="text-7xl sm:text-9xl font-black text-amber-400 font-display drop-shadow-[0_8px_30px_rgba(251,191,36,0.6)]">
                          {homeTeam?.shortCode || "H"}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl sm:text-4xl font-display font-black text-white uppercase text-center max-w-[260px] drop-shadow-md">
                      {homeTeam?.name || "Home Team"}
                    </span>
                  </div>

                  <span className="text-7xl sm:text-9xl font-display font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 drop-shadow-[0_4px_30px_rgba(251,191,36,0.5)]">
                    VS
                  </span>

                  {/* Away Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-36 w-36 sm:h-52 sm:w-52 items-center justify-center">
                      {awayTeam?.logoUrl ? (
                        <img
                          src={awayTeam.logoUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain filter drop-shadow-[0_15px_40px_rgba(34,211,238,0.4)]"
                        />
                      ) : (
                        <span className="text-7xl sm:text-9xl font-black text-cyan-400 font-display drop-shadow-[0_8px_30px_rgba(34,211,238,0.6)]">
                          {awayTeam?.shortCode || "A"}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl sm:text-4xl font-display font-black text-white uppercase text-center max-w-[260px] drop-shadow-md">
                      {awayTeam?.name || "Away Team"}
                    </span>
                  </div>
                </div>

                {/* Match Venue / Toss Strip */}
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/70 py-4 px-8 text-center shadow-xl">
                  <p className="text-sm sm:text-base font-black uppercase tracking-widest text-emerald-300 font-display">
                    LIVE FROM {activeMatch?.venue || match?.venue || "MAIN CRICKET GROUND"}
                  </p>
                  {state?.tossText && (
                    <p className="mt-1 text-base sm:text-lg font-bold text-white tracking-wider">
                      🪙 {state.tossText}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
