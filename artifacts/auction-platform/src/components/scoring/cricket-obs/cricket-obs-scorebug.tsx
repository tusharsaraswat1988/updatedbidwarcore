import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 3: Solid Bottom Footer / Scorebug (Non-Transparent)
 * Designed to IPL & International broadcast standards with sharp, clear typography.
 *
 * Professional Improvements:
 * - 100% Docked edge-to-edge layout flush to screen bottom
 * - High contrast antialiased typography
 * - Doubled font sizes across all micro-stats (4s, 6s, SR, ECON, CRR, PROJ, etc.)
 * - Instant Victory / Match Conclusion State when target is reached or match completes
 * - De-duplicated Center Hub (Hero Current Partnership & Match Pace)
 * - Unified Bowler Spell capsule (Figures + Economy)
 * - Styled circular Opponent Crest matching the batting team frame
 * - Crisp High-Contrast Bottom Ticker (48px height)
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

  const partnershipRuns = vm.partnershipRuns;
  const partnershipBalls = vm.partnershipBalls;

  const isTargetReached =
    vm.target != null && vm.runs >= vm.target && (needRuns === 0 || needRuns == null);
  const isCompleted = vm.phase === "completed" || isTargetReached;

  return (
    <div
      className="relative z-30 w-full overflow-hidden border-t-2 border-white/25 shadow-[0_-12px_40px_rgba(0,0,0,0.95)]"
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
        className="h-[4px] w-full"
        style={{
          background: isCompleted
            ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 35%, #f59e0b 65%, #d97706 100%)"
            : "linear-gradient(90deg, #3b82f6 0%, #f59e0b 25%, #ef4444 50%, #8b5cf6 75%, #3b82f6 100%)",
        }}
      />

      {/* MAIN BROADCAST STRIP (Height: 114px) */}
      <div className="flex h-[114px] items-stretch">
        {/* 1. BATTING TEAM & SCORE BLOCK (~340px) */}
        <div
          className="flex min-w-[340px] max-w-[370px] items-center gap-4 px-5"
          style={{
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {/* Team Crest */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-black/80 shadow-lg">
            {batting?.logoUrl ? (
              <img
                src={batting.logoUrl}
                alt=""
                className="h-full w-full object-contain p-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              />
            ) : (
              <span className="text-2xl font-black tracking-wider text-amber-400">
                {batting?.shortCode?.slice(0, 3) || "BAT"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black uppercase tracking-tight text-white">
                {batting?.shortCode || "BAT"}
              </span>
              <span className="text-base font-bold text-white/70">
                v {bowling?.shortCode || "BOWL"}
              </span>
            </div>
            <p className="truncate text-sm font-bold uppercase tracking-wider text-white/70">
              {batting?.name || "Batting Team"}
            </p>
          </div>

          {/* Large Runs-Wickets Score */}
          <div className="ml-auto flex flex-col items-end pr-1">
            <div className="flex items-baseline font-black leading-none tracking-tight text-white">
              <span className="text-5xl tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {vm.runs}
              </span>
              <span className="mx-1 text-4xl font-black text-amber-400">-</span>
              <span className="text-5xl tabular-nums text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {vm.wickets}
              </span>
            </div>
            <span className="mt-1 text-lg font-black uppercase tracking-widest text-amber-400">
              {vm.oversDisplay}
            </span>
          </div>
        </div>

        {/* 2. BATSMEN CREASE SECTION (~460px) - HIGH CONTRAST & DOUBLED STAT SIZES */}
        <div
          className="flex min-w-[450px] flex-1 flex-col justify-center px-6 gap-2.5"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(15, 23, 42, 0.7)",
          }}
        >
          {/* Striker Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black shadow">
                *
              </span>
              <span className="truncate text-2xl font-black uppercase tracking-wide text-amber-300">
                {striker?.name || "Striker"}
              </span>
            </div>

            <div className="flex items-center gap-4 tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">
                  {striker?.runs ?? 0}
                </span>
                <span className="text-lg font-bold text-white/80">
                  ({striker?.balls ?? 0})
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-bold">
                <span className="rounded bg-blue-500/25 px-2.5 py-0.5 text-blue-200 border border-blue-400/50">
                  4s: <strong className="text-white">{striker?.fours ?? 0}</strong>
                </span>
                <span className="rounded bg-purple-500/25 px-2.5 py-0.5 text-purple-200 border border-purple-400/50">
                  6s: <strong className="text-white">{striker?.sixes ?? 0}</strong>
                </span>
                <span className="rounded bg-amber-400/30 px-3 py-0.5 text-amber-300 border border-amber-400/50 font-black">
                  SR {striker?.strikeRate != null ? striker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Non-Striker Row */}
          <div className="flex items-center justify-between border-t border-white/15 pt-1.5">
            <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
              <span className="h-5 w-5 shrink-0" />
              <span className="truncate text-2xl font-black uppercase tracking-wide text-white/95">
                {nonStriker?.name || "Non-Striker"}
              </span>
            </div>

            <div className="flex items-center gap-4 tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white/95">
                  {nonStriker?.runs ?? 0}
                </span>
                <span className="text-lg font-bold text-white/80">
                  ({nonStriker?.balls ?? 0})
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-bold">
                <span className="rounded bg-white/15 px-2.5 py-0.5 text-white border border-white/30">
                  4s: <strong className="text-white">{nonStriker?.fours ?? 0}</strong>
                </span>
                <span className="rounded bg-white/15 px-2.5 py-0.5 text-white border border-white/30">
                  6s: <strong className="text-white">{nonStriker?.sixes ?? 0}</strong>
                </span>
                <span className="rounded bg-white/20 px-3 py-0.5 text-white border border-white/35 font-black">
                  SR {nonStriker?.strikeRate != null ? nonStriker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CENTER MATCH HUB (~280px) — VICTORY STATE OR CURRENT PARTNERSHIP */}
        <div
          className="flex min-w-[280px] max-w-[320px] flex-col items-center justify-center px-4 text-center"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
            background: isCompleted
              ? "linear-gradient(180deg, rgba(120, 53, 15, 0.7) 0%, rgba(69, 26, 3, 0.85) 100%)"
              : "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
          }}
        >
          {isCompleted ? (
            <div className="space-y-1">
              <span className="rounded-full bg-amber-400 px-3.5 py-0.5 text-xs font-black uppercase tracking-widest text-black shadow">
                🏆 MATCH WON
              </span>
              <div className="text-3xl font-black uppercase tracking-tight text-amber-400 drop-shadow">
                {vm.winner?.name || batting?.name || "CHAMPIONS"}
              </div>
              <div className="text-sm font-black uppercase tracking-wider text-white drop-shadow">
                {vm.resultText || "TARGET ACHIEVED"}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="rounded-full bg-amber-400/25 px-3.5 py-0.5 text-xs font-black uppercase tracking-widest text-amber-300 border border-amber-400/40">
                CURRENT PARTNERSHIP
              </span>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-4xl font-black text-amber-400 drop-shadow">
                  {partnershipRuns}
                </span>
                <span className="text-base font-bold uppercase tracking-wider text-white/85">
                  OFF {partnershipBalls} BALLS
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 text-sm font-bold uppercase text-white">
                <span>CRR <strong className="text-amber-300 font-black">{vm.crr || "0.00"}</strong></span>
                {isChase && vm.rrr ? (
                  <span>REQ <strong className="text-cyan-300 font-black">{vm.rrr}</strong></span>
                ) : vm.projectedScore ? (
                  <span>PROJ <strong className="text-cyan-300 font-black">{vm.projectedScore}</strong></span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* 4. BOWLER SPELL & OVER TRAIN SECTION (~420px) */}
        <div
          className="flex min-w-[390px] flex-1 flex-col justify-center px-6 gap-2.5"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(15, 23, 42, 0.7)",
          }}
        >
          {/* Bowler Name & Figures */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                BOWLER
              </span>
              <span className="truncate text-2xl font-black uppercase tracking-wide text-white">
                {bowler?.name || "Bowler"}
              </span>
            </div>

            {/* Unified Dark Metallic Bowler Stats Capsule */}
            <div className="flex items-center gap-3 rounded-lg bg-black/80 px-3.5 py-1 border border-white/25 shadow-sm tabular-nums">
              <span className="text-xl font-black text-amber-400">
                {bowler ? `${bowler.wickets}-${bowler.runsConceded} (${bowler.overs})` : "0-0 (0.0)"}
              </span>
              <span className="h-4 w-[1px] bg-white/30" />
              <span className="text-sm font-black text-cyan-300">
                ECON {bowler?.economy != null ? bowler.economy.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Over Train with Large 36px Circular Delivery Pills */}
          <div className="flex items-center gap-3 border-t border-white/15 pt-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-white/70">
              THIS OVER:
            </span>
            <div className="flex items-center gap-2">
              {vm.thisOverLabels.length === 0 ? (
                <span className="text-base font-bold text-white/50">—</span>
              ) : (
                vm.thisOverLabels.map((ball, idx) => {
                  const isWicket = ball === "W";
                  const isSix = ball === "6";
                  const isFour = ball === "4";
                  const isExtra = ball.includes("Wd") || ball.includes("Nb");
                  const isDot = ball === "·" || ball === "0";

                  let chipStyle = "bg-white/20 text-white border-white/35";
                  if (isWicket) {
                    chipStyle = "bg-red-600 text-white font-black border-red-400 shadow-md shadow-red-900/70";
                  } else if (isSix) {
                    chipStyle = "bg-purple-600 text-white font-black border-purple-400 shadow-md shadow-purple-900/70";
                  } else if (isFour) {
                    chipStyle = "bg-blue-600 text-white font-black border-blue-400 shadow-md shadow-blue-900/70";
                  } else if (isExtra) {
                    chipStyle = "bg-amber-600 text-amber-100 font-black border-amber-400";
                  } else if (isDot) {
                    chipStyle = "bg-black/70 text-white/60 border-white/25";
                  }

                  return (
                    <span
                      key={`${ball}-${idx}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-black tabular-nums shadow-sm ${chipStyle}`}
                    >
                      {ball}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. OPPONENT CREST (~80px) */}
        <div className="flex w-20 shrink-0 items-center justify-center bg-black/50 px-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-black/80 p-1 shadow-md">
            {bowling?.logoUrl ? (
              <img
                src={bowling.logoUrl}
                alt=""
                className="h-full w-full object-contain drop-shadow"
              />
            ) : (
              <span className="text-lg font-black uppercase text-white/50">
                {bowling?.shortCode || "BOWL"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTEXT / TICKER BAR (Height: 44px with large bold font) */}
      <div
        className="flex h-[44px] items-center justify-between border-t border-white/20 px-6 text-base font-black tracking-wide uppercase text-white"
        style={{
          background: isCompleted
            ? "linear-gradient(90deg, #451a03 0%, #1e1b4b 100%)"
            : "linear-gradient(90deg, #0f1523 0%, #050810 100%)",
        }}
      >
        {/* Left Side: Context / Target / Toss / Result */}
        <div className="flex items-center gap-5">
          {isCompleted ? (
            <div className="flex items-center gap-3">
              <span className="rounded bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-0.5 text-xs font-black text-black shadow">
                🏆 FINAL RESULT
              </span>
              <span className="text-lg font-black text-amber-300 drop-shadow">
                {vm.resultText || `${batting?.name || "BATTERS"} WON THE MATCH`}
              </span>
              {vm.target != null ? (
                <span className="text-sm font-bold text-white/80">
                  (TARGET {vm.target} REACHED IN {vm.oversLabel} OV)
                </span>
              ) : null}
            </div>
          ) : isChase && needRuns != null && ballsLeft != null ? (
            <div className="flex items-center gap-3 text-amber-300">
              <span className="rounded bg-amber-400 px-3 py-0.5 text-xs font-black text-black">
                CHASE
              </span>
              <span className="text-base font-black">
                NEED {needRuns} RUNS OFF {ballsLeft} BALLS
              </span>
              {vm.target != null ? (
                <span className="text-sm font-bold text-white/80">(TARGET {vm.target})</span>
              ) : null}
            </div>
          ) : vm.firstInningsScoreLine ? (
            <div className="flex items-center gap-2.5 text-white/95">
              <span className="text-amber-400 font-black">1ST INNINGS:</span>
              <span className="text-base font-bold">{vm.firstInningsScoreLine}</span>
            </div>
          ) : vm.tossText ? (
            <div className="flex items-center gap-2.5 text-white">
              <span className="text-amber-400 font-black">TOSS:</span>
              <span className="text-base font-bold">{vm.tossText}</span>
            </div>
          ) : (
            <span className="text-white/85 text-base">BIDWAR CRICKET LIVE BROADCAST</span>
          )}

          {/* Active Free Hit Alert */}
          {vm.freeHitActive && !isCompleted ? (
            <span className="animate-pulse rounded bg-red-600 px-3 py-0.5 text-xs font-black text-white shadow">
              🎯 FREE HIT ON NEXT BALL
            </span>
          ) : null}

          {/* Active Super Ball Alert */}
          {vm.superBallActive && !isCompleted ? (
            <span className="rounded bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-0.5 text-xs font-black text-black shadow">
              🔥 SUPER BALL ACTIVE
            </span>
          ) : null}
        </div>

        {/* Right Side: Rates & Extras */}
        <div className="flex items-center gap-5 text-base font-black">
          {vm.crr ? (
            <span>
              CRR <span className="text-amber-400">{vm.crr}</span>
            </span>
          ) : null}

          {isChase && vm.rrr && !isCompleted ? (
            <span>
              RRR <span className="text-red-400">{vm.rrr}</span>
            </span>
          ) : null}

          {!isChase && vm.projectedScore && !isCompleted ? (
            <span>
              PROJ <span className="text-cyan-400">{vm.projectedScore}</span>
            </span>
          ) : null}

          {vm.powerplayText && !isCompleted ? (
            <span className="rounded bg-white/20 px-3 py-0.5 text-xs font-black tracking-widest text-amber-300">
              {vm.powerplayText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
