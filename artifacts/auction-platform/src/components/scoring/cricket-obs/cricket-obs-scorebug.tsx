import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 3: Solid Bottom Footer / Scorebug (Non-Transparent)
 * Designed to IPL & International broadcast standards.
 *
 * Sizing & Layout Highlights:
 * - Huge, easily readable fonts across all devices and TVs
 * - Center space fully utilized with the Live Match Chase/Run Rates Hub
 * - Striker & Non-Striker names, runs, balls, boundaries & strike rate prominently displayed
 * - Bowler spell figures and large 36px over train balls
 * - Full-width high-contrast context ticker
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
        fontFamily: "'Barlow Condensed', 'Space Grotesk', -apple-system, sans-serif",
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

      {/* MAIN BROADCAST STRIP (Height: 104px for large readable figures) */}
      <div className="flex h-26 items-stretch">
        {/* 1. BATTING TEAM & SCORE BLOCK (~340px) */}
        <div
          className="flex min-w-[340px] max-w-[370px] items-center gap-4 px-5"
          style={{
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          {/* Team Crest */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/50 bg-black/70 shadow-lg">
            {batting?.logoUrl ? (
              <img
                src={batting.logoUrl}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span className="text-xl font-black tracking-wider text-amber-400">
                {batting?.shortCode?.slice(0, 3) || "BAT"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black uppercase tracking-wide text-white">
                {batting?.shortCode || "BAT"}
              </span>
              <span className="text-sm font-bold text-white/50">
                v {bowling?.shortCode || "BOWL"}
              </span>
            </div>
            <p className="truncate text-xs font-bold uppercase tracking-wider text-white/40">
              {batting?.name || "Batting Team"}
            </p>
          </div>

          {/* Large Runs-Wickets Score */}
          <div className="ml-auto flex flex-col items-end pr-1">
            <div className="flex items-baseline font-black leading-none tracking-tight text-white">
              <span className="text-5xl tabular-nums text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
                {vm.runs}
              </span>
              <span className="mx-1 text-3xl font-bold text-amber-400">-</span>
              <span className="text-4xl tabular-nums text-amber-400 drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
                {vm.wickets}
              </span>
            </div>
            <span className="mt-1 text-sm font-black uppercase tracking-widest text-amber-400">
              {vm.oversDisplay}
            </span>
          </div>
        </div>

        {/* 2. BATSMEN CREASE SECTION (~460px) */}
        <div
          className="flex min-w-[440px] flex-1 flex-col justify-center px-5 gap-1.5"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          {/* Striker Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black shadow">
                *
              </span>
              <span className="truncate text-lg font-black uppercase tracking-wider text-amber-300">
                {striker?.name || "Striker"}
              </span>
            </div>

            <div className="flex items-center gap-4 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  {striker?.runs ?? 0}
                </span>
                <span className="text-sm font-bold text-white/60">
                  ({striker?.balls ?? 0}b)
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-white/50">
                <span>4s: <strong className="text-white">{striker?.fours ?? 0}</strong></span>
                <span>6s: <strong className="text-white">{striker?.sixes ?? 0}</strong></span>
                <span className="text-amber-400 font-black">
                  SR {striker?.strikeRate != null ? striker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Non-Striker Row */}
          <div className="flex items-center justify-between border-t border-white/10 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-5 w-5 shrink-0" />
              <span className="truncate text-lg font-bold uppercase tracking-wider text-white/90">
                {nonStriker?.name || "Non-Striker"}
              </span>
            </div>

            <div className="flex items-center gap-4 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white/90">
                  {nonStriker?.runs ?? 0}
                </span>
                <span className="text-sm font-bold text-white/60">
                  ({nonStriker?.balls ?? 0}b)
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-white/50">
                <span>4s: <strong className="text-white/80">{nonStriker?.fours ?? 0}</strong></span>
                <span>6s: <strong className="text-white/80">{nonStriker?.sixes ?? 0}</strong></span>
                <span className="text-white/80 font-black">
                  SR {nonStriker?.strikeRate != null ? nonStriker.strikeRate.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CENTER MATCH HUB (~280px) — UTILIZES PREVIOUSLY EMPTY CENTER SPACE */}
        <div
          className="flex min-w-[280px] max-w-[320px] flex-col items-center justify-center px-4 text-center"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)",
          }}
        >
          {isChase && needRuns != null && ballsLeft != null ? (
            <div className="space-y-0.5">
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                CHASE EQUATION
              </span>
              <div className="text-2xl font-black uppercase tracking-wide text-amber-300">
                NEED {needRuns} RUNS
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-white/80">
                OFF {ballsLeft} BALLS · RRR {vm.rrr || "—"}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-300">
                INNINGS PACE
              </span>
              <div className="flex items-center gap-3 text-lg font-black uppercase text-white">
                <span>CRR <strong className="text-amber-400">{vm.crr || "0.00"}</strong></span>
                {vm.projectedScore ? (
                  <span>PROJ <strong className="text-cyan-400">{vm.projectedScore}</strong></span>
                ) : null}
              </div>
              {vm.powerplayText ? (
                <div className="text-[11px] font-bold text-amber-300">
                  {vm.powerplayText}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 4. BOWLER SPELL & OVER TRAIN SECTION (~420px) */}
        <div
          className="flex min-w-[380px] flex-1 flex-col justify-center px-5 gap-1.5"
          style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          {/* Bowler Name & Figures */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                BOWLER
              </span>
              <span className="truncate text-lg font-black uppercase tracking-wider text-white">
                {bowler?.name || "Bowler"}
              </span>
            </div>
            <div className="flex items-center gap-3 tabular-nums font-bold">
              <span className="rounded-md bg-black/70 px-2.5 py-0.5 text-lg font-black text-amber-400 border border-amber-400/30">
                {bowler ? `${bowler.wickets}-${bowler.runsConceded} (${bowler.overs})` : "0-0 (0.0)"}
              </span>
              <span className="text-xs text-white/60">
                ECON {bowler?.economy != null ? bowler.economy.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Over Train with Large 32px circular pills */}
          <div className="flex items-center gap-2.5 border-t border-white/10 pt-1">
            <span className="text-xs font-black uppercase tracking-wider text-white/50">
              THIS OVER:
            </span>
            <div className="flex items-center gap-2">
              {vm.thisOverLabels.length === 0 ? (
                <span className="text-xs font-bold text-white/30">—</span>
              ) : (
                vm.thisOverLabels.map((ball, idx) => {
                  const isWicket = ball === "W";
                  const isSix = ball === "6";
                  const isFour = ball === "4";
                  const isExtra = ball.includes("Wd") || ball.includes("Nb");
                  const isDot = ball === "·" || ball === "0";

                  let chipStyle = "bg-white/15 text-white border-white/30";
                  if (isWicket) {
                    chipStyle = "bg-red-600 text-white font-black border-red-400 shadow-lg shadow-red-900/60";
                  } else if (isSix) {
                    chipStyle = "bg-purple-600 text-white font-black border-purple-400 shadow-lg shadow-purple-900/60";
                  } else if (isFour) {
                    chipStyle = "bg-blue-600 text-white font-black border-blue-400 shadow-lg shadow-blue-900/60";
                  } else if (isExtra) {
                    chipStyle = "bg-amber-600 text-amber-100 font-bold border-amber-400";
                  } else if (isDot) {
                    chipStyle = "bg-black/50 text-white/40 border-white/15";
                  }

                  return (
                    <span
                      key={`${ball}-${idx}`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black tabular-nums ${chipStyle}`}
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
        <div className="flex w-20 shrink-0 items-center justify-center bg-black/40 px-3">
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

      {/* BOTTOM CONTEXT / TICKER BAR (Height: 36px with 14px bold text) */}
      <div
        className="flex h-9 items-center justify-between border-t border-white/15 px-6 text-sm font-black tracking-wider uppercase text-white/95"
        style={{
          background: "linear-gradient(90deg, #0f1523 0%, #050810 100%)",
        }}
      >
        {/* Left Side: Context / Target / Toss */}
        <div className="flex items-center gap-5">
          {isChase && needRuns != null && ballsLeft != null ? (
            <div className="flex items-center gap-2.5 text-amber-300">
              <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black text-black">
                CHASE
              </span>
              <span>
                NEED {needRuns} RUNS OFF {ballsLeft} BALLS
              </span>
              {vm.target != null ? (
                <span className="text-white/60">(TARGET {vm.target})</span>
              ) : null}
            </div>
          ) : vm.firstInningsScoreLine ? (
            <div className="flex items-center gap-2.5 text-white/80">
              <span className="text-amber-400">1ST INNINGS:</span>
              <span>{vm.firstInningsScoreLine}</span>
            </div>
          ) : vm.tossText ? (
            <div className="flex items-center gap-2.5 text-white/90">
              <span className="text-amber-400">TOSS:</span>
              <span>{vm.tossText}</span>
            </div>
          ) : (
            <span className="text-white/70">BIDWAR CRICKET LIVE BROADCAST</span>
          )}

          {/* Active Free Hit Alert */}
          {vm.freeHitActive ? (
            <span className="animate-pulse rounded bg-red-600 px-2.5 py-0.5 text-xs font-black text-white shadow">
              🎯 FREE HIT ON NEXT BALL
            </span>
          ) : null}

          {/* Active Super Ball Alert */}
          {vm.superBallActive ? (
            <span className="rounded bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-0.5 text-xs font-black text-black shadow">
              🔥 SUPER BALL ACTIVE
            </span>
          ) : null}
        </div>

        {/* Right Side: Rates & Extras */}
        <div className="flex items-center gap-5 font-black">
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
            <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-black tracking-widest text-amber-300">
              {vm.powerplayText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
