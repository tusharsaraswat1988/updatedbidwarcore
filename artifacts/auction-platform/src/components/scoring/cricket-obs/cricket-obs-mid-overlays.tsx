/**
 * Cricket OBS Full-Screen Broadcast Slates (1920×1080)
 * Replaces modal dialogs with native television graphics slates:
 * 1. Sponsors Wall (3-Tier Hierarchical Inventory)
 * 2. Points Table (Television Standings Slate)
 * 3. Fixtures (Broadcast Match Schedule)
 * 4. Full Scorecard (Tabular Innings Breakdown)
 * 5. Match Summary (Result & Top Performers)
 * 6. Match Intro / VS (Cinematic Clash Slate)
 *
 * Absolutely NO "✕ HIDE" buttons. Zero web-card nesting. 100% Broadcast Typography.
 */

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getScoringStandings, listScoringMatches } from "@/lib/scoring-api";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_INSET,
} from "@/lib/bidwar-broadcast-colors";
import {
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
} from "@/lib/broadcast-overlay";
import type { CricketObsViewModel, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

type Props = {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  tournamentId: number;
};

export function CricketObsMidOverlays({ vm, overlay, tournamentId }: Props) {
  // Standings query
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
  });

  // Fixtures query
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: (overlay === "fixtures" || overlay === "intro") && tournamentId > 0,
    staleTime: 30_000,
  });

  if (overlay === "none") return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex h-full w-full flex-col overflow-hidden"
          style={{
            background: "rgba(5, 5, 8, 0.92)",
            fontFamily: BROADCAST_FONTS.body,
          }}
        >
          {/* Masthead Header Band (60px) */}
          <div
            className="flex h-[60px] items-center justify-between border-b border-white/10"
            style={{
              background: BIDWAR_SCOREBOARD_SHELL,
              paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
              paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
            }}
          >
            <div className="flex items-center gap-4">
              <span
                className="text-2xl font-normal uppercase tracking-wider text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.08em" }}
              >
                BIDWAR BROADCAST
              </span>
              <span className="text-white/30">/</span>
              <span
                className="text-xl font-normal uppercase tracking-wide text-white"
                style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
              >
                {vm.tournamentName || "CRICKET TOURNAMENT"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FFD700]" />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.body }}
              >
                {overlay.toUpperCase()} SLATE
              </span>
            </div>
          </div>

          {/* MAIN SLATE VIEWPORT */}
          <div
            className="flex-1 flex flex-col justify-center overflow-y-auto"
            style={{
              paddingTop: `${BROADCAST_OVERLAY_SAFE_INSET_Y}px`,
              paddingBottom: `${BROADCAST_OVERLAY_SAFE_INSET_Y}px`,
              paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
              paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
            }}
          >
            {/* 1. SPONSORS SHOWCASE (3-Tier Hierarchical Inventory) */}
            {overlay === "sponsors" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    OFFICIAL TOURNAMENT PARTNERS
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    OUR VALUED SPONSORS
                  </h2>
                </div>

                {vm.sponsors && vm.sponsors.length > 0 ? (
                  <div className="grid grid-cols-3 gap-6 my-auto max-w-5xl mx-auto w-full">
                    {vm.sponsors.map((sp, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center border border-white/10 p-6"
                        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest text-[#FFD700] mb-4"
                          style={{ fontFamily: BROADCAST_FONTS.body }}
                        >
                          {sp.tier ? sp.tier.replace(/_/g, " ").toUpperCase() : "PARTNER"}
                        </span>
                        {sp.url ? (
                          <div className="h-20 w-full flex items-center justify-center p-2">
                            <img
                              src={sp.url}
                              alt={sp.name || ""}
                              className="max-h-full max-w-[220px] object-contain"
                            />
                          </div>
                        ) : null}
                        <p className="mt-3 text-sm font-bold text-white tracking-wider uppercase">
                          {sp.name || "Sponsor"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-12 border border-white/10">
                    <p
                      className="text-3xl font-normal text-[#FFD700] uppercase"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      BIDWAR BROADCAST GRAPHICS
                    </p>
                    <p className="text-sm font-semibold text-white/50 mt-1 uppercase tracking-wider">
                      Official Tournament Live Stream Inventory
                    </p>
                  </div>
                )}

                <div className="text-center border-t border-white/10 pt-4">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">
                    ALL RIGHTS RESERVED · BIDWAR SPORTS ENGINE
                  </p>
                </div>
              </div>
            )}

            {/* 2. POINTS TABLE / STANDINGS */}
            {overlay === "standings" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    STANDINGS &amp; RANKINGS
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    TOURNAMENT POINTS TABLE
                  </h2>
                </div>

                <div
                  className="flex-1 overflow-x-auto border border-white/10"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr
                        className="border-b border-white/15 text-xs font-bold tracking-widest text-white/60 uppercase"
                        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                      >
                        <th className="py-3.5 px-6 text-center">POS</th>
                        <th className="py-3.5 px-6">TEAM</th>
                        <th className="py-3.5 px-5 text-center">P</th>
                        <th className="py-3.5 px-5 text-center text-[#06B6D4]">W</th>
                        <th className="py-3.5 px-5 text-center text-[#E11D48]">L</th>
                        <th className="py-3.5 px-5 text-center text-white/80">NRR</th>
                        <th className="py-3.5 px-8 text-right text-[#FFD700]">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-base font-bold">
                      {standings && standings.length > 0 ? (
                        standings.map((row, idx) => (
                          <tr
                            key={row.teamId}
                            className={idx < 4 ? "bg-white/[0.02]" : ""}
                          >
                            <td className="py-3.5 px-6 text-center font-bold">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center text-xs font-bold ${
                                  idx < 4 ? "bg-[#FFD700] text-black" : "bg-white/10 text-white"
                                }`}
                                style={{ fontFamily: BROADCAST_FONTS.mono }}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                {row.teamLogoUrl ? (
                                  <img
                                    src={row.teamLogoUrl}
                                    alt=""
                                    className="h-7 w-7 object-contain"
                                  />
                                ) : null}
                                <span className="font-bold text-white text-lg uppercase">
                                  {row.teamName}
                                </span>
                                <span className="text-xs text-white/40 font-bold uppercase font-mono">
                                  ({row.shortCode})
                                </span>
                              </div>
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-white/80"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.played}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-[#06B6D4]"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.won}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-[#E11D48]"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.lost}
                            </td>
                            <td
                              className="py-3.5 px-5 text-center tabular-nums text-white/80 font-mono"
                              style={{ fontFamily: BROADCAST_FONTS.mono }}
                            >
                              {row.netRunRate != null
                                ? row.netRunRate > 0
                                  ? `+${row.netRunRate.toFixed(3)}`
                                  : row.netRunRate.toFixed(3)
                                : "0.000"}
                            </td>
                            <td
                              className="py-3.5 px-8 text-right font-normal text-3xl tabular-nums text-[#FFD700]"
                              style={{ fontFamily: BROADCAST_FONTS.display }}
                            >
                              {row.points}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-white/50">
                            No standings data currently calculated.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. UPCOMING MATCHES / FIXTURES */}
            {overlay === "fixtures" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    SCHEDULE &amp; FIXTURES
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    UPCOMING MATCHES
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-6 my-auto">
                  {matches && matches.filter((m) => m.status !== "completed").length > 0 ? (
                    matches
                      .filter((m) => m.status !== "completed")
                      .slice(0, 4)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col items-center border border-white/10 p-6"
                          style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                        >
                          <div className="flex w-full items-center justify-between text-xs font-bold text-[#FFD700] uppercase tracking-wider pb-3 border-b border-white/10">
                            <span>{m.roundName || `MATCH #${m.id}`}</span>
                            <span className="text-white/60">{m.venue || "MAIN GROUND"}</span>
                          </div>

                          <div className="flex w-full items-center justify-around py-5">
                            {/* Team 1 */}
                            <div className="flex flex-col items-center gap-2 max-w-[150px] text-center">
                              <span
                                className="text-3xl font-normal text-white uppercase"
                                style={{ fontFamily: BROADCAST_FONTS.display }}
                              >
                                {m.homeTeam?.shortCode || "TM1"}
                              </span>
                              <span className="text-xs font-bold text-white/80 uppercase truncate w-full">
                                {m.homeTeam?.name || "Home Team"}
                              </span>
                            </div>

                            <span
                              className="text-3xl font-normal italic text-[#FFD700]"
                              style={{ fontFamily: BROADCAST_FONTS.display }}
                            >
                              VS
                            </span>

                            {/* Team 2 */}
                            <div className="flex flex-col items-center gap-2 max-w-[150px] text-center">
                              <span
                                className="text-3xl font-normal text-white uppercase"
                                style={{ fontFamily: BROADCAST_FONTS.display }}
                              >
                                {m.awayTeam?.shortCode || "TM2"}
                              </span>
                              <span className="text-xs font-bold text-white/80 uppercase truncate w-full">
                                {m.awayTeam?.name || "Away Team"}
                              </span>
                            </div>
                          </div>

                          <div className="border border-white/15 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                            {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : "SCHEDULED"}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-white/50">
                      No upcoming fixtures scheduled.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. FULL INNINGS SCORECARD */}
            {overlay === "scorecard" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center border border-white/20"
                      style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                    >
                      <span
                        className="text-2xl font-normal text-[#FFD700]"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.batting?.shortCode || "BAT"}
                      </span>
                    </div>
                    <div>
                      <h2
                        className="text-4xl font-normal tracking-wide text-white uppercase leading-none"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.batting?.name || "INNINGS SCORECARD"}
                      </h2>
                      <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest mt-0.5">
                        {vm.tournamentName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-baseline gap-2">
                    <span
                      className="text-5xl font-normal tabular-nums text-white"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.runs}-{vm.wickets}
                    </span>
                    <span
                      className="text-base font-bold text-[#FFD700]"
                      style={{ fontFamily: BROADCAST_FONTS.mono }}
                    >
                      ({vm.oversLabel} OV)
                    </span>
                  </div>
                </div>

                {/* Bowler Figures Table */}
                <div
                  className="flex-1 overflow-x-auto border border-white/10"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr
                        className="border-b border-white/20 text-xs font-bold tracking-widest text-white/70 uppercase"
                        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                      >
                        <th className="py-3 px-6">BOWLER</th>
                        <th className="py-3 px-4 text-center">OVERS</th>
                        <th className="py-3 px-4 text-center">MAIDENS</th>
                        <th className="py-3 px-4 text-center">RUNS</th>
                        <th className="py-3 px-4 text-center text-[#FFD700]">WICKETS</th>
                        <th className="py-3 px-6 text-right">ECON</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-white/10 text-sm font-bold"
                      style={{ fontFamily: BROADCAST_FONTS.mono }}
                    >
                      {vm.bowler ? (
                        <tr>
                          <td
                            className="py-3.5 px-6 font-bold text-white text-base"
                            style={{ fontFamily: BROADCAST_FONTS.body }}
                          >
                            {vm.bowler.name} *
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.overs}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.maidens}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-white/80">
                            {vm.bowler.runsConceded}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums font-bold text-lg text-[#FFD700]">
                            {vm.bowler.wickets}
                          </td>
                          <td className="py-3.5 px-6 text-right tabular-nums font-bold text-[#06B6D4]">
                            {vm.bowler.economy.toFixed(2)}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-white/50">
                            Waiting for bowling figures…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Bar: Extras, Overs, Total */}
                <div
                  className="mt-4 flex items-center justify-between border border-white/15 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white"
                  style={{ background: BIDWAR_SCOREBOARD_INSET }}
                >
                  <div>
                    <span className="text-white/60">CRR: </span>
                    <span className="text-[#FFD700] font-mono">{vm.crr || "0.00"}</span>
                  </div>
                  <div>
                    <span className="text-white/60">OVERS: </span>
                    <span className="text-white font-mono">{vm.oversLabel}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white/60">TOTAL: </span>
                    <span
                      className="text-[#FFD700] text-2xl font-normal"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.runs}-{vm.wickets}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MATCH SUMMARY */}
            {overlay === "summary" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                <div className="text-center mb-4">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    OFFICIAL MATCH RESULT
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wide text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
                  >
                    MATCH SUMMARY
                  </h2>
                </div>

                {/* 2 Inning Cards */}
                <div className="grid grid-cols-2 gap-6 my-auto">
                  {/* Home Team */}
                  <div
                    className="border border-white/15 p-6"
                    style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <span
                        className="text-2xl font-normal text-white uppercase"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.home?.name || "TEAM 1"}
                      </span>
                      <span
                        className="text-3xl font-normal text-[#FFD700]"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.phase === "completed" || vm.phase === "chase" ? `${vm.runs}-${vm.wickets}` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP BATTERS</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.striker?.name || "Striker"}</span>
                        <span className="text-[#FFD700] font-mono">{vm.striker?.runs || 0} ({vm.striker?.balls || 0}b)</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.nonStriker?.name || "Non-Striker"}</span>
                        <span className="text-white/70 font-mono">{vm.nonStriker?.runs || 0} ({vm.nonStriker?.balls || 0}b)</span>
                      </div>
                    </div>
                  </div>

                  {/* Away Team */}
                  <div
                    className="border border-white/15 p-6"
                    style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <span
                        className="text-2xl font-normal text-white uppercase"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.away?.name || "TEAM 2"}
                      </span>
                      <span
                        className="text-3xl font-normal text-[#FFD700]"
                        style={{ fontFamily: BROADCAST_FONTS.display }}
                      >
                        {vm.target != null ? `${vm.target - 1}` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP BOWLERS</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.bowler?.name || "Bowler"}</span>
                        <span className="text-[#06B6D4] font-mono">{vm.bowler ? `${vm.bowler.wickets}-${vm.bowler.runsConceded}` : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Victory Headline Banner */}
                <div
                  className="border border-[#FFD700] p-4 text-center"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <p
                    className="text-3xl font-normal uppercase tracking-widest text-[#FFD700] leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.08em" }}
                  >
                    {vm.resultHeadline || vm.resultText || "MATCH IN PROGRESS"}
                  </p>
                </div>
              </div>
            )}

            {/* 6. MATCH INTRO / VS */}
            {overlay === "intro" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-4">
                <div className="text-center">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.body }}
                  >
                    MATCH PRESENTATION
                  </span>
                  <h2
                    className="text-5xl font-normal tracking-wider text-white uppercase mt-1 leading-none"
                    style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.06em" }}
                  >
                    {vm.home?.name || "TEAM 1"} <span className="text-[#FFD700] italic">VS</span> {vm.away?.name || "TEAM 2"}
                  </h2>
                </div>

                {/* Team Badges and VS */}
                <div className="flex items-center justify-center gap-20 my-auto">
                  {/* Home Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div
                      className="flex h-36 w-36 items-center justify-center border-2 border-[#FFD700] p-2"
                      style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                    >
                      {vm.home?.logoUrl ? (
                        <img src={vm.home.logoUrl} alt="" className="h-24 w-24 object-contain" />
                      ) : (
                        <span
                          className="text-5xl font-normal text-[#FFD700]"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {vm.home?.shortCode || "H"}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-2xl font-normal text-white uppercase text-center max-w-[200px]"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.home?.name}
                    </span>
                  </div>

                  <span
                    className="text-8xl font-normal italic text-[#FFD700]"
                    style={{ fontFamily: BROADCAST_FONTS.display }}
                  >
                    VS
                  </span>

                  {/* Away Team */}
                  <div className="flex flex-col items-center gap-4">
                    <div
                      className="flex h-36 w-36 items-center justify-center border-2 border-[#06B6D4] p-2"
                      style={{ background: BIDWAR_SCOREBOARD_PANEL }}
                    >
                      {vm.away?.logoUrl ? (
                        <img src={vm.away.logoUrl} alt="" className="h-24 w-24 object-contain" />
                      ) : (
                        <span
                          className="text-5xl font-normal text-[#06B6D4]"
                          style={{ fontFamily: BROADCAST_FONTS.display }}
                        >
                          {vm.away?.shortCode || "A"}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-2xl font-normal text-white uppercase text-center max-w-[200px]"
                      style={{ fontFamily: BROADCAST_FONTS.display }}
                    >
                      {vm.away?.name}
                    </span>
                  </div>
                </div>

                {/* Match Venue / Toss Strip */}
                <div
                  className="border border-white/10 py-3 px-6 text-center"
                  style={{ background: BIDWAR_SCOREBOARD_SHELL }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-[#06B6D4]">
                    LIVE FROM {vm.venueText || "MAIN VENUE"}
                  </p>
                  {vm.tossText ? (
                    <p className="mt-1 text-sm font-semibold text-white uppercase tracking-wider">
                      {vm.tossText}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
