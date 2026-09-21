import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 3: Solid Bottom Footer / Scorebug (Non-Transparent)
 * Inspired by IPL Hotstar & International broadcast graphics.
 * Fully solid non-transparent background with metallic broadcast finish.
 *
 * Contains:
 * - Batting Team Crest, Short code, Big score (Runs-Wickets), Overs
 * - Striker & Non-Striker details (Runs, Balls, 4s, 6s, Strike Rate, on-strike marker)
 * - Current Bowler details (Spell: O-M-R-W, Economy)
 * - Current Over Ball Train (Pills for each delivery with boundaries & wicket colors)
 * - Rates & Chase Equation Ticker (Target, Need X off Y, CRR, RRR, PRR, Toss info)
 */
export function CricketObsScorebug({ vm }: { vm: CricketObsViewModel }) {
  const batting = vm.batting;
  const bowling = vm.bowling;
  const striker = vm.striker;
  const nonStriker = vm.nonStriker;
  const bowler = vm.bowler;

  // Chase equation or innings status
  const isChase = vm.phase === "chase";
  const needRuns = vm.needRuns;
  const ballsLeft = vm.ballsRemaining;

  return (
    <div
      className="relative z-30 w-full overflow-hidden rounded-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
      style={{
        background: "linear-gradient(180deg, #111827 0%, #090d16 100%)",
        fontFamily: "'Barlow Condensed', 'Space Grotesk', -apple-system, sans-serif",
      }}
    >
      {/* Top metallic IPL gradient accent line */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #3b82f6 0%, #f59e0b 25%, #ef4444 50%, #8b5cf6 75%, #3b82f6 100%)",
        }}
      />

      {/* MAIN BROADCAST STRIP */}
      <div className="flex h-20 items-stretch">
        {/* 1. BATTING TEAM & SCORE BLOCK */}
        <div
          className="flex min-w-[280px] items-center gap-3.5 px-4"
          style={{
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* Team Crest with metallic border */}
          <div className="flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/40 bg-black/60 shadow-lg">
            {batting?.logoUrl ? (
              <img
                src={batting.logoUrl}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span className="text-base font-black tracking-wider text-amber-400">
                {batting?.shortCode?.slice(0, 3) || "BAT"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black uppercase tracking-wide text-white">
                {batting?.shortCode || "BAT"}
              </span>
              <span className="text-xs font-semibold text-white/50">
                v {bowling?.shortCode || "BOWL"}
              </span>
            </div>
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/40">
              {batting?.name || "Batting"}
            </p>
          </div>

          {/* Large Runs-Wickets Score */}
          <div className="ml-auto flex flex-col items-end pr-1">
            <div className="flex items-baseline font-black leading-none tracking-tight text-white">
              <span className="text-4xl tabular-nums text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {vm.runs}
              </span>
              <span className="mx-1 text-2xl font-bold text-amber-400/70">-</span>
              <span className="text-3xl tabular-nums text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {vm.wickets}
              </span>
            </div>
            <span className="mt-1 text-xs font-black uppercase tracking-widest text-amber-400">
              {vm.oversDisplay}
            </span>
          </div>
        </div>

        {/* 2. BATSMEN CREASE SECTION */}
        <div
          className="flex flex-1 flex-col justify-center px-4"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/40 pb-0.5">
            <span>BATTER</span>
            <div className="flex items-center gap-4 pr-1">
              <span className="w-6 text-right">R</span>
              <span className="w-6 text-right">B</span>
              <span className="w-5 text-right">4s</span>
              <span className="w-5 text-right">6s</span>
              <span className="w-10 text-right">SR</span>
            </div>
          </div>

          {/* Striker */}
          <div className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-black">
                *
              </span>
              <span className="truncate font-black uppercase tracking-wider text-amber-300">
                {striker?.name || "Striker"}
              </span>
            </div>
            <div className="flex items-center gap-4 pr-1 text-xs tabular-nums font-bold">
              <span className="w-6 text-right font-black text-white">
                {striker?.runs ?? 0}
              </span>
              <span className="w-6 text-right text-white/60">
                {striker?.balls ?? 0}
              </span>
              <span className="w-5 text-right text-white/60">
                {striker?.fours ?? 0}
              </span>
              <span className="w-5 text-right text-white/60">
                {striker?.sixes ?? 0}
              </span>
              <span className="w-10 text-right font-black text-amber-400/90">
                {striker?.strikeRate != null ? striker.strikeRate.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
              <span className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-bold uppercase tracking-wider text-white/85">
                {nonStriker?.name || "Non-Striker"}
              </span>
            </div>
            <div className="flex items-center gap-4 pr-1 text-xs tabular-nums font-bold">
              <span className="w-6 text-right font-black text-white/90">
                {nonStriker?.runs ?? 0}
              </span>
              <span className="w-6 text-right text-white/60">
                {nonStriker?.balls ?? 0}
              </span>
              <span className="w-5 text-right text-white/60">
                {nonStriker?.fours ?? 0}
              </span>
              <span className="w-5 text-right text-white/60">
                {nonStriker?.sixes ?? 0}
              </span>
              <span className="w-10 text-right font-black text-white/60">
                {nonStriker?.strikeRate != null ? nonStriker.strikeRate.toFixed(1) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. BOWLER SPELL & OVER TRAIN SECTION */}
        <div
          className="flex min-w-[340px] flex-col justify-center px-4"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          {/* Bowler Name & Figures */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">
                BOWLER
              </span>
              <span className="truncate text-sm font-black uppercase tracking-wider text-white">
                {bowler?.name || "Bowler"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
              <span className="rounded bg-black/50 px-2 py-0.5 font-black text-amber-400">
                {bowler ? `${bowler.wickets}-${bowler.runsConceded} (${bowler.overs})` : "0-0 (0.0)"}
              </span>
              <span className="text-[10px] text-white/50">
                ECON {bowler?.economy != null ? bowler.economy.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Over Train (Ball-by-ball chips) */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-white/40">
              THIS OVER
            </span>
            <div className="flex items-center gap-1.5">
              {vm.thisOverLabels.length === 0 ? (
                <span className="text-[11px] font-medium text-white/30">—</span>
              ) : (
                vm.thisOverLabels.map((ball, idx) => {
                  const isWicket = ball === "W";
                  const isSix = ball === "6";
                  const isFour = ball === "4";
                  const isExtra = ball.includes("Wd") || ball.includes("Nb");
                  const isDot = ball === "·" || ball === "0";

                  let chipStyle = "bg-white/10 text-white border-white/20";
                  if (isWicket) {
                    chipStyle = "bg-red-600 text-white font-black border-red-400 shadow-md shadow-red-900/50";
                  } else if (isSix) {
                    chipStyle = "bg-purple-600 text-white font-black border-purple-400 shadow-md shadow-purple-900/50";
                  } else if (isFour) {
                    chipStyle = "bg-blue-600 text-white font-black border-blue-400 shadow-md shadow-blue-900/50";
                  } else if (isExtra) {
                    chipStyle = "bg-amber-600/80 text-amber-200 font-bold border-amber-400";
                  } else if (isDot) {
                    chipStyle = "bg-black/40 text-white/40 border-white/10";
                  }

                  return (
                    <span
                      key={`${ball}-${idx}`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black tabular-nums ${chipStyle}`}
                    >
                      {ball}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 4. OPPONENT LOGO */}
        <div className="flex w-16 shrink-0 items-center justify-center bg-black/40 px-2">
          {bowling?.logoUrl ? (
            <img
              src={bowling.logoUrl}
              alt=""
              className="h-10 w-10 object-contain p-0.5"
            />
          ) : (
            <span className="text-xs font-black uppercase text-white/40">
              {bowling?.shortCode || "BOWL"}
            </span>
          )}
        </div>
      </div>

      {/* BOTTOM CONTEXT / TICKER BAR */}
      <div
        className="flex h-7 items-center justify-between border-t border-white/10 px-5 text-[11px] font-bold tracking-wider uppercase text-white/90"
        style={{
          background: "linear-gradient(90deg, #0b0f19 0%, #030712 100%)",
        }}
      >
        {/* Left Side of Ticker: Target & Equation */}
        <div className="flex items-center gap-4">
          {isChase && needRuns != null && ballsLeft != null ? (
            <div className="flex items-center gap-2 text-amber-300">
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
                CHASE
              </span>
              <span className="font-black">
                NEED {needRuns} RUNS OFF {ballsLeft} BALLS
              </span>
              {vm.target != null ? (
                <span className="text-white/50">(TARGET {vm.target})</span>
              ) : null}
            </div>
          ) : vm.firstInningsScoreLine ? (
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-amber-400">1st Innings:</span>
              <span>{vm.firstInningsScoreLine}</span>
            </div>
          ) : vm.tossText ? (
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-amber-400">TOSS:</span>
              <span>{vm.tossText}</span>
            </div>
          ) : (
            <span className="text-white/60">BIDWAR CRICKET BROADCAST</span>
          )}

          {/* Active Free Hit Alert */}
          {vm.freeHitActive ? (
            <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
              🎯 FREE HIT ON NEXT BALL
            </span>
          ) : null}

          {/* Active Super Ball Alert */}
          {vm.superBallActive ? (
            <span className="rounded bg-gradient-to-r from-amber-500 to-orange-600 px-2 py-0.5 text-[10px] font-black text-black shadow">
              🔥 SUPER BALL ACTIVE
            </span>
          ) : null}
        </div>

        {/* Right Side of Ticker: Rates & Powerplay */}
        <div className="flex items-center gap-4 font-black">
          {vm.crr ? (
            <span>
              CRR <span className="text-amber-400">{vm.crr}</span>
            </span>
          ) : null}

          {isChase && vm.rrr ? (
            <span>
              RRR <span className="text-red-400">{vm.rrr}</span>
            </span>
          ) : null}

          {!isChase && vm.projectedScore ? (
            <span>
              PROJ <span className="text-cyan-400">{vm.projectedScore}</span>
            </span>
          ) : null}

          {vm.powerplayText ? (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-amber-300">
              {vm.powerplayText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
