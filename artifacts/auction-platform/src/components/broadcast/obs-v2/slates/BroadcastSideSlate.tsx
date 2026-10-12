/**
 * BroadcastSideSlate — Authoritative Reusable V2 Mid-Screen Side Slate
 *
 * Inspired by international multi-sport TV broadcast graphic motion language:
 * - Side-entry composition entering from the LEFT edge of the camera-safe area
 * - Left-to-right panel reveal, clean readable hold, and reverse left exit
 * - Camera area remains 100% visible on the right (~40–65% remaining viewport)
 * - Stays strictly inside Camera Safe Zone (top: 96px, height: 784px / y: 96px → 880px)
 * - Never covers or reflows Header (0–96px), Lower-Third Scorebug (880–1040px), or Footer (1040–1080px)
 * - Responsive content-driven width (~38%–56% canvas width)
 *
 * Visual Identity: BIDWAR V2 DESIGN SYSTEM
 * - Obsidian & deep navy chassis (#050811 / #0C1222) with glassmorphic blur
 * - 3px radiant BidWar Gold (#FFD700) and Electric Cyan (#12CFFF) rails
 * - Real BidWar Crest Badge asset (/assets/broadcast/bidwar-obs-crest-badge.png)
 * - High-contrast typography hierarchy (Bebas Neue, Inter, JetBrains Mono)
 *
 * Variants:
 * 1. SUMMARY   — Match verdict, innings scores, target/rates, top performers (~52% width)
 * 2. SCORECARD — Active innings breakdown, batters & bowling spell (~48% width)
 * 3. STANDINGS — Tournament points table & group rankings (~44% width)
 * 4. FIXTURES  — Upcoming matches & session schedule (~42% width)
 * 5. SPONSORS  — Official commercial partner spotlight & brand grid (~40% width)
 * 6. VS_INTRO  — Cinematic head-to-head pre-match clash (~46% width)
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { OBS_V2 } from "../obs-v2-tokens";
import {
  getScoringStandings,
  listScoringMatches,
  getCricketMasterTeams,
  getPublicMatchScorecard,
  publicMatchScorecardQueryKey,
} from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import {
  competitionGroupTitle,
  competitionSelectionLabel,
  formatNetRunRate,
  parseCompetitionSelection,
  resolveKnockoutStageSelection,
  rowsForCompetitionSelection,
} from "@workspace/scoring-core/cricket";
import {
  broadcastMatchSummary,
  inningsPlates,
  knockoutBoardRows,
  knockoutResultLine,
  plateMatchId,
  tossLine,
  upcomingFixture,
  type KnockoutBoardItem,
} from "@/lib/cricket-broadcast-plates";
import {
  cricketMasterTeamToScorerTeam,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";

export type BroadcastSideSlateVariant =
  | "SUMMARY"
  | "SCORECARD"
  | "STANDINGS"
  | "FIXTURES"
  | "SPONSORS"
  | "VS_INTRO";

export interface BroadcastSideSlateProps {
  variant: BroadcastSideSlateVariant;
  vm: CricketObsViewModel;
  tournamentId?: number;
  matchId?: number;
  sponsorName?: string;
  stageOrGroup?: string;
  className?: string;
}

// ─── Content-Driven Configurations per Variant ──────────────────────────────
export const VARIANT_CONFIGS: Record<
  BroadcastSideSlateVariant,
  {
    widthPx: number;
    heightMode: "fill" | "compact";
    heightPx?: number;
    label: string;
    kicker: string;
  }
> = {
  STANDINGS: { widthPx: 860, heightMode: "fill", label: "POINTS TABLE", kicker: "TOURNAMENT STANDINGS" },
  FIXTURES: { widthPx: 820, heightMode: "fill", label: "SESSION SCHEDULE", kicker: "UPCOMING FIXTURES" },
  SCORECARD: { widthPx: 940, heightMode: "fill", label: "SCORECARD", kicker: "LIVE INNINGS BREAKDOWN" },
  SUMMARY: { widthPx: 680, heightMode: "compact", heightPx: 460, label: "MATCH SUMMARY", kicker: "" },
  VS_INTRO: { widthPx: 680, heightMode: "compact", heightPx: 340, label: "MATCH PREVIEW", kicker: "HEAD TO HEAD CLASH" },
  SPONSORS: { widthPx: 560, heightMode: "compact", heightPx: 275, label: "", kicker: "" },
};

export type SponsorTier = "TITLE" | "CO_SPONSOR" | "NORMAL";

/**
 * Resolves the sponsor priority tier (TITLE, CO_SPONSOR, NORMAL)
 * for broadcast visual hierarchy & dynamic glow effects.
 */
export function resolveSponsorTier(
  sponsor?: BidWarSponsorLogo | null,
): SponsorTier {
  if (!sponsor) return "NORMAL";
  if (sponsor.isTitleSponsor) return "TITLE";
  if (sponsor.isCoSponsor) return "CO_SPONSOR";

  const priorityType = (sponsor.priorityType || "").toLowerCase();
  if (priorityType.includes("title") || priorityType.includes("gold")) return "TITLE";
  if (priorityType.includes("co") || priorityType.includes("silver")) return "CO_SPONSOR";

  const typeStr = (sponsor.type || "").toLowerCase().trim();
  if (/title\s*sponsor|title\s*partner/i.test(typeStr)) return "TITLE";
  if (/co[\s-]*sponsor|co[\s-]*partner|powered\s*by/i.test(typeStr)) return "CO_SPONSOR";

  return "NORMAL";
}

// ─── Reusable Side Slate Shell ───────────────────────────────────────────────

interface SideSlateShellProps {
  variant: BroadcastSideSlateVariant;
  tournamentName: string;
  title: string;
  kicker: string;
  shellKey?: string;
  heightPx?: number;
  hideHeadline?: boolean;
  sponsorTier?: SponsorTier;
  children: React.ReactNode;
}

function SideSlateShell({
  variant,
  tournamentName,
  title,
  kicker,
  shellKey,
  heightPx,
  hideHeadline = false,
  sponsorTier = "NORMAL",
  children,
}: SideSlateShellProps) {
  const config = VARIANT_CONFIGS[variant];
  const targetHeight = heightPx ?? config.heightPx;

  // Dynamic border, glow, and chassis styling based on tier
  let borderStyle = "1px solid rgba(255, 255, 255, 0.10)";
  let borderLeftStyle = "3.5px solid #FFD700";
  let borderTopStyle = "1.5px solid rgba(255, 215, 0, 0.4)";
  let boxShadowStyle = "0 18px 45px rgba(0, 0, 0, 0.92), 0 0 20px rgba(0, 0, 0, 0.7)";
  let backgroundStyle = "linear-gradient(180deg, rgba(14, 16, 24, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)";

  if (variant === "SPONSORS") {
    if (sponsorTier === "TITLE") {
      // Extra radiant gold glow for Title Sponsor
      borderStyle = "1.5px solid rgba(255, 215, 0, 0.75)";
      borderLeftStyle = "4px solid #FFD700";
      borderTopStyle = "2.5px solid #FFD700";
      boxShadowStyle =
        "0 0 38px rgba(255, 215, 0, 0.45), 0 0 75px rgba(255, 215, 0, 0.20), 0 18px 45px rgba(0, 0, 0, 0.95)";
      backgroundStyle =
        "linear-gradient(180deg, rgba(28, 22, 10, 0.98) 0%, rgba(10, 12, 18, 0.99) 100%)";
    } else if (sponsorTier === "CO_SPONSOR") {
      // Moderate cyan glow for Co-Sponsor (less than title)
      borderStyle = "1.5px solid rgba(18, 207, 255, 0.55)";
      borderLeftStyle = "4px solid #12CFFF";
      borderTopStyle = "2px solid #12CFFF";
      boxShadowStyle =
        "0 0 22px rgba(18, 207, 255, 0.32), 0 0 45px rgba(18, 207, 255, 0.12), 0 18px 45px rgba(0, 0, 0, 0.92)";
      backgroundStyle =
        "linear-gradient(180deg, rgba(10, 20, 32, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)";
    } else {
      // Standard clean styling for regular sponsors
      borderStyle = "1px solid rgba(255, 255, 255, 0.12)";
      borderLeftStyle = "3.5px solid rgba(255, 255, 255, 0.45)";
      borderTopStyle = "1.5px solid rgba(255, 255, 255, 0.2)";
      boxShadowStyle = "0 18px 45px rgba(0, 0, 0, 0.92), 0 0 15px rgba(0, 0, 0, 0.6)";
      backgroundStyle =
        "linear-gradient(180deg, rgba(14, 16, 24, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)";
    }
  }

  return (
    <div
      className="absolute inset-x-0 pointer-events-none select-none flex items-end pb-4"
      style={{
        top: `${OBS_V2.canvas.headerHeight}px`,
        height: `${OBS_V2.canvas.cameraHeight}px`,
        zIndex: OBS_V2.layer.slates,
        paddingLeft: `${OBS_V2.canvas.safeX}px`,
        paddingRight: `${OBS_V2.canvas.safeX}px`,
        overflow: "hidden",
      }}
    >
      <motion.div
        key={shellKey || `side-slate-${variant}`}
        initial={{ x: "-108%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "-108%", opacity: 0 }}
        transition={{
          duration: 0.30,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col overflow-hidden pointer-events-none"
        style={{
          width: `${config.widthPx}px`,
          maxWidth: "60%",
          height: targetHeight ? `${targetHeight}px` : "auto",
          maxHeight: `${OBS_V2.canvas.cameraHeight - 32}px`,
          background: backgroundStyle,
          backdropFilter: "blur(24px)",
          border: borderStyle,
          borderLeft: borderLeftStyle,
          borderTop: borderTopStyle,
          borderRadius: "12px",
          boxShadow: boxShadowStyle,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ── 1. Top Sub-Masthead Bar with Real BidWar Logo Asset ── */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-2.5"
          style={{
            height: "44px",
            background: "linear-gradient(90deg, rgba(20, 24, 36, 0.98) 0%, rgba(12, 14, 20, 0.98) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Left: Real Official BidWar Logo Asset & Tournament Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/branding/bidwar-reverse-logo-official.png"
              alt="BidWar"
              className="h-4 w-auto object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes("broadcast/bidwar-reverse-logo-official")) {
                  target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                }
              }}
            />
            <span className="text-white text-[15px] font-bold tracking-wide uppercase truncate">
              {tournamentName || "CRICKET BROADCAST"}
            </span>
          </div>

          {/* Right: Slate Tag Indicator (only when label exists) */}
          {config.label ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse" />
              <span className="text-[#FFD700] font-mono font-black text-[13px] uppercase tracking-[0.16em]">
                {config.label}
              </span>
            </div>
          ) : null}
        </div>

        {/* ── 2. Headline Strip (Omitted for SPONSORS & SUMMARY) ── */}
        {!hideHeadline && variant !== "SPONSORS" && variant !== "SUMMARY" && (
          <div
            className="px-5 py-2 shrink-0 flex items-center justify-between"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">
                {kicker}
              </div>
              <div className="text-xl sm:text-2xl font-black italic tracking-wide text-white uppercase font-sans">
                {title}
              </div>
            </div>
            <div
              className="h-1.5 w-12 rounded-full"
              style={{
                background: "linear-gradient(90deg, #FFD700 0%, #12CFFF 100%)",
              }}
            />
          </div>
        )}

        {/* ── 3. Content Viewport ── */}
        <div className="flex flex-col p-3.5">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ─── 1. VARIANT: SUMMARY SLATE (Left-Takeover 54% Width) ──────────────────────

function SummaryVariant({
  vm,
  tournamentId,
  matchId,
}: {
  vm: CricketObsViewModel;
  tournamentId?: number;
  matchId?: number;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });

  const selectedId = plateMatchId({
    overlay: "summary",
    overlayMatchId: matchId,
    liveMatchId: vm.matchId,
    liveStatus: vm.phase === "completed" ? "completed" : null,
  });
  const activeMatch = useMemo(
    () => (selectedId ? matches?.find((match) => match.id === selectedId) ?? null : null),
    [matches, selectedId],
  );
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId!),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 60_000,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const { data: fullScorecard } = useQuery({
    queryKey: publicMatchScorecardQueryKey(tournamentId ?? 0, selectedId ?? 0, 0),
    queryFn: () => getPublicMatchScorecard(tournamentId!, selectedId!),
    enabled: !!tournamentId && !!selectedId,
    refetchInterval: 4_000,
  });
  const homeTeam = teams.find((team) => team.id === activeMatch?.homeTeamId) ?? null;
  const awayTeam = teams.find((team) => team.id === activeMatch?.awayTeamId) ?? null;
  const winnerTeamId = activeMatch?.winnerTeamId ?? null;
  const winnerName =
    winnerTeamId === homeTeam?.id ? homeTeam?.name : winnerTeamId === awayTeam?.id ? awayTeam?.name : null;
  const summary = broadcastMatchSummary({
    scorecard: fullScorecard?.scorecard,
    players: fullScorecard?.players,
    homeTeamId: homeTeam?.id ?? activeMatch?.homeTeamId ?? 0,
    awayTeamId: awayTeam?.id ?? activeMatch?.awayTeamId ?? 0,
    winnerTeamId,
    resultSummary: activeMatch?.resultSummary ?? null,
    winnerName,
  });
  const isHomeWinner = winnerTeamId != null && homeTeam?.id === winnerTeamId;
  const isAwayWinner = winnerTeamId != null && awayTeam?.id === winnerTeamId;
  const formattedResult = activeMatch ? summary.resultText : "Choose a finished match.";
  const homeScore = summary.home.score ?? "—";
  const homeOvers = summary.home.overs ?? "—";
  const awayScore = summary.away.score ?? "—";
  const awayOvers = summary.away.overs ?? "—";

  return (
    <div className="flex flex-col gap-3">
      {/* Result Badge */}
      <div
        className="p-3.5 rounded-xl border border-white/10 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, rgba(255, 215, 0, 0.16) 0%, rgba(255, 255, 255, 0.04) 100%)",
          borderLeft: "4px solid #FFD700",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700] block">
              MATCH RESULT
            </span>
            <span className="text-lg sm:text-xl font-black italic text-white uppercase tracking-wide">
              {formattedResult}
            </span>
          </div>
        </div>
        {vm.venueText && (
          <span className="text-[13px] font-semibold text-slate-300">
            📍 {vm.venueText}
          </span>
        )}
      </div>

      {/* 2-Column Innings Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Home / Batting Inning */}
        <div
          className="p-3.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all"
          style={{
            background: isHomeWinner
              ? "linear-gradient(180deg, rgba(255, 215, 0, 0.14) 0%, rgba(14, 16, 24, 0.95) 100%)"
              : "rgba(255, 255, 255, 0.03)",
            borderColor: isHomeWinner ? "#FFD700" : "rgba(255, 255, 255, 0.10)",
            boxShadow: isHomeWinner ? "0 0 20px rgba(255, 215, 0, 0.25)" : "none",
          }}
        >
          {isHomeWinner && (
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-[10px] font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider shadow z-10 animate-pulse">
              👑 WINNER
            </div>
          )}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
                {homeTeam?.logoUrl ? (
                  <img src={homeTeam.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs font-black text-[#FFD700]">{homeTeam?.shortCode || "H"}</span>
                )}
              </div>
              <span className="font-bold text-[15px] text-white uppercase truncate">
                {homeTeam?.name || "1ST INNINGS"}
              </span>
            </div>
            <span className="font-mono text-xl font-black text-[#FFD700] shrink-0">
              {homeScore}
            </span>
          </div>
          <div className="pt-2 text-[13px] font-mono text-slate-300">
            <span>OVERS: <strong className="text-white">{homeOvers}</strong></span>
          </div>
        </div>

        {/* Away / Chasing Inning */}
        <div
          className="p-3.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all"
          style={{
            background: isAwayWinner
              ? "linear-gradient(180deg, rgba(255, 215, 0, 0.14) 0%, rgba(14, 16, 24, 0.95) 100%)"
              : "rgba(255, 255, 255, 0.03)",
            borderColor: isAwayWinner ? "#FFD700" : "rgba(255, 255, 255, 0.10)",
            boxShadow: isAwayWinner ? "0 0 20px rgba(255, 215, 0, 0.25)" : "none",
          }}
        >
          {isAwayWinner && (
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-[10px] font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider shadow z-10 animate-pulse">
              👑 WINNER
            </div>
          )}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
                {awayTeam?.logoUrl ? (
                  <img src={awayTeam.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs font-black text-cyan-400">{awayTeam?.shortCode || "A"}</span>
                )}
              </div>
              <span className="font-bold text-[15px] text-white uppercase truncate">
                {awayTeam?.name || "2ND INNINGS"}
              </span>
            </div>
            <span className="font-mono text-xl font-black text-cyan-400 shrink-0">
              {awayScore}
            </span>
          </div>
          <div className="pt-2 text-[13px] font-mono text-slate-300">
            <span>OVERS: <strong className="text-white">{awayOvers}</strong></span>
          </div>
        </div>
      </div>

      {/* Key Performers Strip */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: homeTeam?.name || "Home", side: summary.home },
          { label: awayTeam?.name || "Away", side: summary.away },
        ].map((column) => (
          <div key={column.label} className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700]">
              {column.label}
            </span>
            <div className="flex items-center justify-between gap-2 text-[14px]">
              <span className="truncate font-bold text-white">{column.side.topBatter?.name || "—"}</span>
              <span className="font-mono font-bold text-[#FFD700] shrink-0">
                {column.side.topBatter ? `${column.side.topBatter.runs} (${column.side.topBatter.balls})` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[14px]">
              <span className="truncate font-bold text-white">{column.side.topBowler?.name || "—"}</span>
              <span className="font-mono font-bold text-rose-400 shrink-0">
                {column.side.topBowler
                  ? `${column.side.topBowler.wickets}-${column.side.topBowler.runsConceded}`
                  : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. VARIANT: SCORECARD SLATE (49% Width) ─────────────────────────────────

function ScorecardVariant({
  vm,
  tournamentId,
  matchId,
}: {
  vm: CricketObsViewModel;
  tournamentId?: number;
  matchId?: number;
}) {
  const selectedId = plateMatchId({
    overlay: "scorecard",
    overlayMatchId: matchId,
    liveMatchId: vm.matchId,
    liveStatus: vm.phase === "completed" ? "completed" : vm.phase === "live" || vm.phase === "chase" || vm.phase === "innings_break" ? "live" : null,
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId!),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 60_000,
  });
  const { data: fullScorecard } = useQuery({
    queryKey: publicMatchScorecardQueryKey(tournamentId ?? 0, selectedId ?? 0, vm.liveSequence ?? 0),
    queryFn: () => getPublicMatchScorecard(tournamentId!, selectedId!),
    enabled: !!tournamentId && !!selectedId,
    refetchInterval: 4_000,
  });
  const teams = useMemo(
    () => new Map((masterTeams ?? []).map(cricketMasterTeamToScorerTeam).map((team) => [team.id, team])),
    [masterTeams],
  );
  const plates = inningsPlates(fullScorecard?.scorecard, fullScorecard?.players);
  if (!selectedId) {
    return <p className="py-8 text-center text-sm text-slate-400">Choose a live or finished match.</p>;
  }
  if (plates.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Scorecard is not ready.</p>;
  }
  return (
    <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
      {plates.map((plate) => (
        <div key={plate.innings} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-black uppercase text-white">
              {teams.get(plate.battingTeamId)?.name || "Batting"}
            </span>
            <span className="font-mono text-lg font-black text-[#FFD700]">
              {plate.totalRuns}-{plate.totalWickets} ({plate.overs})
            </span>
          </div>
          <div className="space-y-1">
            {plate.batting.map((batter) => (
              <div key={batter.playerId} className="grid grid-cols-[1fr_auto] gap-2 text-[13px]">
                <span className="min-w-0 truncate text-white">
                  {batter.name}
                  <span className="ml-2 text-slate-400">{batter.dismissal}</span>
                </span>
                <span className="font-mono text-[#FFD700]">{batter.runs} ({batter.balls})</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-slate-300">{plate.extrasLine}</p>
          {plate.fallLine ? <p className="text-[12px] text-slate-400">FOW {plate.fallLine}</p> : null}
          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            {plate.bowling.map((bowler) => (
              <div key={bowler.playerId} className="grid grid-cols-[1fr_auto] gap-2 text-[13px]">
                <span className="truncate text-white">{bowler.name}</span>
                <span className="font-mono text-cyan-300">
                  {bowler.overs} · {bowler.runs} · {bowler.wickets}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 3. VARIANT: STANDINGS SLATE (Points Table Rows) ─────────────────────────

function StandingsVariant({
  tournamentId,
  stageOrGroup,
}: {
  tournamentId?: number;
  stageOrGroup?: string;
}) {
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 60_000,
  });

  const resolved = useMemo(() => {
    return rowsForCompetitionSelection(
      standings?.groups ?? [],
      standings ?? [],
      parseCompetitionSelection(stageOrGroup),
    );
  }, [stageOrGroup, standings]);
  const knockoutStage = useMemo(
    () => resolveKnockoutStageSelection(fixtures ?? [], matches ?? [], parseCompetitionSelection(stageOrGroup)),
    [fixtures, matches, stageOrGroup],
  );

  const matchedGroup = resolved.group;
  const rows = resolved.rows;
  const qualifiers = resolved.qualifiers;
  const isKnockoutStage =
    !matchedGroup &&
    (parseCompetitionSelection(stageOrGroup).kind === "round" ||
      knockoutStage.ambiguous ||
      knockoutStage.fixtures.length > 0 ||
      knockoutStage.matches.length > 0);
  const teamMap = useMemo(
    () => new Map((masterTeams ?? []).map(cricketMasterTeamToScorerTeam).map((team) => [team.id, team])),
    [masterTeams],
  );

  if (isKnockoutStage) {
    const stageRows = knockoutBoardRows(
      knockoutStage.fixtures as KnockoutBoardItem[],
      knockoutStage.matches as KnockoutBoardItem[],
    );
    return (
      <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {knockoutStage.ambiguous || stageRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            {knockoutStage.ambiguous
              ? "This stage is in more than one competition."
              : "No fixtures in this stage."}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {stageRows.map((item, idx) => {
              const homeId = "homeTeamId" in item ? item.homeTeamId : 0;
              const awayId = "awayTeamId" in item ? item.awayTeamId : 0;
              const home = teamMap.get(homeId);
              const away = teamMap.get(awayId);
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#FFD700] font-black w-6 text-center">{idx + 1}</span>
                  <span className="flex-1 font-bold text-white uppercase truncate">
                    {home?.name || "Home"} vs {away?.name || "Away"}
                  </span>
                  <span className="max-w-[46%] truncate text-right text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    {knockoutResultLine(item)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const displayRows = rows?.slice(0, 8) || [];
  const isFewTeams = displayRows.length <= 4;

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Table Header Strip */}
      <div
        className="grid grid-cols-12 items-center px-5 py-2.5 text-[12px] font-black tracking-widest uppercase text-slate-300 border-b border-[#FFD700]/30"
        style={{ background: "rgba(18, 22, 32, 0.95)" }}
      >
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-3 pl-1">TEAM</div>
        <div className="col-span-1 text-center font-mono">P</div>
        <div className="col-span-1 text-center font-mono">W</div>
        <div className="col-span-1 text-center font-mono">L</div>
        <div className="col-span-1 text-center font-mono">T</div>
        <div className="col-span-1 text-center font-mono">NR</div>
        <div className="col-span-1 text-center font-mono text-[#FFD700]">PTS</div>
        <div className="col-span-2 text-right font-mono pr-1">NRR</div>
      </div>

      {/* Row Strips (Content-aware sizing, larger padding for few teams) */}
      <div className="divide-y divide-white/5">
        {displayRows.length > 0 ? (
          displayRows.map((row, idx) => {
            const isTopZone = qualifiers > 0 && idx < qualifiers;
            return (
              <div
                key={`${row.drawId ?? "legacy"}-${row.teamId}`}
                className={`grid grid-cols-12 items-center px-5 ${
                  isFewTeams ? "py-3.5 text-[16px]" : "py-2.5 text-[15px]"
                } transition-colors hover:bg-white/[0.04]`}
                style={{
                  background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                }}
              >
                <div className="col-span-1 flex justify-center">
                  <span
                    className={`w-6 h-6 rounded flex items-center justify-center font-mono font-black text-[12px] ${
                      isTopZone ? "bg-[#FFD700] text-black" : "bg-white/10 text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </div>
                <div className="col-span-3 pl-2 font-bold text-white uppercase truncate">
                  {row.teamName}
                </div>
                <div className="col-span-1 text-center font-mono text-slate-300 font-bold">{row.played}</div>
                <div className="col-span-1 text-center font-mono font-bold text-white">{row.won}</div>
                <div className="col-span-1 text-center font-mono text-slate-400">{row.lost}</div>
                <div className="col-span-1 text-center font-mono text-slate-300">{row.tied}</div>
                <div className="col-span-1 text-center font-mono text-slate-300">{row.noResult}</div>
                <div className="col-span-1 text-center font-mono font-black text-[#FFD700]">{row.points}</div>
                <div className="col-span-2 text-right font-mono text-white pr-1">{formatNetRunRate(row.netRunRate)}</div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">
            No standings data available.
          </div>
        )}
      </div>

      {/* Footer Tag */}
      <div className="px-5 py-2 border-t border-white/10 bg-black/50 text-[12px] text-slate-400 font-semibold flex justify-between">
        <span>
          {matchedGroup
            ? `${competitionGroupTitle(matchedGroup).toUpperCase()} · TOP ${qualifiers} QUALIFY`
            : qualifiers > 0
              ? `TOP ${qualifiers} ADVANCE TO PLAYOFFS`
              : "COMPETITION TABLE"}
        </span>
        <span className="font-mono text-[#FFD700]">LIVE SYNCED</span>
      </div>
    </div>
  );
}

// ─── 4. VARIANT: FIXTURES SLATE (Session Schedule) ───────────────────────────

function FixturesVariant({
  tournamentId,
  matchId,
}: {
  tournamentId?: number;
  matchId?: number;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 60_000,
  });

  const effectiveTeams: CricketScorerTeam[] = useMemo(() => {
    return (masterTeams ?? []).map(cricketMasterTeamToScorerTeam);
  }, [masterTeams]);

  const teamMap = useMemo(() => new Map(effectiveTeams.map((t) => [t.id, t])), [effectiveTeams]);

  // If a specific match was chosen, spotlight that match; otherwise list upcoming
  const upcoming = useMemo(() => {
    const match = upcomingFixture(matches ?? [], matchId);
    return match ? [match] : [];
  }, [matchId, matches]);

  return (
    <div className="flex flex-col gap-3">
      {upcoming.length > 0 ? (
        upcoming.map((m: any, i) => {
          const home = teamMap.get(m.homeTeamId) || m.homeTeam;
          const away = teamMap.get(m.awayTeamId) || m.awayTeam;

          return (
            <div
              key={m.id || i}
              className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col gap-3 shadow-lg"
            >
              {/* Header: Match # and Venue */}
              <div className="flex items-center justify-between text-[12px] font-mono text-slate-300 border-b border-white/10 pb-2">
                <span className="text-[#FFD700] font-bold">
                  {`MATCH #${m.tournamentMatchNumber ?? m.id}`}
                </span>
                <span>{m.venue ? `📍 ${m.venue}` : "SESSION SCHEDULE"}</span>
              </div>

              {/* Teams Line with Logos */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 max-w-[44%] min-w-0">
                  {home?.logoUrl ? (
                    <img src={home.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                  ) : null}
                  <span className="font-bold text-lg text-white uppercase truncate">
                    {home?.name || "HOME TEAM"}
                  </span>
                </div>

                <span className="font-black italic text-[#FFD700] text-[13px] px-3 py-0.5 rounded bg-black/50 border border-white/10 shrink-0">
                  VS
                </span>

                <div className="flex items-center justify-end gap-2.5 max-w-[44%] min-w-0 text-right">
                  <span className="font-bold text-lg text-white uppercase truncate">
                    {away?.name || "AWAY TEAM"}
                  </span>
                  {away?.logoUrl ? (
                    <img src={away.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                  ) : null}
                </div>
              </div>

              {/* Time / Status */}
              <div className="flex items-center justify-between text-[13px] pt-2 border-t border-white/5 font-mono text-slate-300">
                <span>
                  {m.scheduledAt
                    ? new Date(m.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                    : "SCHEDULED"}
                </span>
                <span className="text-slate-400 font-bold uppercase text-[12px]">
                  {m.venue || ""}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="py-8 text-center text-sm text-slate-400">
          No upcoming match.
        </div>
      )}
    </div>
  );
}

// ─── 5. VARIANT: SPONSORS SLATE (Single Partner Card) ────────────────────────

function SponsorsVariant({
  currentSponsor,
}: {
  currentSponsor?: BidWarSponsorLogo | null;
}) {
  if (!currentSponsor) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">
          No sponsors added for this tournament.
        </span>
      </div>
    );
  }

  const tier = resolveSponsorTier(currentSponsor);
  const customType = currentSponsor.type?.trim();
  const typeLabel = (
    (customType && !["normal", "standard"].includes(customType.toLowerCase()) ? customType : null) ||
    (tier === "TITLE" ? "TITLE SPONSOR" : null) ||
    (tier === "CO_SPONSOR" ? "CO-SPONSOR" : null) ||
    "OFFICIAL PARTNER"
  ).toUpperCase();

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 text-center px-3 py-1 w-full">
      {/* 1. Sponsor Logo (Clean frameless container with soft backdrop) */}
      <div className="h-28 w-full flex items-center justify-center">
        {currentSponsor.url ? (
          <div className="max-h-28 max-w-[320px] p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-inner">
            <img
              src={currentSponsor.url}
              alt={currentSponsor.name || "Sponsor"}
              className="max-h-24 max-w-[300px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center text-3xl font-black text-[#FFD700]">
            {currentSponsor.name?.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* 2. Sponsor Name (Directly Below Logo) */}
      <div className="flex flex-col items-center gap-1.5 w-full mt-1">
        {currentSponsor.url ? null : (
        <h3 className="text-2xl sm:text-[26px] font-black italic text-white uppercase tracking-wide font-sans leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] truncate max-w-full">
          {currentSponsor.name || "OFFICIAL SPONSOR"}
        </h3>
        )}

        {/* 3. Sponsor Type (Directly Below Sponsor Name) */}
        <div>
          {tier === "TITLE" ? (
            <span className="inline-flex items-center px-4 py-1 rounded-full text-[12px] font-mono font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-[#FFD700] border border-[#FFD700]/60 shadow-[0_0_15px_rgba(255,215,0,0.35)]">
              ★ {typeLabel} ★
            </span>
          ) : tier === "CO_SPONSOR" ? (
            <span className="inline-flex items-center px-4 py-1 rounded-full text-[12px] font-mono font-black uppercase tracking-[0.2em] bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(18,207,255,0.25)]">
              ◆ {typeLabel} ◆
            </span>
          ) : (
            <span className="inline-flex items-center px-4 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.16em] bg-white/10 text-slate-300 border border-white/15">
              {typeLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 6. VARIANT: VS INTRO SLATE (Match Preview) ──────────────────────────────

function VsIntroVariant({
  vm,
  tournamentId,
  matchId,
}: {
  vm: CricketObsViewModel;
  tournamentId?: number;
  matchId?: number;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });

  const activeMatch = useMemo(
    () => (matchId ? matches?.find((match) => match.id === matchId) ?? null : null),
    [matchId, matches],
  );
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId!),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 60_000,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const homeTeam = teams.find((team) => team.id === activeMatch?.homeTeamId) ?? null;
  const awayTeam = teams.find((team) => team.id === activeMatch?.awayTeamId) ?? null;
  const tossState = activeMatch?.stateJson as { tossWinnerTeamId?: number | null; electedTo?: string | null } | null | undefined;
  const toss =
    activeMatch && activeMatch.id === vm.matchId
      ? vm.tossText
      : tossLine(tossState, teams.find((team) => team.id === tossState?.tossWinnerTeamId)?.name);
  const venue =
    activeMatch?.status === "live"
      ? `Live from ${activeMatch.venue || vm.venueText || "the ground"}`
      : activeMatch?.venue || "Venue to be confirmed";

  if (!activeMatch) {
    return <p className="py-8 text-center text-sm text-slate-400">Choose a match to introduce.</p>;
  }

  return (
    <div className="flex flex-col justify-between gap-3 py-1 px-1">
      {/* Team vs Team Card Row */}
      <div className="flex items-center justify-around py-2">
        {/* Team A */}
        <div className="flex flex-col items-center gap-2 max-w-[180px] text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center font-black text-2xl text-white shadow-inner p-2">
            {homeTeam?.logoUrl ? (
              <img src={homeTeam.logoUrl} alt="" className="max-h-16 max-w-16 object-contain" />
            ) : (
              homeTeam?.name?.slice(0, 1) || "H"
            )}
          </div>
          <span className="font-black text-base text-white uppercase truncate w-full tracking-wide">
            {homeTeam?.name || "Home"}
          </span>
        </div>

        {/* VS Indicator */}
        <div className="flex flex-col items-center px-4">
          <span className="text-4xl font-black italic text-[#FFD700] drop-shadow-[0_0_16px_rgba(255,215,0,0.5)]">
            VS
          </span>
          <span className="text-[11px] font-mono font-bold uppercase text-slate-300 tracking-wider mt-1">
            MATCH PREVIEW
          </span>
        </div>

        {/* Team B */}
        <div className="flex flex-col items-center gap-2 max-w-[180px] text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center font-black text-2xl text-cyan-400 shadow-inner p-2">
            {awayTeam?.logoUrl ? (
              <img src={awayTeam.logoUrl} alt="" className="max-h-16 max-w-16 object-contain" />
            ) : (
              awayTeam?.name?.slice(0, 1) || "A"
            )}
          </div>
          <span className="font-black text-base text-white uppercase truncate w-full tracking-wide">
            {awayTeam?.name || "Away"}
          </span>
        </div>
      </div>

      {/* Match Info Strip at bottom of card */}
      <div className="p-3 rounded-xl border border-white/10 bg-black/60 text-[14px] text-slate-200 font-mono flex items-center justify-between">
        <span className="truncate max-w-[50%]">{toss || "Toss pending"}</span>
        <span className="text-cyan-400 font-bold uppercase truncate max-w-[48%] text-right">
          {venue}
        </span>
      </div>
    </div>
  );
}

// ─── Main Export: BroadcastSideSlate Component ───────────────────────────────

export function BroadcastSideSlate({
  variant,
  vm,
  tournamentId,
  matchId,
  sponsorName,
  stageOrGroup,
}: BroadcastSideSlateProps) {
  const config = VARIANT_CONFIGS[variant];

  // ── Sponsor Selection & Sequential Cycling ─────────────────────────────────
  const sponsors = vm.sponsors || [];
  const isAllSponsors = !sponsorName || sponsorName === "all";

  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    if (variant !== "SPONSORS" || !isAllSponsors || sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % sponsors.length);
    }, 4200); // 4.2s per sponsor: 320ms enter, ~3.5s hold, 320ms exit
    return () => clearInterval(timer);
  }, [variant, isAllSponsors, sponsors.length]);

  const activeSponsor = useMemo(() => {
    if (variant !== "SPONSORS") return null;
    if (!sponsors || sponsors.length === 0) return null;
    if (!isAllSponsors) {
      const found = sponsors.find(
        (s) => s.name?.toLowerCase().trim() === sponsorName?.toLowerCase().trim(),
      );
      return found || sponsors[0];
    }
    return sponsors[cycleIndex % sponsors.length];
  }, [variant, sponsors, isAllSponsors, sponsorName, cycleIndex]);

  const activeSponsorTier = useMemo(() => {
    if (variant !== "SPONSORS") return "NORMAL";
    return resolveSponsorTier(activeSponsor);
  }, [variant, activeSponsor]);

  const title = useMemo(() => {
    switch (variant) {
      case "SUMMARY":
        return "MATCH SUMMARY";
      case "SCORECARD":
        return `${vm.batting?.name || "LIVE"} SCORECARD`;
      case "STANDINGS": {
        const selection = parseCompetitionSelection(stageOrGroup);
        if (selection.kind === "round") return selection.roundKey.toUpperCase();
        return stageOrGroup && !stageOrGroup.startsWith("group:") && !stageOrGroup.startsWith("draw:")
          ? `GROUP ${stageOrGroup.toUpperCase()} POINTS`
          : "POINTS TABLE";
      }
      case "FIXTURES":
        return "MATCH SCHEDULE";
      case "SPONSORS":
        return "";
      case "VS_INTRO":
        return "MATCH INTRO";
    }
  }, [variant, vm, stageOrGroup]);

  const shellKey =
    variant === "SPONSORS" && isAllSponsors
      ? `side-slate-sponsors-${cycleIndex}`
      : `side-slate-${variant}`;

  return (
    <SideSlateShell
      key={shellKey}
      shellKey={shellKey}
      variant={variant}
      tournamentName={vm.tournamentName || "BIDWAR CRICKET"}
      title={title}
      kicker={config.kicker}
      hideHeadline={variant === "SPONSORS" || variant === "SUMMARY"}
      sponsorTier={activeSponsorTier}
    >
      {variant === "SUMMARY" && (
        <SummaryVariant vm={vm} tournamentId={tournamentId} matchId={matchId} />
      )}
      {variant === "SCORECARD" && (
        <ScorecardVariant vm={vm} tournamentId={tournamentId} matchId={matchId} />
      )}
      {variant === "STANDINGS" && (
        <StandingsVariant tournamentId={tournamentId} stageOrGroup={stageOrGroup} />
      )}
      {variant === "FIXTURES" && (
        <FixturesVariant tournamentId={tournamentId} matchId={matchId} />
      )}
      {variant === "SPONSORS" && (
        <SponsorsVariant currentSponsor={activeSponsor} />
      )}
      {variant === "VS_INTRO" && (
        <VsIntroVariant vm={vm} tournamentId={tournamentId} matchId={matchId} />
      )}
    </SideSlateShell>
  );
}
