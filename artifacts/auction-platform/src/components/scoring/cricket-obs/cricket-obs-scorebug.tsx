import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 3: Solid Bottom Footer / Scorebug (Non-Transparent)
 * Designed to IPL & International broadcast standards with sharp, clear typography.
 *
 * Sizing & Layout Improvements:
 * - Sharper, non-muddy font weights with antialiased rendering
 * - High contrast across all data points
 * - Sized up all previously small stats (4s, 6s, SR, ECON, balls remaining)
 * - Tightly grouped batter cards (Player Name, Runs, Balls, Boundaries, Strike Rate)
 * - Center space utilized by the Live Match Chase / Rates Hub
 * - 40px large circular over train delivery pills
 * - Bold, easily legible bottom ticker
 */
export function CricketObsScorebug({ vm }: { vm: CricketObsViewModel }) {
  const batting = vm.batting;
  const bowling = vm.bowling;
  const striker = vm.striker;
  const nonStriker = vm.nonStriker;
  const bowler = vm.bowler;

  const isChase = vm.phase === "chase";
  const needRuns = vm.needRuns;
  const ballsLeft = vm.ballsRemaining;

  return (
    <div
      className="relative z-30 w-full overflow-hidden rounded-2xl border-2 border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)]"
      style={{
        background: "linear-gradient(180deg, #131a29 0%, #080c14 100%)",
        fontFamily: "'Barlow Condensed', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* Top metallic IPL gradient accent line */}
      <div
        className="h-1.5 w-full"
        style={{
          background:
            "linear-gradient(90deg, #3b82f6 0%, #f59e0b 25%, #ef4444 50%, #8b5cf6 75%, #3b82f6 100%)",
        }}
      />

      {/* MAIN BROADCAST STRIP (Height: 106px) */}
      <div className="flex h-[106px] items-stretch">
        {/* 1. BATTING TEAM & SCORE BLOCK (~340px) */}
        <div
          className="flex min-w-[340px] max-w-[370px] items-center gap-4 px-5"
          style={{
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
          }}
        >
          {/* Team Crest */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/60 bg-black/70 shadow-lg">
            {batting?.logoUrl ? (
              <img
                src={batting.logoUrl}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span className="text-xl font-bold tracking-wider text-amber-400">
                {batting?.shortCode?.slice(0, 3) || "BAT"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black uppercase tracking-tight text-white">
                {batting?.shortCode || "BAT"}
              </span>
              <span className="text-sm font-bold text-white/60">
                v {bowling?.shortCode || "BOWL"}
              </span>
            </div>
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/50">
              {batting?.name || "Batting Team"}
            </p>
          </div>

          {/* Large Runs-Wickets Score */}
          <div className="ml-auto flex flex-col items-end pr-1">
            <div className="flex items-baseline font-black leading-none tracking-tight text-white">
              <span className="text-5xl tabular-nums text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {vm.runs}
              </span>
              <span className="mx-1 text-3xl font-bold text-amber-400">-</span>
              <span className="text-4xl tabular-nums text-amber-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {vm.wickets}
              </span>
            </div>
            <span className="mt-1 text-base font-bold uppercase tracking-widest text-amber-400">
              {vm.oversDisplay}
            </span>
          </div>
        </div>

        {/* 2. BATSMEN CREASE SECTION (~460px) - SHARP & WELL SPACED */}
        <div
          className="flex min-w-[450px] flex-1 flex-col justify-center px-6 gap-2"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
            background: "rgba(15, 23, 42, 0.65)",
          }}
        >
          {/* Striker Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black shadow">
                *
              </span>
              <span className="truncate text-xl font-bold uppercase tracking-wide text-amber-300">
                {striker?.name || "Striker"}
              </span>
            </div>

            <div className="flex items-center gap-5 tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">
                  {striker?.runs ?? 0}
                </span>
                <span className="text-base font-bold text-white/70">
                  ({striker?.balls ?? 0})
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
                <span>4s: <strong className="text-white font-bold">{striker?.fours ?? 0}</strong></span>
                <span>6s: <strong className="text-white font-bold">{striker?.sixes ?? 0}</strong></span>
                <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30">
                  SR {striker?.strikeRate != null ? striker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Non-Striker Row */}
          <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
            <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
              <span className="h-5 w-5 shrink-0" />
              <span className="truncate text-xl font-bold uppercase tracking-wide text-white/95">
                {nonStriker?.name || "Non-Striker"}
              </span>
            </div>

            <div className="flex items-center gap-5 tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white/95">
                  {nonStriker?.runs ?? 0}
                </span>
                <span className="text-base font-bold text-white/70">
                  ({nonStriker?.balls ?? 0})
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
                <span>4s: <strong className="text-white/90 font-bold">{nonStriker?.fours ?? 0}</strong></span>
                <span>6s: <strong className="text-white/90 font-bold">{nonStriker?.sixes ?? 0}</strong></span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold text-white/80 border border-white/15">
                  SR {nonStriker?.strikeRate != null ? nonStriker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CENTER MATCH HUB (~280px) — LIVE EQUATION & RUN RATES */}
        <div
          className="flex min-w-[270px] max-w-[310px] flex-col items-center justify-center px-4 text-center"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.55) 0%, rgba(15, 23, 42, 0.75) 100%)",
          }}
        >
          {isChase && needRuns != null && ballsLeft != null ? (
            <div className="space-y-1">
              <span className="rounded-full bg-amber-400/25 px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-amber-300 border border-amber-400/30">
                CHASE EQUATION
              </span>
              <div className="text-3xl font-black uppercase tracking-tight text-amber-400 drop-shadow">
                NEED {needRuns} RUNS
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-white">
                IN {ballsLeft} BALLS · <span className="text-amber-300">RRR {vm.rrr || "—"}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="rounded-full bg-blue-500/25 px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-blue-300 border border-blue-400/30">
                INNINGS PACE
              </span>
              <div className="flex items-center gap-3 text-xl font-bold uppercase text-white">
                <span>CRR <strong className="text-amber-400 font-black">{vm.crr || "0.00"}</strong></span>
                {vm.projectedScore ? (
                  <span>PROJ <strong className="text-cyan-400 font-black">{vm.projectedScore}</strong></span>
                ) : null}
              </div>
              {vm.powerplayText ? (
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                  {vm.powerplayText}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 4. BOWLER SPELL & OVER TRAIN SECTION (~430px) */}
        <div
          className="flex min-w-[390px] flex-1 flex-col justify-center px-6 gap-2"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
            background: "rgba(15, 23, 42, 0.65)",
          }}
        >
          {/* Bowler Name & Figures */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                BOWLER
              </span>
              <span className="truncate text-xl font-bold uppercase tracking-wide text-white">
                {bowler?.name || "Bowler"}
              </span>
            </div>
            <div className="flex items-center gap-3 tabular-nums font-bold">
              <span className="rounded-md bg-black/70 px-3 py-1 text-xl font-black text-amber-400 border border-amber-400/40 shadow-sm">
                {bowler ? `${bowler.wickets}-${bowler.runsConceded} (${bowler.overs})` : "0-0 (0.0)"}
              </span>
              <span className="text-sm font-semibold text-white/70">
                ECON {bowler?.economy != null ? bowler.economy.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Over Train with Large 38px Circular Delivery Pills */}
          <div className="flex items-center gap-3 border-t border-white/10 pt-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              THIS OVER:
            </span>
            <div className="flex items-center gap-2">
              {vm.thisOverLabels.length === 0 ? (
                <span className="text-sm font-semibold text-white/40">—</span>
              ) : (
                vm.thisOverLabels.map((ball, idx) => {
                  const isWicket = ball === "W";
                  const isSix = ball === "6";
                  const isFour = ball === "4";
                  const isExtra = ball.includes("Wd") || ball.includes("Nb");
                  const isDot = ball === "·" || ball === "0";

                  let chipStyle = "bg-white/15 text-white border-white/30";
                  if (isWicket) {
                    chipStyle = "bg-red-600 text-white font-black border-red-400 shadow-lg shadow-red-900/70";
                  } else if (isSix) {
                    chipStyle = "bg-purple-600 text-white font-black border-purple-400 shadow-lg shadow-purple-900/70";
                  } else if (isFour) {
                    chipStyle = "bg-blue-600 text-white font-black border-blue-400 shadow-lg shadow-blue-900/70";
                  } else if (isExtra) {
                    chipStyle = "bg-amber-600 text-amber-100 font-black border-amber-400";
                  } else if (isDot) {
                    chipStyle = "bg-black/60 text-white/50 border-white/20";
                  }

                  return (
                    <span
                      key={`${ball}-${idx}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-bold tabular-nums shadow-sm ${chipStyle}`}
                    >
                      {ball}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. OPPONENT LOGO (~80px) */}
        <div className="flex w-20 shrink-0 items-center justify-center bg-black/45 px-3">
          {bowling?.logoUrl ? (
            <img
              src={bowling.logoUrl}
              alt=""
              className="h-14 w-14 object-contain p-1"
            />
          ) : (
            <span className="text-base font-black uppercase text-white/40">
              {bowling?.shortCode || "BOWL"}
            </span>
          )}
        </div>
      </div>

      {/* BOTTOM CONTEXT / TICKER BAR (Height: 38px with 15px font) */}
      <div
        className="flex h-[38px] items-center justify-between border-t border-white/15 px-6 text-sm font-bold tracking-wide uppercase text-white/95"
        style={{
          background: "linear-gradient(90deg, #0f1523 0%, #050810 100%)",
        }}
      >
        {/* Left Side: Context / Target / Toss */}
        <div className="flex items-center gap-5">
          {isChase && needRuns != null && ballsLeft != null ? (
            <div className="flex items-center gap-3 text-amber-300">
              <span className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-black text-black">
                CHASE
              </span>
              <span className="text-sm font-black">
                NEED {needRuns} RUNS OFF {ballsLeft} BALLS
              </span>
              {vm.target != null ? (
                <span className="text-white/70">(TARGET {vm.target})</span>
              ) : null}
            </div>
          ) : vm.firstInningsScoreLine ? (
            <div className="flex items-center gap-2.5 text-white/90">
              <span className="text-amber-400 font-black">1ST INNINGS:</span>
              <span>{vm.firstInningsScoreLine}</span>
            </div>
          ) : vm.tossText ? (
            <div className="flex items-center gap-2.5 text-white/95">
              <span className="text-amber-400 font-black">TOSS:</span>
              <span>{vm.tossText}</span>
            </div>
          ) : (
            <span className="text-white/75">BIDWAR CRICKET LIVE BROADCAST</span>
          )}

          {/* Active Free Hit Alert */}
          {vm.freeHitActive ? (
            <span className="animate-pulse rounded bg-red-600 px-3 py-0.5 text-xs font-black text-white shadow">
              🎯 FREE HIT ON NEXT BALL
            </span>
          ) : null}

          {/* Active Super Ball Alert */}
          {vm.superBallActive ? (
            <span className="rounded bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-0.5 text-xs font-black text-black shadow">
              🔥 SUPER BALL ACTIVE
            </span>
          ) : null}
        </div>

        {/* Right Side: Rates & Extras */}
        <div className="flex items-center gap-5 font-bold">
          {vm.crr ? (
            <span>
              CRR <span className="text-amber-400 font-black">{vm.crr}</span>
            </span>
          ) : null}

          {isChase && vm.rrr ? (
            <span>
              RRR <span className="text-red-400 font-black">{vm.rrr}</span>
            </span>
          ) : null}

          {!isChase && vm.projectedScore ? (
            <span>
              PROJ <span className="text-cyan-400 font-black">{vm.projectedScore}</span>
            </span>
          ) : null}

          {vm.powerplayText ? (
            <span className="rounded bg-white/15 px-2.5 py-0.5 text-xs font-bold tracking-widest text-amber-300">
              {vm.powerplayText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
