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
import { getScoringStandings, listScoringMatches, getCricketMasterTeams } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam, type CricketScorerTeam } from "@/lib/scoring-squad";
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
  SUMMARY: { widthPx: 680, heightMode: "compact", heightPx: 460, label: "MATCH SUMMARY", kicker: "OFFICIAL MATCH VERDICT" },
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

        {/* ── 2. Headline Strip (Omitted for SPONSORS) ── */}
        {!hideHeadline && variant !== "SPONSORS" && (
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

  const activeMatch = useMemo(() => {
    if (matchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === matchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [matchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;
  const resultText =
    (activeMatch as any)?.resultSummary ||
    vm.resultHeadline ||
    vm.resultText ||
    "MATCH IN PROGRESS";

  return (
    <div className="flex flex-col gap-3">
      {/* Result Badge */}
      <div
        className="p-3.5 rounded-xl border border-white/10 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%)",
          borderLeft: "3.5px solid #FFD700",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <span className="text-[12px] font-black uppercase tracking-widest text-[#FFD700] block">
              MATCH RESULT
            </span>
            <span className="text-xl font-black italic text-white uppercase">
              {resultText}
            </span>
          </div>
        </div>
        {vm.venueText && (
          <span className="text-[14px] font-semibold text-slate-300">
            📍 {vm.venueText}
          </span>
        )}
      </div>

      {/* 2-Column Innings Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Batting Inning */}
        <div
          className="p-3.5 rounded-xl border border-white/10 flex flex-col justify-between"
          style={{ background: "rgba(255, 255, 255, 0.03)" }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold text-[16px] text-white uppercase truncate">
              {homeTeam?.name || "1ST INNINGS"}
            </span>
            <span className="font-mono text-xl font-black text-[#FFD700]">
              {vm.runs}-{vm.wickets}
            </span>
          </div>
          <div className="pt-2 flex items-center justify-between text-[14px] font-mono text-slate-300">
            <span>OVERS: <strong className="text-white">{vm.oversLabel}</strong></span>
            <span>CRR: <strong className="text-cyan-400">{vm.crr ?? "0.00"}</strong></span>
          </div>
        </div>

        {/* Chasing Inning */}
        <div
          className="p-3.5 rounded-xl border border-white/10 flex flex-col justify-between"
          style={{ background: "rgba(255, 255, 255, 0.03)" }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold text-[16px] text-white uppercase truncate">
              {awayTeam?.name || "2ND INNINGS"}
            </span>
            <span className="font-mono text-xl font-black text-cyan-400">
              {vm.target != null ? `${vm.target - 1}` : "—"}
            </span>
          </div>
          <div className="pt-2 flex items-center justify-between text-[14px] font-mono text-slate-300">
            <span>TARGET: <strong className="text-[#FFD700]">{vm.target != null ? `${vm.target} RUNS` : "N/A"}</strong></span>
            <span>STATUS: <strong className="text-emerald-400 uppercase">{vm.phase}</strong></span>
          </div>
        </div>
      </div>

      {/* Key Performers Strip */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top Batters */}
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
          <span className="text-[12px] font-black uppercase tracking-widest text-[#FFD700] pb-1.5 border-b border-white/10 mb-2">
            TOP BATTERS
          </span>
          <div className="space-y-2">
            {[vm.striker, vm.nonStriker].map((b, i) =>
              b ? (
                <div key={i} className="flex items-center justify-between text-[15px]">
                  <span className="font-bold text-white truncate">{b.name}</span>
                  <span className="font-mono font-bold text-[#FFD700]">
                    {b.runs} ({b.balls}b)
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* Top Bowler */}
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
          <span className="text-[12px] font-black uppercase tracking-widest text-cyan-400 pb-1.5 border-b border-white/10 mb-2">
            KEY BOWLER
          </span>
          {vm.bowler ? (
            <div className="flex items-center justify-between text-[15px] pt-0.5">
              <div>
                <span className="font-bold text-white block">{vm.bowler.name}</span>
                <span className="text-[13px] text-slate-400 font-mono">Econ: {vm.bowler.economy?.toFixed(2)}</span>
              </div>
              <span className="font-mono text-lg font-black text-rose-400">
                {vm.bowler.wickets}-{vm.bowler.runsConceded}
              </span>
            </div>
          ) : (
            <div className="text-[13px] text-slate-400 pt-2">No bowler spell active</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. VARIANT: SCORECARD SLATE (49% Width) ─────────────────────────────────

function ScorecardVariant({ vm }: { vm: CricketObsViewModel }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Live Inning Score Banner */}
      <div
        className="p-3.5 rounded-xl border border-[#FFD700]/30 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(14, 16, 24, 0.9) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FFD700] text-black font-black flex items-center justify-center text-base font-mono">
            {vm.batting?.shortCode || "BAT"}
          </div>
          <div>
            <span className="text-lg font-black italic text-white uppercase block">
              {vm.batting?.name || "BATTING TEAM"}
            </span>
            <span className="text-[14px] text-slate-300 font-semibold">
              {vm.phase.toUpperCase()} • CRR: {vm.crr ?? "0.00"}
            </span>
          </div>
        </div>
        <div className="text-right font-mono">
          <span className="text-3xl font-black text-[#FFD700] block drop-shadow-[0_0_10px_rgba(255,215,0,0.35)]">
            {vm.runs}-{vm.wickets}
          </span>
          <span className="text-[14px] text-slate-300 font-bold">({vm.oversLabel} OV)</span>
        </div>
      </div>

      {/* Batters List */}
      <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
        <span className="text-[12px] font-black uppercase tracking-widest text-[#FFD700] pb-1.5 border-b border-white/10 mb-2">
          CREASE BATTERS
        </span>
        <div className="space-y-2">
          {[vm.striker, vm.nonStriker].map((b, i) =>
            b ? (
              <div key={i} className="flex items-center justify-between text-[15px] p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="font-bold text-white text-[16px]">
                  {b.name} {i === 0 && <span className="text-[#FFD700] font-black">*</span>}
                </span>
                <span className="font-mono text-[17px] font-black text-[#FFD700]">
                  {b.runs} <span className="text-[13px] text-slate-400 font-normal">({b.balls}b • 4s:{b.fours} 6s:{b.sixes})</span>
                </span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Bowler Details */}
      {vm.bowler && (
        <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div>
            <span className="text-[12px] font-black uppercase tracking-widest text-cyan-400 block mb-0.5">
              ACTIVE BOWLER
            </span>
            <span className="font-bold text-white text-[17px]">{vm.bowler.name}</span>
            <span className="text-[14px] text-slate-300 font-mono block">Econ: {vm.bowler.economy?.toFixed(2)}</span>
          </div>
          <div className="text-right font-mono">
            <span className="text-2xl font-black text-rose-400 block">
              {vm.bowler.wickets}-{vm.bowler.runsConceded}
            </span>
            <span className="text-[14px] text-slate-300">({vm.bowler.overs} ov)</span>
          </div>
        </div>
      )}
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
  });

  const matchedGroup = useMemo(() => {
    if (!stageOrGroup || stageOrGroup === "all" || !standings?.groups) return null;
    return (
      standings.groups.find(
        (g) => g.name.toLowerCase().trim() === stageOrGroup.toLowerCase().trim(),
      ) ?? null
    );
  }, [stageOrGroup, standings?.groups]);

  const rows = useMemo(() => {
    if (matchedGroup) return matchedGroup.rows;
    return standings ?? [];
  }, [matchedGroup, standings]);

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
        <div className="col-span-6 pl-1">TEAM</div>
        <div className="col-span-1 text-center font-mono">P</div>
        <div className="col-span-1 text-center font-mono">W</div>
        <div className="col-span-1 text-center font-mono">L</div>
        <div className="col-span-2 text-right font-mono pr-2">PTS</div>
      </div>

      {/* Row Strips (Content-aware sizing, larger padding for few teams) */}
      <div className="divide-y divide-white/5">
        {displayRows.length > 0 ? (
          displayRows.map((row, idx) => {
            const isTopZone = idx < 4;
            return (
              <div
                key={row.teamId}
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
                <div className="col-span-6 pl-2 font-bold text-white uppercase truncate">
                  {row.teamName} <span className="text-[#FFD700] font-mono text-[13px] ml-1">({row.shortCode})</span>
                </div>
                <div className="col-span-1 text-center font-mono text-slate-300 font-bold">{row.played}</div>
                <div className="col-span-1 text-center font-mono font-bold text-white">{row.won}</div>
                <div className="col-span-1 text-center font-mono text-slate-400">{row.lost}</div>
                <div className="col-span-2 text-right font-mono font-black text-lg text-[#FFD700] pr-2">
                  {row.points}
                </div>
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
        <span>TOP 4 ADVANCE TO PLAYOFFS</span>
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
  const targetMatch = useMemo(() => {
    if (matchId && matches && matches.length > 0) {
      return matches.find((m) => m.id === matchId) || null;
    }
    return null;
  }, [matchId, matches]);

  const upcoming = useMemo(() => {
    if (targetMatch) return [targetMatch];
    return (matches || []).filter((m) => m.status !== "completed").slice(0, 4);
  }, [targetMatch, matches]);

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
                <div className="flex items-center gap-2">
                  <span className="text-[#FFD700] font-bold">
                    {m.roundName || `MATCH #${m.tournamentMatchNumber ?? m.id}`}
                  </span>
                  {m.roundName && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded font-black uppercase">
                      {m.roundName}
                    </span>
                  )}
                </div>
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
                <span className="text-amber-400 font-bold uppercase text-[12px]">
                  {m.status || "UPCOMING"}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="py-8 text-center text-sm text-slate-400">
          No upcoming fixtures scheduled.
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
          Official Partner
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
        <h3 className="text-2xl sm:text-[26px] font-black italic text-white uppercase tracking-wide font-sans leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] truncate max-w-full">
          {currentSponsor.name || "OFFICIAL SPONSOR"}
        </h3>

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

  const activeMatch = useMemo(() => {
    if (matchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === matchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [matchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;

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
              homeTeam?.shortCode || "HOME"
            )}
          </div>
          <span className="font-black text-base text-white uppercase truncate w-full tracking-wide">
            {homeTeam?.name || "HOME SQUAD"}
          </span>
          <span className="text-[#FFD700] font-mono text-[13px] font-bold">
            {homeTeam?.shortCode || "HOM"}
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
              awayTeam?.shortCode || "AWAY"
            )}
          </div>
          <span className="font-black text-base text-white uppercase truncate w-full tracking-wide">
            {awayTeam?.name || "AWAY SQUAD"}
          </span>
          <span className="text-cyan-400 font-mono text-[13px] font-bold">
            {awayTeam?.shortCode || "AWY"}
          </span>
        </div>
      </div>

      {/* Match Info Strip at bottom of card */}
      <div className="p-3 rounded-xl border border-white/10 bg-black/60 text-[14px] text-slate-200 font-mono flex items-center justify-between">
        <span className="truncate max-w-[50%]">🪙 {vm.tossText || "TOSS PENDING"}</span>
        <span className="text-cyan-400 font-bold uppercase truncate max-w-[48%] text-right">
          📍 {activeMatch?.venue || vm.venueText || "LIVE MATCH"}
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
      case "STANDINGS":
        return stageOrGroup ? `GROUP ${stageOrGroup.toUpperCase()} POINTS` : "POINTS TABLE";
      case "FIXTURES":
        return "MATCH SCHEDULE";
      case "SPONSORS":
        return "";
      case "VS_INTRO":
        return `${vm.home?.shortCode || "HOME"} VS ${vm.away?.shortCode || "AWAY"}`;
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
      hideHeadline={variant === "SPONSORS"}
      sponsorTier={activeSponsorTier}
    >
      {variant === "SUMMARY" && (
        <SummaryVariant vm={vm} tournamentId={tournamentId} matchId={matchId} />
      )}
      {variant === "SCORECARD" && (
        <ScorecardVariant vm={vm} />
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
