/**
 * MidScreenSlatesV2 — All 6 V2 Mid-Screen Broadcast Slates
 *
 * Slates:
 * 1. SponsorSlateV2 — Sponsor showcase (hero spotlight + partner grid)
 * 2. StandingsSlateV2 — Tournament points table / group rankings
 * 3. FixturesSlateV2 — Upcoming matches broadcast schedule
 * 4. ScorecardSlateV2 — Live innings breakdown (batters & bowling figures)
 * 5. SummarySlateV2 — Post-match result presentation & top performers
 * 6. VsIntroSlateV2 — Cinematic pre-match VS clash presentation
 *
 * Visual Design: LOVABLE V2 DESIGN SYSTEM
 * - Deep navy obsidian gradients (#070B14 to #0F172A)
 * - 3px glowing electric gold rails (#FFD700) with cyan accents (#12CFFF)
 * - Barlow Condensed display typography with bold italic headlines
 * - JetBrains Mono for all numeric statistics and ratings
 * - High-contrast glassmorphism cards with chamfered geometry
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getScoringStandings, listScoringMatches } from "@/lib/scoring-api";
import type { CricketObsViewModel, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";
import { SlateShell, SlateHeading, SlateEmptyState } from "./SlateShell";

// ─── Sponsor type normalization ──────────────────────────────────────────────

type NormalizedSponsor = {
  id: string;
  name: string;
  logoUrl?: string;
  label?: string;
  tier?: "title" | "associate";
};

function normalizeVmSponsors(sponsors: BidWarSponsorLogo[]): NormalizedSponsor[] {
  if (!sponsors || sponsors.length === 0) return [];
  return sponsors.map((s, idx) => ({
    id: s.publicId || `sp-${idx}`,
    name: s.name || s.type || `Sponsor ${idx + 1}`,
    logoUrl: s.url || undefined,
    tier: s.isTitleSponsor ? "title" : "associate",
    label: s.isTitleSponsor
      ? "TITLE SPONSOR"
      : s.isCoSponsor
        ? "CO-SPONSOR"
        : "OFFICIAL PARTNER",
  }));
}

// ─── Universal V2 Broadcast Panel ───────────────────────────────────────────

function V2Panel({
  children,
  highlight = false,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: highlight
          ? "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.98) 100%)"
          : "linear-gradient(180deg, rgba(20, 27, 45, 0.85) 0%, rgba(10, 15, 28, 0.95) 100%)",
        border: `1px solid ${highlight ? "rgba(255, 215, 0, 0.45)" : "rgba(255, 255, 255, 0.1)"}`,
        borderTop: highlight ? "3px solid #FFD700" : "2px solid rgba(255, 255, 255, 0.15)",
        boxShadow: highlight
          ? "0 0 24px rgba(255, 215, 0, 0.22), 0 12px 30px rgba(0, 0, 0, 0.6)"
          : "0 10px 30px rgba(0, 0, 0, 0.5)",
        padding: "20px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── 1. SPONSOR SLATE ────────────────────────────────────────────────────────

export function SponsorSlateV2({
  vm,
  sponsorName,
}: {
  vm: CricketObsViewModel;
  sponsorName?: string | null;
}) {
  const normalizedSponsors = useMemo(() => normalizeVmSponsors(vm.sponsors || []), [vm.sponsors]);

  const targetedSponsor = useMemo(() => {
    if (!sponsorName || sponsorName === "all" || normalizedSponsors.length === 0) return null;
    return (
      normalizedSponsors.find(
        (s) => s.name?.toLowerCase().trim() === sponsorName.toLowerCase().trim(),
      ) ?? null
    );
  }, [sponsorName, normalizedSponsors]);

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Sponsors">
      <SlateHeading
        kicker={targetedSponsor ? "OFFICIAL PARTNER SPOTLIGHT" : "COMMERCIAL SPOTLIGHT"}
        title={targetedSponsor ? targetedSponsor.name || "PARTNER" : "OFFICIAL TOURNAMENT PARTNERS"}
      />

      {/* Single focused sponsor hero */}
      {targetedSponsor ? (
        <div className="flex-1 flex items-center justify-center">
          <V2Panel highlight className="max-w-2xl w-full p-8 sm:p-10 flex flex-col items-center">
            <span
              className="px-4 py-1 text-xs font-black uppercase tracking-[0.2em] rounded-full mb-6"
              style={{
                background: "rgba(255, 215, 0, 0.15)",
                color: "#FFD700",
                border: "1px solid rgba(255, 215, 0, 0.4)",
              }}
            >
              {targetedSponsor.label ?? (targetedSponsor.tier === "title" ? "TITLE SPONSOR" : "OFFICIAL PARTNER")}
            </span>

            {targetedSponsor.logoUrl && (
              <div
                className="w-full flex items-center justify-center p-6 rounded-xl my-4"
                style={{
                  height: 180,
                  background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.4) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <img
                  src={targetedSponsor.logoUrl}
                  alt={targetedSponsor.name || ""}
                  className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
                />
              </div>
            )}

            <h3 className="text-3xl sm:text-4xl font-black italic tracking-wide text-white uppercase mt-4 text-center">
              {targetedSponsor.name}
            </h3>
            <p className="text-sm font-semibold tracking-widest text-[#FFD700] uppercase mt-1">
              PROUD PARTNER OF {vm.tournamentName || "THE TOURNAMENT"}
            </p>
          </V2Panel>
        </div>
      ) : normalizedSponsors.length > 0 ? (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 overflow-y-auto pb-4">
          {normalizedSponsors.map((sp, idx) => {
            const isTitle = sp.tier === "title";
            return (
              <V2Panel
                key={idx}
                highlight={isTitle}
                className="flex flex-col items-center justify-between min-h-[220px] transition-all hover:scale-[1.02]"
              >
                <span
                  className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md"
                  style={{
                    background: isTitle ? "rgba(255, 215, 0, 0.15)" : "rgba(18, 207, 255, 0.12)",
                    color: isTitle ? "#FFD700" : "#12CFFF",
                    border: `1px solid ${isTitle ? "rgba(255, 215, 0, 0.3)" : "rgba(18, 207, 255, 0.25)"}`,
                  }}
                >
                  {sp.label ?? (isTitle ? "TITLE SPONSOR" : "OFFICIAL PARTNER")}
                </span>

                <div className="w-full flex-1 flex items-center justify-center p-3 my-2">
                  {sp.logoUrl ? (
                    <img
                      src={sp.logoUrl}
                      alt={sp.name || ""}
                      className="max-h-24 max-w-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black text-amber-400">
                      {sp.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="text-center w-full pt-2 border-t border-white/10">
                  <p className="text-base font-bold text-white tracking-wide uppercase truncate">
                    {sp.name || "Sponsor"}
                  </p>
                </div>
              </V2Panel>
            );
          })}
        </div>
      ) : (
        <SlateEmptyState message="No sponsor showcase data configured for this tournament." />
      )}
    </SlateShell>
  );
}

// ─── 2. STANDINGS SLATE ───────────────────────────────────────────────────────

export function StandingsSlateV2({
  vm,
  tournamentId,
  stageOrGroup,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  stageOrGroup?: string | null;
}) {
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0,
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

  const tableTitle = matchedGroup
    ? `GROUP ${matchedGroup.name.toUpperCase()} STANDINGS`
    : "TOURNAMENT POINTS TABLE";

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Standings">
      <SlateHeading
        kicker={matchedGroup ? `${matchedGroup.name.toUpperCase()} RANKINGS` : "OFFICIAL POINTS TABLE"}
        title={tableTitle}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <V2Panel className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Table Header */}
          <div
            className="grid grid-cols-12 items-center px-6 py-3.5 text-xs font-bold tracking-[0.16em] uppercase text-slate-300 border-b-2 border-[#FFD700]"
            style={{
              background: "linear-gradient(90deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)",
            }}
          >
            <div className="col-span-1 text-center">POS</div>
            <div className="col-span-5 pl-2">TEAM</div>
            <div className="col-span-1 text-center font-mono">P</div>
            <div className="col-span-1 text-center font-mono">W</div>
            <div className="col-span-1 text-center font-mono">L</div>
            <div className="col-span-2 text-center font-mono">NRR</div>
            <div className="col-span-1 text-right font-mono pr-2">PTS</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {rows && rows.length > 0 ? (
              rows.map((row, idx) => {
                const isPlayoffZone = idx < 4;
                return (
                  <div
                    key={row.teamId}
                    className="grid grid-cols-12 items-center px-6 py-3 transition-colors hover:bg-white/[0.04]"
                    style={{
                      background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    {/* Position */}
                    <div className="col-span-1 flex justify-center">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs"
                        style={{
                          background: isPlayoffZone
                            ? "linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)"
                            : "rgba(255, 255, 255, 0.1)",
                          color: isPlayoffZone ? "#0C0C10" : "#F8FAFC",
                          boxShadow: isPlayoffZone ? "0 0 12px rgba(255, 215, 0, 0.35)" : "none",
                        }}
                      >
                        {idx + 1}
                      </span>
                    </div>

                    {/* Team info */}
                    <div className="col-span-5 flex items-center gap-3 pl-2 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/20"
                        style={{
                          backgroundColor:
                            idx === 0
                              ? "#FFD700"
                              : idx === 1
                                ? "#12CFFF"
                                : idx === 2
                                  ? "#10B981"
                                  : "#94A3B8",
                        }}
                      />
                      <span className="font-bold text-base text-white uppercase tracking-wide truncate">
                        {row.teamName}
                      </span>
                      <span className="font-mono text-xs font-semibold text-amber-400 shrink-0">
                        ({row.shortCode})
                      </span>
                    </div>

                    {/* Matches Played */}
                    <div className="col-span-1 text-center font-mono font-bold text-slate-300 text-sm">
                      {row.played}
                    </div>

                    {/* Won */}
                    <div className="col-span-1 text-center font-mono font-black text-emerald-400 text-sm">
                      {row.won}
                    </div>

                    {/* Lost */}
                    <div className="col-span-1 text-center font-mono font-semibold text-rose-400 text-sm">
                      {row.lost}
                    </div>

                    {/* Net Run Rate */}
                    <div className="col-span-2 text-center font-mono font-semibold text-slate-200 text-sm">
                      {row.netRunRate != null ? (
                        <span className={row.netRunRate >= 0 ? "text-cyan-300" : "text-rose-400"}>
                          {row.netRunRate > 0 ? `+${row.netRunRate.toFixed(3)}` : row.netRunRate.toFixed(3)}
                        </span>
                      ) : (
                        "0.000"
                      )}
                    </div>

                    {/* Points */}
                    <div className="col-span-1 text-right font-mono font-black text-xl text-[#FFD700] pr-2 drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                      {row.points}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-400 font-semibold tracking-wide">
                No standings data calculated for this tournament yet.
              </div>
            )}
          </div>

          {/* Table Footer Banner */}
          <div
            className="px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 border-t border-white/10"
            style={{ background: "rgba(10, 15, 28, 0.95)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFD700]" />
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Top 4 Teams Qualify For Knockout Playoff Stage
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Auto-Synced Live from Match Results
            </div>
          </div>
        </V2Panel>
      </div>
    </SlateShell>
  );
}

// ─── 3. FIXTURES SLATE ────────────────────────────────────────────────────────

export function FixturesSlateV2({
  vm,
  tournamentId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const upcoming = useMemo(
    () => (matches || []).filter((m) => m.status !== "completed").slice(0, 4),
    [matches],
  );

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Fixtures">
      <SlateHeading kicker="TOURNAMENT SCHEDULE" title="UPCOMING MATCHES" />

      {upcoming.length > 0 ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pb-4">
          {upcoming.map((m: any) => (
            <V2Panel key={m.id} className="flex flex-col justify-between min-h-[220px]">
              {/* Fixture Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
                  {m.roundName || `MATCH #${m.tournamentMatchNumber ?? m.id}`}
                </span>
                {m.venue && (
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    📍 {m.venue}
                  </span>
                )}
              </div>

              {/* Clash Layout */}
              <div className="flex items-center justify-around py-4">
                {/* Home Team */}
                <div className="flex flex-col items-center gap-1.5 max-w-[160px] text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center font-black text-xl text-white shadow-inner">
                    {m.homeTeam?.logoUrl ? (
                      <img
                        src={m.homeTeam.logoUrl}
                        alt=""
                        className="max-h-10 max-w-10 object-contain"
                      />
                    ) : (
                      m.homeTeam?.shortCode || "HOME"
                    )}
                  </div>
                  <span className="font-bold text-sm text-white uppercase tracking-wide line-clamp-1">
                    {m.homeTeam?.name || "Home Team"}
                  </span>
                </div>

                {/* VS Emblem */}
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black italic text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.4)]">
                    VS
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mt-0.5">
                    {m.rules?.overs ? `${m.rules.overs} OVERS` : "T20"}
                  </span>
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-1.5 max-w-[160px] text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center font-black text-xl text-white shadow-inner">
                    {m.awayTeam?.logoUrl ? (
                      <img
                        src={m.awayTeam.logoUrl}
                        alt=""
                        className="max-h-10 max-w-10 object-contain"
                      />
                    ) : (
                      m.awayTeam?.shortCode || "AWAY"
                    )}
                  </div>
                  <span className="font-bold text-sm text-white uppercase tracking-wide line-clamp-1">
                    {m.awayTeam?.name || "Away Team"}
                  </span>
                </div>
              </div>

              {/* Fixture Footer */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-300">
                  {m.scheduledAt
                    ? new Date(m.scheduledAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "DATE & TIME TBD"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {m.status || "SCHEDULED"}
                </span>
              </div>
            </V2Panel>
          ))}
        </div>
      ) : (
        <SlateEmptyState message="No upcoming fixtures currently scheduled." />
      )}
    </SlateShell>
  );
}

// ─── 4. SCORECARD SLATE ───────────────────────────────────────────────────────

export function ScorecardSlateV2({ vm }: { vm: CricketObsViewModel }) {
  const isChase = vm.phase === "chase";

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Scorecard">
      <SlateHeading
        kicker="LIVE MATCH INNINGS"
        title={`${vm.batting?.name || "CURRENT INNINGS"} SCORECARD`}
      />

      <div className="flex-1 flex flex-col gap-5 overflow-hidden">
        {/* Batting Team Banner */}
        <V2Panel highlight className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD700]/15 border-2 border-[#FFD700] flex items-center justify-center font-black text-2xl text-[#FFD700] shadow-md">
              {vm.batting?.shortCode || "BAT"}
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-wide text-white uppercase">
                {vm.batting?.name || "BATTING TEAM"}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mt-0.5">
                <span className="text-[#FFD700] uppercase">{vm.phase}</span>
                <span>•</span>
                <span>{vm.tournamentName}</span>
                {isChase && vm.target != null && (
                  <>
                    <span>•</span>
                    <span className="text-cyan-400">TARGET: {vm.target}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-4 self-start sm:self-auto">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black italic text-[#FFD700] font-mono drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                {vm.runs}-{vm.wickets}
              </span>
              <span className="text-2xl font-bold text-slate-300 font-mono">
                ({vm.oversLabel} OV)
              </span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">CRR</span>
              <span className="text-base font-black text-cyan-400 font-mono">
                {vm.crr ?? "0.00"}
              </span>
            </div>
          </div>
        </V2Panel>

        {/* Dual Tables: Batters & Bowler */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-hidden">
          {/* Batters Breakdown */}
          <V2Panel className="flex flex-col p-0 overflow-hidden">
            <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-black tracking-widest text-[#FFD700] uppercase">
              <span>ACTIVE BATTERS</span>
              <span>RUNS (BALLS)</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[vm.striker, vm.nonStriker].map((batter, idx) => {
                if (!batter) return null;
                const isStriker = idx === 0;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{isStriker ? "🏏" : "🛡️"}</span>
                      <div>
                        <span className="font-bold text-white text-base block">
                          {batter.name} {isStriker && <span className="text-[#FFD700]">*</span>}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          SR: {batter.strikeRate ?? "0.0"} • 4s: {batter.fours ?? 0} • 6s: {batter.sixes ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-2xl font-black text-[#FFD700] block">
                        {batter.runs}
                      </span>
                      <span className="text-xs text-slate-400">({batter.balls}b)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </V2Panel>

          {/* Bowler Breakdown */}
          <V2Panel className="flex flex-col p-0 overflow-hidden">
            <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-black tracking-widest text-cyan-400 uppercase">
              <span>CURRENT BOWLER</span>
              <span>FIGURES</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center">
              {vm.bowler ? (
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-lg block">
                        ⚾ {vm.bowler.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Econ: {vm.bowler.economy?.toFixed(2) ?? "0.00"}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-3xl font-black text-rose-400 block">
                        {vm.bowler.wickets}-{vm.bowler.runsConceded}
                      </span>
                      <span className="text-xs text-slate-300">({vm.bowler.overs} ov)</span>
                    </div>
                  </div>

                  {vm.bowler.maidens > 0 && (
                    <div className="pt-2 border-t border-white/10 text-xs text-emerald-400 font-mono font-bold">
                      Maiden Overs: {vm.bowler.maidens}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 font-semibold tracking-wide">
                  Waiting for active bowler assignment...
                </div>
              )}
            </div>
          </V2Panel>
        </div>
      </div>
    </SlateShell>
  );
}

// ─── 5. SUMMARY SLATE ────────────────────────────────────────────────────────

export function SummarySlateV2({
  vm,
  tournamentId,
  overlayMatchId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  overlayMatchId?: number | null;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [overlayMatchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;

  const resultText =
    (activeMatch as any)?.resultSummary ||
    vm.resultHeadline ||
    vm.resultText ||
    "MATCH IN PROGRESS";

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Summary">
      <SlateHeading
        kicker={
          activeMatch
            ? `MATCH #${activeMatch.tournamentMatchNumber ?? activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}`
            : "OFFICIAL MATCH VERDICT"
        }
        title="MATCH SUMMARY"
      />

      <div className="flex-1 flex flex-col justify-between gap-5 overflow-hidden">
        {/* Two team comparison cards */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
          {/* Team 1 / Home Card */}
          <V2Panel highlight className="flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xl font-black italic tracking-wide text-white uppercase truncate">
                {homeTeam?.name || "HOME TEAM"}
              </span>
              <span className="font-mono text-2xl font-black text-[#FFD700]">
                {vm.runs}-{vm.wickets}
              </span>
            </div>

            <div className="py-4 space-y-2">
              <span className="text-[11px] font-black tracking-widest text-[#FFD700] uppercase block">
                TOP BATTERS
              </span>
              {[vm.striker, vm.nonStriker].map((batter, idx) =>
                batter ? (
                  <div key={idx} className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-white">{batter.name}</span>
                    <span className="text-[#FFD700] font-mono font-bold">
                      {batter.runs} ({batter.balls}b)
                    </span>
                  </div>
                ) : null,
              )}
            </div>

            <div className="pt-3 border-t border-white/10 text-xs text-slate-300 font-mono">
              Overs: {vm.oversLabel} • CRR: {vm.crr ?? "0.00"}
            </div>
          </V2Panel>

          {/* Team 2 / Away Card */}
          <V2Panel className="flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xl font-black italic tracking-wide text-white uppercase truncate">
                {awayTeam?.name || "AWAY TEAM"}
              </span>
              <span className="font-mono text-2xl font-black text-cyan-400">
                {vm.target != null ? `${vm.target - 1}` : "—"}
              </span>
            </div>

            <div className="py-4 space-y-2">
              <span className="text-[11px] font-black tracking-widest text-cyan-400 uppercase block">
                KEY BOWLERS
              </span>
              {vm.bowler ? (
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-white">{vm.bowler.name}</span>
                  <span className="text-rose-400 font-mono font-bold">
                    {vm.bowler.wickets}-{vm.bowler.runsConceded} ({vm.bowler.overs} ov)
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Bowling figures synced live</div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10 text-xs text-slate-300 font-mono">
              Innings Complete
            </div>
          </V2Panel>
        </div>

        {/* Victory Verdict Banner */}
        <V2Panel highlight className="p-4 sm:p-5 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-xs font-black tracking-widest text-[#FFD700] uppercase mb-1">
            <span>🏆</span>
            <span>OFFICIAL RESULT</span>
            <span>🏆</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black italic tracking-wider text-white uppercase drop-shadow-[0_0_15px_rgba(255,215,0,0.35)]">
            {resultText}
          </h2>
        </V2Panel>
      </div>
    </SlateShell>
  );
}

// ─── 6. VS INTRO SLATE ───────────────────────────────────────────────────────

export function VsIntroSlateV2({
  vm,
  tournamentId,
  overlayMatchId,
}: {
  vm: CricketObsViewModel;
  tournamentId: number;
  overlayMatchId?: number | null;
}) {
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });

  const activeMatch = useMemo(() => {
    if (overlayMatchId && matches && matches.length > 0) {
      const found = matches.find((m) => m.id === overlayMatchId);
      if (found) return found as any;
    }
    return matches && matches.length > 0 ? (matches[0] as any) : null;
  }, [overlayMatchId, matches]);

  const homeTeam = activeMatch?.homeTeam || vm.home;
  const awayTeam = activeMatch?.awayTeam || vm.away;

  return (
    <SlateShell tournamentName={vm.tournamentName || ""} slateTitle="Match Intro">
      <SlateHeading
        kicker={
          activeMatch
            ? `MATCH #${activeMatch.tournamentMatchNumber ?? activeMatch.id}${activeMatch.roundName ? ` · ${activeMatch.roundName.toUpperCase()}` : ""}`
            : "CINEMATIC MATCH INTRO"
        }
        title={`${homeTeam?.name || "HOME"} VS ${awayTeam?.name || "AWAY"}`}
      />

      <div className="flex-1 flex flex-col justify-between py-6">
        {/* Massive VS Clash Row */}
        <div className="flex-1 flex items-center justify-center gap-12 sm:gap-20">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div
              className="w-44 h-44 rounded-3xl p-5 flex items-center justify-center"
              style={{
                background: "radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)",
                border: "2px solid rgba(255, 215, 0, 0.4)",
                boxShadow: "0 0 35px rgba(255, 215, 0, 0.25)",
              }}
            >
              {homeTeam?.logoUrl ? (
                <img
                  src={homeTeam.logoUrl}
                  alt={homeTeam.name || ""}
                  className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)]"
                />
              ) : (
                <span className="text-6xl font-black italic text-[#FFD700]">
                  {homeTeam?.shortCode || "H"}
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black italic text-white uppercase tracking-wide">
              {homeTeam?.name || "Home Team"}
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25">
              HOME SQUAD
            </span>
          </div>

          {/* Center VS Emblem */}
          <div className="flex flex-col items-center">
            <span
              className="text-7xl sm:text-8xl font-black italic text-[#FFD700]"
              style={{
                filter: "drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))",
                transform: "skewX(-10deg)",
              }}
            >
              VS
            </span>
            <div className="h-1 w-20 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent my-2" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              {activeMatch?.venue ? `AT ${activeMatch.venue.toUpperCase()}` : "LIVE CRICKET"}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div
              className="w-44 h-44 rounded-3xl p-5 flex items-center justify-center"
              style={{
                background: "radial-gradient(circle, rgba(18, 207, 255, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)",
                border: "2px solid rgba(18, 207, 255, 0.4)",
                boxShadow: "0 0 35px rgba(18, 207, 255, 0.25)",
              }}
            >
              {awayTeam?.logoUrl ? (
                <img
                  src={awayTeam.logoUrl}
                  alt={awayTeam.name || ""}
                  className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)]"
                />
              ) : (
                <span className="text-6xl font-black italic text-cyan-400">
                  {awayTeam?.shortCode || "A"}
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black italic text-white uppercase tracking-wide">
              {awayTeam?.name || "Away Team"}
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25">
              CHALLENGER
            </span>
          </div>
        </div>

        {/* Bottom Pre-match telemetry bar */}
        <V2Panel className="p-3.5 flex items-center justify-around text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-[#FFD700]">🪙 TOSS:</span>
            <span>{vm.tossText || "TOSS PENDING"}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">⚡ CONDITIONS:</span>
            <span>PITCH LIVE • CLEAR WEATHER</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">📺 BROADCAST:</span>
            <span>1920×1080 ULTRA HD 60FPS</span>
          </div>
        </V2Panel>
      </div>
    </SlateShell>
  );
}

// ─── MidScreenSlatesV2 — Composite Router ────────────────────────────────────

export function MidScreenSlatesV2({
  vm,
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
}: {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
}) {
  if (overlay === "none" || overlay === "neutral") return null;

  return (
    <AnimatePresence mode="wait">
      {overlay === "sponsors" && (
        <SponsorSlateV2 key="sponsors" vm={vm} sponsorName={overlaySponsorName} />
      )}
      {overlay === "standings" && (
        <StandingsSlateV2 key="standings" vm={vm} tournamentId={tournamentId} stageOrGroup={overlayStageOrGroup} />
      )}
      {overlay === "fixtures" && (
        <FixturesSlateV2 key="fixtures" vm={vm} tournamentId={tournamentId} />
      )}
      {overlay === "scorecard" && (
        <ScorecardSlateV2 key="scorecard" vm={vm} />
      )}
      {overlay === "summary" && (
        <SummarySlateV2 key="summary" vm={vm} tournamentId={tournamentId} overlayMatchId={overlayMatchId} />
      )}
      {overlay === "intro" && (
        <VsIntroSlateV2 key="intro" vm={vm} tournamentId={tournamentId} overlayMatchId={overlayMatchId} />
      )}
    </AnimatePresence>
  );
}
