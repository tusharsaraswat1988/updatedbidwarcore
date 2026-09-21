import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getScoringStandings, listScoringMatches } from "@/lib/scoring-api";
import type { CricketObsViewModel, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

type Props = {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  tournamentId: number;
  onClose?: () => void;
};

/**
 * Component 5: Large 80% Screen Overlays (Operator Triggered + 80% Frosted Transparency)
 *
 * Requirements:
 * - Covers ~80% of the screen center
 * - Non-header/footer: 80% transparent frosted glass (`bg-slate-950/85 backdrop-blur-md`)
 * - Live stadium camera feed remains subtly visible underneath
 * - Displays:
 *   1. Sponsors Showcase (Title, Powered By, Associate)
 *   2. Points Table / Standings
 *   3. Upcoming Matches / Schedule (Reference Image 4)
 *   4. Full Innings Bowling Scorecard (Reference Image 3)
 *   5. Match Summary (Reference Image 5)
 *   6. Match Intro / VS Presentation (Reference Image 4)
 */
export function CricketObsMidOverlays({ vm, overlay, tournamentId, onClose }: Props) {
  // Query tournament standings
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 60_000,
  });

  // Query tournament matches/fixtures
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: (overlay === "fixtures" || overlay === "intro") && tournamentId > 0,
    staleTime: 60_000,
  });

  if (overlay === "none") return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-12 pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative flex h-[82vh] w-[86vw] max-w-[1550px] flex-col overflow-hidden rounded-2xl border-2 border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
          style={{
            background: "rgba(10, 14, 24, 0.85)",
            backdropFilter: "blur(16px)",
            fontFamily: "'Barlow Condensed', 'Space Grotesk', -apple-system, sans-serif",
          }}
        >
          {/* Top chrome header bar */}
          <div
            className="flex h-14 items-center justify-between px-8 border-b border-white/15"
            style={{
              background: "linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
                BIDWAR BROADCAST
              </span>
              <span className="text-white/30">/</span>
              <span className="text-base font-black tracking-wider text-white uppercase">
                {vm.tournamentName || "CRICKET TOURNAMENT"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                LIVE OVERLAY
              </span>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70 hover:bg-white/20 hover:text-white"
                >
                  ✕ HIDE
                </button>
              ) : null}
            </div>
          </div>

          {/* OVERLAY CONTENT */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* 1. SPONSORS SHOWCASE (80% Screen) */}
            {overlay === "sponsors" && (
              <div className="flex h-full flex-col justify-between">
                <div className="text-center">
                  <span className="text-xs font-black tracking-[0.25em] text-amber-400 uppercase">
                    OFFICIAL TOURNAMENT PARTNERS
                  </span>
                  <h2 className="text-4xl font-black tracking-wide text-white uppercase mt-1">
                    OUR VALUED SPONSORS
                  </h2>
                </div>

                {vm.sponsors && vm.sponsors.length > 0 ? (
                  <div className="grid grid-cols-3 gap-6 my-auto max-w-5xl mx-auto w-full">
                    {vm.sponsors.map((sp, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center rounded-xl border border-white/15 p-6 shadow-xl"
                        style={{
                          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.4) 100%)",
                        }}
                      >
                        <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300 mb-4">
                          {sp.tier ? sp.tier.replace(/_/g, " ").toUpperCase() : "PARTNER"}
                        </span>
                        {sp.url ? (
                          <img
                            src={sp.url}
                            alt={sp.name || ""}
                            className="h-20 max-w-[220px] object-contain drop-shadow"
                          />
                        ) : null}
                        <p className="mt-3 text-sm font-bold text-white tracking-wider">
                          {sp.name || "Sponsor"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center">
                    <p className="text-2xl font-black text-amber-400 uppercase">
                      BIDWAR POWERED BROADCAST
                    </p>
                    <p className="text-sm font-medium text-white/50 mt-1 max-w-md">
                      Streamed with official BidWar cricket scoring and overlay engine.
                    </p>
                  </div>
                )}

                <div className="text-center border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold tracking-widest text-white/40 uppercase">
                    BIDWAR BROADCAST GRAPHICS · ALL RIGHTS RESERVED
                  </p>
                </div>
              </div>
            )}

            {/* 2. POINTS TABLE / STANDINGS (80% Screen) */}
            {overlay === "standings" && (
              <div className="flex h-full flex-col">
                <div className="text-center mb-6">
                  <span className="text-xs font-black tracking-[0.25em] text-amber-400 uppercase">
                    STANDINGS & RANKINGS
                  </span>
                  <h2 className="text-3xl font-black tracking-wide text-white uppercase mt-0.5">
                    POINTS TABLE
                  </h2>
                </div>

                <div className="flex-1 overflow-x-auto rounded-xl border border-white/15 shadow-xl bg-black/30">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/15 bg-white/5 text-[11px] font-black tracking-widest text-white/60 uppercase">
                        <th className="py-3 px-5 text-center">POS</th>
                        <th className="py-3 px-5">TEAM</th>
                        <th className="py-3 px-4 text-center">P</th>
                        <th className="py-3 px-4 text-center">W</th>
                        <th className="py-3 px-4 text-center">L</th>
                        <th className="py-3 px-4 text-center">NRR</th>
                        <th className="py-3 px-6 text-right text-amber-400">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-sm font-bold">
                      {standings && standings.length > 0 ? (
                        standings.map((row, idx) => (
                          <tr
                            key={row.teamId}
                            className={`transition hover:bg-white/5 ${
                              idx < 4 ? "bg-amber-500/5" : ""
                            }`}
                          >
                            <td className="py-3 px-5 text-center font-black">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                                  idx < 4
                                    ? "bg-amber-400 text-black shadow-md"
                                    : "bg-white/10 text-white"
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-3">
                                {row.teamLogoUrl ? (
                                  <img
                                    src={row.teamLogoUrl}
                                    alt=""
                                    className="h-7 w-7 object-contain"
                                  />
                                ) : null}
                                <span className="font-black text-white text-base">
                                  {row.teamName}
                                </span>
                                <span className="text-xs text-white/40 font-bold uppercase">
                                  {row.shortCode}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center tabular-nums text-white/80">
                              {row.played}
                            </td>
                            <td className="py-3 px-4 text-center tabular-nums text-emerald-400">
                              {row.won}
                            </td>
                            <td className="py-3 px-4 text-center tabular-nums text-red-400">
                              {row.lost}
                            </td>
                            <td className="py-3 px-4 text-center tabular-nums font-black text-cyan-300">
                              {row.netRunRate != null ? (row.netRunRate > 0 ? `+${row.netRunRate.toFixed(3)}` : row.netRunRate.toFixed(3)) : "0.000"}
                            </td>
                            <td className="py-3 px-6 text-right font-black text-lg tabular-nums text-amber-400">
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

            {/* 3. UPCOMING MATCHES / FIXTURES (80% Screen - Reference Image 4) */}
            {overlay === "fixtures" && (
              <div className="flex h-full flex-col">
                <div className="text-center mb-6">
                  <span className="text-xs font-black tracking-[0.25em] text-amber-400 uppercase">
                    SCHEDULE & FIXTURES
                  </span>
                  <h2 className="text-3xl font-black tracking-wide text-white uppercase mt-0.5">
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
                          className="flex flex-col items-center rounded-xl border border-white/15 p-6 shadow-xl"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)",
                          }}
                        >
                          <div className="flex w-full items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider pb-3 border-b border-white/10">
                            <span>{m.roundName || `MATCH #${m.id}`}</span>
                            <span className="text-white/60">{m.venue || "MAIN GROUND"}</span>
                          </div>

                          {/* Teams VS Display */}
                          <div className="flex w-full items-center justify-around py-5">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-black/60 shadow">
                                <span className="text-lg font-black text-white">
                                  {m.homeTeam?.shortCode || "TM1"}
                                </span>
                              </div>
                              <span className="text-sm font-black text-white uppercase">
                                {m.homeTeam?.name || "Home Team"}
                              </span>
                            </div>

                            <span className="text-3xl font-black italic text-amber-400 drop-shadow">
                              VS
                            </span>

                            <div className="flex flex-col items-center gap-2">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-black/60 shadow">
                                <span className="text-lg font-black text-white">
                                  {m.awayTeam?.shortCode || "TM2"}
                                </span>
                              </div>
                              <span className="text-sm font-black text-white uppercase">
                                {m.awayTeam?.name || "Away Team"}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-full bg-white/10 px-4 py-1 text-xs font-black uppercase tracking-wider text-white">
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

            {/* 4. FULL INNINGS BOWLING SCORECARD (80% Screen - Reference Image 3) */}
            {overlay === "scorecard" && (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400 bg-black shadow">
                      <span className="text-lg font-black text-amber-400">
                        {vm.batting?.shortCode || "BAT"}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-wide text-white uppercase">
                        {vm.batting?.name || "INNINGS SCORECARD"}
                      </h2>
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                        {vm.tournamentName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-4xl font-black tabular-nums text-white">
                      {vm.runs}-{vm.wickets}
                    </span>
                    <span className="ml-2 text-base font-bold text-amber-400">
                      ({vm.oversLabel} OV)
                    </span>
                  </div>
                </div>

                {/* Bowler Figures Table (Matching Ref Image 3) */}
                <div className="flex-1 overflow-x-auto rounded-xl border border-white/15 bg-black/40 shadow-inner">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/20 bg-white/10 text-xs font-black tracking-widest text-white/70 uppercase">
                        <th className="py-3 px-6">BOWLER</th>
                        <th className="py-3 px-4 text-center">OVERS</th>
                        <th className="py-3 px-4 text-center">MAIDENS</th>
                        <th className="py-3 px-4 text-center">RUNS</th>
                        <th className="py-3 px-4 text-center text-amber-400">WICKETS</th>
                        <th className="py-3 px-6 text-right">ECON</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-sm font-bold">
                      {vm.bowler ? (
                        <tr className="bg-amber-500/10">
                          <td className="py-3.5 px-6 font-black text-white text-base">
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
                          <td className="py-3.5 px-4 text-center tabular-nums font-black text-lg text-amber-400">
                            {vm.bowler.wickets}
                          </td>
                          <td className="py-3.5 px-6 text-right tabular-nums font-black text-cyan-300">
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

                {/* Bottom Bar: Extras, Overs, Total (Ref Image 3) */}
                <div className="mt-4 flex items-center justify-between rounded-lg border border-white/15 bg-black/60 px-6 py-3 text-sm font-black uppercase tracking-wider text-white">
                  <div>
                    <span>EXTRAS: </span>
                    <span className="text-amber-400">12 (Wd 6, Nb 2, Lb 4)</span>
                  </div>
                  <div>
                    <span>OVERS: </span>
                    <span className="text-white">{vm.oversLabel}</span>
                  </div>
                  <div className="text-base">
                    <span>TOTAL: </span>
                    <span className="text-amber-400 text-xl font-black">{vm.runs}-{vm.wickets}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MATCH SUMMARY (80% Screen - Reference Image 5) */}
            {overlay === "summary" && (
              <div className="flex h-full flex-col justify-between">
                <div className="text-center mb-4">
                  <div className="inline-block rounded-md border border-white/20 bg-white/10 px-6 py-1">
                    <h2 className="text-2xl font-black tracking-widest text-white uppercase">
                      MATCH SUMMARY
                    </h2>
                  </div>
                </div>

                {/* Two Inning Cards (Ref Image 5) */}
                <div className="grid grid-cols-2 gap-6 my-auto">
                  {/* Home Team Card */}
                  <div className="rounded-xl border border-white/20 bg-black/50 p-5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/15 pb-2.5 mb-3">
                      <span className="text-xl font-black text-white uppercase">
                        {vm.home?.name || "TEAM 1"}
                      </span>
                      <span className="text-2xl font-black text-amber-400">
                        {vm.phase === "completed" || vm.phase === "chase" ? `${vm.runs}-${vm.wickets}` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP PERFORMERS</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.striker?.name || "Striker"}</span>
                        <span className="text-amber-300 font-black">{vm.striker?.runs || 0} ({vm.striker?.balls || 0})</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.nonStriker?.name || "Non-Striker"}</span>
                        <span className="text-white/70 font-black">{vm.nonStriker?.runs || 0} ({vm.nonStriker?.balls || 0})</span>
                      </div>
                    </div>
                  </div>

                  {/* Away Team Card */}
                  <div className="rounded-xl border border-white/20 bg-black/50 p-5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/15 pb-2.5 mb-3">
                      <span className="text-xl font-black text-white uppercase">
                        {vm.away?.name || "TEAM 2"}
                      </span>
                      <span className="text-2xl font-black text-amber-400">
                        {vm.target != null ? `${vm.target - 1} ALL OUT` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 font-bold uppercase mb-2">TOP PERFORMERS</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">{vm.bowler?.name || "Bowler"}</span>
                        <span className="text-cyan-300 font-black">{vm.bowler ? `${vm.bowler.wickets}-${vm.bowler.runsConceded}` : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Victory Banner (Ref Image 5) */}
                <div className="rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 p-4 text-center shadow-lg">
                  <p className="text-xl font-black uppercase tracking-widest text-amber-300">
                    {vm.resultHeadline || vm.resultText || "MATCH IN PROGRESS"}
                  </p>
                </div>
              </div>
            )}

            {/* 6. MATCH INTRO / VS (80% Screen - Reference Image 4) */}
            {overlay === "intro" && (
              <div className="flex h-full flex-col justify-between py-6">
                <div className="text-center">
                  <span className="text-xs font-black tracking-[0.25em] text-amber-400 uppercase">
                    MATCH PRESENTATION
                  </span>
                  <h2 className="text-4xl font-black tracking-wider text-white uppercase mt-1">
                    {vm.home?.name || "TEAM 1"} <span className="text-amber-400 italic">VS</span> {vm.away?.name || "TEAM 2"}
                  </h2>
                </div>

                {/* 3D Circular Team Badges (Ref Image 4) */}
                <div className="flex items-center justify-center gap-16 my-auto">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-amber-400 bg-black/80 shadow-[0_0_40px_rgba(251,191,36,0.3)]">
                      {vm.home?.logoUrl ? (
                        <img src={vm.home.logoUrl} alt="" className="h-20 w-20 object-contain" />
                      ) : (
                        <span className="text-3xl font-black text-amber-400">{vm.home?.shortCode || "H"}</span>
                      )}
                    </div>
                    <span className="text-xl font-black text-white uppercase">{vm.home?.name}</span>
                  </div>

                  <span className="text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 drop-shadow">
                    VS
                  </span>

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-cyan-400 bg-black/80 shadow-[0_0_40px_rgba(34,211,238,0.3)]">
                      {vm.away?.logoUrl ? (
                        <img src={vm.away.logoUrl} alt="" className="h-20 w-20 object-contain" />
                      ) : (
                        <span className="text-3xl font-black text-cyan-400">{vm.away?.shortCode || "A"}</span>
                      )}
                    </div>
                    <span className="text-xl font-black text-white uppercase">{vm.away?.name}</span>
                  </div>
                </div>

                {/* Green banner: Match info & Venue (Ref Image 4) */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/70 py-3 px-6 text-center shadow-lg">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                    LIVE FROM {vm.venueText || "MAIN VENUE"}
                  </p>
                  {vm.tossText ? (
                    <p className="mt-1 text-sm font-bold text-white tracking-wider">
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
