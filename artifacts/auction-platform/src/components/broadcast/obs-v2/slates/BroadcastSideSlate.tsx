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

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { OBS_V2 } from "../obs-v2-tokens";
import { getScoringStandings, listScoringMatches } from "@/lib/scoring-api";
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

// ─── Width Configurations per Variant (Content-Driven 38%–54%) ──────────────

const VARIANT_WIDTHS: Record<BroadcastSideSlateVariant, { widthPx: number; widthPercent: string; label: string; kicker: string }> = {
  SUMMARY: { widthPx: 1040, widthPercent: "54%", label: "MATCH SUMMARY", kicker: "OFFICIAL MATCH VERDICT" },
  SCORECARD: { widthPx: 940, widthPercent: "49%", label: "SCORECARD", kicker: "LIVE INNINGS BREAKDOWN" },
  STANDINGS: { widthPx: 860, widthPercent: "45%", label: "POINTS TABLE", kicker: "TOURNAMENT STANDINGS" },
  FIXTURES: { widthPx: 800, widthPercent: "42%", label: "SESSION SCHEDULE", kicker: "UPCOMING FIXTURES" },
  SPONSORS: { widthPx: 760, widthPercent: "40%", label: "COMMERCIAL PARTNERS", kicker: "OFFICIAL SPONSOR SHOWCASE" },
  VS_INTRO: { widthPx: 880, widthPercent: "46%", label: "MATCH PREVIEW", kicker: "HEAD TO HEAD CLASH" },
};

// ─── Reusable Side Slate Shell ───────────────────────────────────────────────

interface SideSlateShellProps {
  variant: BroadcastSideSlateVariant;
  tournamentName: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
}

function SideSlateShell({
  variant,
  tournamentName,
  title,
  kicker,
  children,
}: SideSlateShellProps) {
  const config = VARIANT_WIDTHS[variant];

  return (
    <div
      className="absolute inset-x-0 pointer-events-none select-none flex items-center"
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
        key={`side-slate-${variant}`}
        initial={{ x: "-108%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "-108%", opacity: 0 }}
        transition={{
          duration: 0.32,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col overflow-hidden pointer-events-none"
        style={{
          width: `${config.widthPx}px`,
          maxWidth: "60%",
          height: "94%",
          maxHeight: `${OBS_V2.canvas.cameraHeight - 24}px`,
          background: "linear-gradient(180deg, rgba(8, 14, 28, 0.97) 0%, rgba(5, 8, 17, 0.98) 100%)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 215, 0, 0.3)",
          borderLeft: "3px solid #FFD700",
          borderTop: "2px solid rgba(255, 215, 0, 0.4)",
          borderRadius: "14px",
          boxShadow: "0 0 35px rgba(0, 0, 0, 0.85), 0 0 25px rgba(255, 215, 0, 0.15)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ── 1. Top Sub-Masthead Bar (46px) ── */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-2"
          style={{
            height: "46px",
            background: "linear-gradient(90deg, rgba(18, 28, 52, 0.95) 0%, rgba(10, 16, 32, 0.95) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Left: Real BidWar Logo Badge & Tournament Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 bg-[#FFD700] text-black px-2 py-0.5 rounded font-black text-[11px] uppercase tracking-wider shrink-0 shadow-sm">
              <img
                src="/assets/broadcast/bidwar-obs-crest-badge.png"
                alt="BidWar"
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes("bidwar-reverse-logo-official")) {
                    target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                  }
                }}
              />
              <span>BIDWAR</span>
            </div>
            <span className="text-slate-300 text-xs font-bold tracking-wide uppercase truncate">
              {tournamentName || "CRICKET BROADCAST"}
            </span>
          </div>

          {/* Right: Slate Tag Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse" />
            <span className="text-[#FFD700] font-mono font-black text-[11px] uppercase tracking-[0.16em]">
              {config.label}
            </span>
          </div>
        </div>

        {/* ── 2. Headline Strip ── */}
        <div
          className="px-5 py-2.5 shrink-0 flex items-center justify-between"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">
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

        {/* ── 3. Content Viewport ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-5">
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
    <div className="flex-1 flex flex-col gap-3.5 overflow-hidden">
      {/* Result Badge */}
      <div
        className="p-3.5 rounded-xl border border-amber-400/30 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(18, 207, 255, 0.05) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏆</span>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] block">
              MATCH RESULT
            </span>
            <span className="text-lg font-black italic text-white uppercase">
              {resultText}
            </span>
          </div>
        </div>
        {vm.venueText && (
          <span className="text-xs font-semibold text-slate-300">
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
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <span className="font-bold text-xs text-white uppercase truncate">
              {homeTeam?.name || "1ST INNINGS"}
            </span>
            <span className="font-mono text-lg font-black text-[#FFD700]">
              {vm.runs}-{vm.wickets}
            </span>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>OVERS: <strong className="text-white">{vm.oversLabel}</strong></span>
            <span>CRR: <strong className="text-cyan-400">{vm.crr ?? "0.00"}</strong></span>
          </div>
        </div>

        {/* Chasing Inning */}
        <div
          className="p-3.5 rounded-xl border border-white/10 flex flex-col justify-between"
          style={{ background: "rgba(255, 255, 255, 0.03)" }}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <span className="font-bold text-xs text-white uppercase truncate">
              {awayTeam?.name || "2ND INNINGS"}
            </span>
            <span className="font-mono text-lg font-black text-cyan-400">
              {vm.target != null ? `${vm.target - 1}` : "—"}
            </span>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>TARGET: <strong className="text-amber-300">{vm.target != null ? `${vm.target} RUNS` : "N/A"}</strong></span>
            <span>STATUS: <strong className="text-emerald-400 uppercase">{vm.phase}</strong></span>
          </div>
        </div>
      </div>

      {/* Key Performers Strip */}
      <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
        {/* Top Batters */}
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] pb-1.5 border-b border-white/10 mb-2">
            TOP BATTERS
          </span>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {[vm.striker, vm.nonStriker].map((b, i) =>
              b ? (
                <div key={i} className="flex items-center justify-between text-xs">
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
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 pb-1.5 border-b border-white/10 mb-2">
            KEY BOWLER
          </span>
          {vm.bowler ? (
            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <span className="font-bold text-white block">{vm.bowler.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">Econ: {vm.bowler.economy?.toFixed(2)}</span>
              </div>
              <span className="font-mono text-base font-black text-rose-400">
                {vm.bowler.wickets}-{vm.bowler.runsConceded}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 pt-2">No bowler spell active</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. VARIANT: SCORECARD SLATE (49% Width) ─────────────────────────────────

function ScorecardVariant({ vm }: { vm: CricketObsViewModel }) {
  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-hidden">
      {/* Live Inning Score Banner */}
      <div
        className="p-3.5 rounded-xl border border-[#FFD700]/30 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(10, 16, 32, 0.8) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-black font-black flex items-center justify-center text-sm font-mono">
            {vm.batting?.shortCode || "BAT"}
          </div>
          <div>
            <span className="text-base font-black italic text-white uppercase block">
              {vm.batting?.name || "BATTING TEAM"}
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              {vm.phase.toUpperCase()} • CRR: {vm.crr ?? "0.00"}
            </span>
          </div>
        </div>
        <div className="text-right font-mono">
          <span className="text-3xl font-black text-[#FFD700] block drop-shadow-[0_0_10px_rgba(255,215,0,0.35)]">
            {vm.runs}-{vm.wickets}
          </span>
          <span className="text-xs text-slate-300">({vm.oversLabel} OV)</span>
        </div>
      </div>

      {/* Batters List */}
      <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] pb-1.5 border-b border-white/10 mb-2">
          CREASE BATTERS
        </span>
        <div className="space-y-2">
          {[vm.striker, vm.nonStriker].map((b, i) =>
            b ? (
              <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="font-bold text-white">
                  {b.name} {i === 0 && <span className="text-[#FFD700] font-black">*</span>}
                </span>
                <span className="font-mono text-sm font-black text-[#FFD700]">
                  {b.runs} <span className="text-xs text-slate-400 font-normal">({b.balls}b • 4s:{b.fours} 6s:{b.sixes})</span>
                </span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Bowler Details */}
      {vm.bowler && (
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block mb-0.5">
              ACTIVE BOWLER
            </span>
            <span className="font-bold text-white text-sm">{vm.bowler.name}</span>
            <span className="text-xs text-slate-400 font-mono block">Econ: {vm.bowler.economy?.toFixed(2)}</span>
          </div>
          <div className="text-right font-mono">
            <span className="text-2xl font-black text-rose-400 block">
              {vm.bowler.wickets}-{vm.bowler.runsConceded}
            </span>
            <span className="text-xs text-slate-400">({vm.bowler.overs} ov)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3. VARIANT: STANDINGS SLATE (Points Table Rows 45% Width) ────────────────

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {/* Table Header Strip */}
      <div
        className="grid grid-cols-12 items-center px-4 py-2 text-[10px] font-black tracking-widest uppercase text-slate-300 border-b border-[#FFD700]/40"
        style={{ background: "rgba(18, 28, 52, 0.9)" }}
      >
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6 pl-1">TEAM</div>
        <div className="col-span-1 text-center font-mono">P</div>
        <div className="col-span-1 text-center font-mono">W</div>
        <div className="col-span-1 text-center font-mono">L</div>
        <div className="col-span-2 text-right font-mono pr-1">PTS</div>
      </div>

      {/* Row Strips (Bornan-style clean rows) */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {rows && rows.length > 0 ? (
          rows.slice(0, 8).map((row, idx) => {
            const isTopZone = idx < 4;
            return (
              <div
                key={row.teamId}
                className="grid grid-cols-12 items-center px-4 py-2 text-xs transition-colors hover:bg-white/[0.04]"
                style={{
                  background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                }}
              >
                <div className="col-span-1 flex justify-center">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] ${
                      isTopZone ? "bg-[#FFD700] text-black" : "bg-white/10 text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </div>
                <div className="col-span-6 pl-1 font-bold text-white uppercase truncate">
                  {row.teamName} <span className="text-[#FFD700] font-mono text-[10px]">({row.shortCode})</span>
                </div>
                <div className="col-span-1 text-center font-mono text-slate-300">{row.played}</div>
                <div className="col-span-1 text-center font-mono font-bold text-emerald-400">{row.won}</div>
                <div className="col-span-1 text-center font-mono text-rose-400">{row.lost}</div>
                <div className="col-span-2 text-right font-mono font-black text-sm text-[#FFD700] pr-1">
                  {row.points}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            No standings data available.
          </div>
        )}
      </div>

      {/* Footer Tag */}
      <div className="px-4 py-1.5 border-t border-white/10 bg-black/40 text-[10px] text-slate-400 flex justify-between">
        <span>TOP 4 ADVANCE TO PLAYOFFS</span>
        <span className="font-mono">LIVE SYNCED</span>
      </div>
    </div>
  );
}

// ─── 4. VARIANT: FIXTURES SLATE (Session Schedule 42% Width) ─────────────────

function FixturesVariant({ tournamentId }: { tournamentId?: number }) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId || 0),
    enabled: !!tournamentId && tournamentId > 0,
    staleTime: 30_000,
  });

  const upcoming = useMemo(
    () => (matches || []).filter((m) => m.status !== "completed").slice(0, 4),
    [matches],
  );

  return (
    <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto">
      {upcoming.length > 0 ? (
        upcoming.map((m: any, i) => (
          <div
            key={m.id || i}
            className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col gap-1.5"
          >
            {/* Header: Match # and Venue */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-white/5 pb-1">
              <span className="text-[#FFD700] font-bold">
                {m.roundName || `MATCH #${m.tournamentMatchNumber ?? m.id}`}
              </span>
              <span>{m.venue ? `📍 ${m.venue}` : "SESSION SCHEDULE"}</span>
            </div>

            {/* Teams Line */}
            <div className="flex items-center justify-between py-1">
              <span className="font-bold text-sm text-white uppercase truncate max-w-[42%]">
                {m.homeTeam?.name || "HOME TEAM"}
              </span>
              <span className="font-black italic text-[#FFD700] text-xs px-2 py-0.5 rounded bg-black/40 border border-white/10">
                VS
              </span>
              <span className="font-bold text-sm text-white uppercase truncate max-w-[42%] text-right">
                {m.awayTeam?.name || "AWAY TEAM"}
              </span>
            </div>

            {/* Time / Status */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5 font-mono text-slate-300">
              <span>
                {m.scheduledAt
                  ? new Date(m.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                  : "SCHEDULED"}
              </span>
              <span className="text-amber-400 font-bold uppercase text-[10px]">
                {m.status || "UPCOMING"}
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center text-xs text-slate-400">
          No upcoming fixtures scheduled.
        </div>
      )}
    </div>
  );
}

// ─── 5. VARIANT: SPONSORS SLATE (Partner Grid 40% Width) ─────────────────────

function SponsorsVariant({
  sponsors,
  sponsorName,
}: {
  sponsors?: BidWarSponsorLogo[];
  sponsorName?: string;
}) {
  const targeted = useMemo(() => {
    if (!sponsorName || sponsorName === "all" || !sponsors) return null;
    return sponsors.find((s) => s.name?.toLowerCase().trim() === sponsorName.toLowerCase().trim()) ?? null;
  }, [sponsorName, sponsors]);

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
      {targeted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border border-amber-400/30 bg-amber-500/5 text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-3">
            {targeted.isTitleSponsor ? "TITLE SPONSOR" : "OFFICIAL PARTNER"}
          </span>
          {targeted.url && (
            <img src={targeted.url} alt="" className="max-h-24 max-w-full object-contain mb-3" />
          )}
          <h3 className="text-2xl font-black italic text-white uppercase">{targeted.name}</h3>
        </div>
      ) : sponsors && sponsors.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {sponsors.slice(0, 6).map((sp, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center h-28"
            >
              {sp.url ? (
                <img src={sp.url} alt="" className="max-h-12 max-w-full object-contain mb-1.5" />
              ) : (
                <span className="text-xl font-bold text-amber-400">{sp.name?.slice(0, 2)}</span>
              )}
              <span className="font-bold text-xs text-white uppercase truncate w-full">
                {sp.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-400">
          No sponsor showcase configured.
        </div>
      )}
    </div>
  );
}

// ─── 6. VARIANT: VS INTRO SLATE (Head-to-Head 46% Width) ─────────────────────

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
    <div className="flex-1 flex flex-col justify-between py-2">
      {/* Team vs Team Badges */}
      <div className="flex items-center justify-around py-4">
        <div className="flex flex-col items-center gap-2 max-w-[140px] text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center font-black text-2xl text-white">
            {homeTeam?.logoUrl ? (
              <img src={homeTeam.logoUrl} alt="" className="max-h-14 max-w-14 object-contain" />
            ) : (
              homeTeam?.shortCode || "HOME"
            )}
          </div>
          <span className="font-bold text-sm text-white uppercase truncate w-full">
            {homeTeam?.name || "HOME SQUAD"}
          </span>
        </div>

        <span className="text-4xl font-black italic text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
          VS
        </span>

        <div className="flex flex-col items-center gap-2 max-w-[140px] text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center font-black text-2xl text-cyan-400">
            {awayTeam?.logoUrl ? (
              <img src={awayTeam.logoUrl} alt="" className="max-h-14 max-w-14 object-contain" />
            ) : (
              awayTeam?.shortCode || "AWAY"
            )}
          </div>
          <span className="font-bold text-sm text-white uppercase truncate w-full">
            {awayTeam?.name || "AWAY SQUAD"}
          </span>
        </div>
      </div>

      {/* Toss & Conditions Strip */}
      <div className="p-3 rounded-xl border border-white/10 bg-black/40 text-xs text-slate-300 font-mono flex items-center justify-between">
        <span>🪙 {vm.tossText || "TOSS PENDING"}</span>
        <span className="text-cyan-400 font-bold uppercase">{activeMatch?.venue || "MATCH LIVE"}</span>
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
  const config = VARIANT_WIDTHS[variant];

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
        return sponsorName ? `PARTNER · ${sponsorName.toUpperCase()}` : "OFFICIAL SPONSORS";
      case "VS_INTRO":
        return `${vm.home?.shortCode || "HOME"} VS ${vm.away?.shortCode || "AWAY"}`;
    }
  }, [variant, vm, stageOrGroup, sponsorName]);

  return (
    <SideSlateShell
      variant={variant}
      tournamentName={vm.tournamentName || "BIDWAR CRICKET"}
      title={title}
      kicker={config.kicker}
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
        <FixturesVariant tournamentId={tournamentId} />
      )}
      {variant === "SPONSORS" && (
        <SponsorsVariant sponsors={vm.sponsors} sponsorName={sponsorName} />
      )}
      {variant === "VS_INTRO" && (
        <VsIntroVariant vm={vm} tournamentId={tournamentId} matchId={matchId} />
      )}
    </SideSlateShell>
  );
}
