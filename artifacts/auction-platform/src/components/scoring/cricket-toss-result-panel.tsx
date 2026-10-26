import { useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TossResultCopy } from "@/lib/cricket-toss-result";

function WinnerMark({
  copy,
  className,
}: {
  copy: TossResultCopy;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (copy.winnerLogoUrl && !failed) {
    return (
      <img
        src={copy.winnerLogoUrl}
        alt=""
        className={cn("object-contain bg-black/40", className)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-amber-500/15 text-amber-200 font-black",
        className,
      )}
    >
      {copy.winnerShort}
    </div>
  );
}

export function CricketTossResultPanel({
  variant,
  copy,
}: {
  variant: "led" | "fan";
  copy: TossResultCopy;
}) {
  if (variant === "fan") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#1a1408] via-[#12100c] to-[#08151f] p-5 sm:p-7 shadow-xl text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
          Official toss
        </p>
        <div className="relative mt-4 flex items-center gap-4">
          <WinnerMark
            copy={copy}
            className="h-16 w-16 shrink-0 rounded-2xl border border-amber-300/40"
          />
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wide leading-tight">
              {copy.winnerName}
            </h2>
            <p className="mt-1 text-sm sm:text-base font-bold text-amber-200">
              Won the toss and elected to {copy.decisionLabel} first
            </p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Batting</p>
            <p className="mt-1 font-bold truncate">{copy.battingName}</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Bowling</p>
            <p className="mt-1 font-bold truncate">{copy.bowlingName}</p>
          </div>
        </div>
        <p className="relative mt-4 text-xs text-white/60">
          Lineups are being set. The scoreboard opens with the first ball.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl my-auto flex flex-col items-center text-center gap-5 sm:gap-7 px-2">
      <p className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-[0.28em] text-amber-300">
        Official toss
      </p>
      <WinnerMark
        copy={copy}
        className="h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 rounded-full border-4 border-amber-200/80 shadow-[0_0_60px_rgba(245,158,11,0.45)]"
      />
      <div className="space-y-3">
        <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black uppercase tracking-wide text-white leading-none drop-shadow-md">
          {copy.winnerName}
        </h2>
        <p className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wide text-amber-300">
          Won the toss and elected to {copy.decisionLabel} first
        </p>
      </div>
      <div className="w-full grid grid-cols-2 gap-3 sm:gap-5 max-w-4xl">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 sm:py-5">
          <p className="text-sm sm:text-lg font-black uppercase tracking-[0.18em] text-emerald-300">
            Batting
          </p>
          <p className="mt-2 text-xl sm:text-3xl md:text-4xl font-black uppercase text-white truncate">
            {copy.battingName}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 sm:py-5">
          <p className="text-sm sm:text-lg font-black uppercase tracking-[0.18em] text-amber-200">
            Bowling
          </p>
          <p className="mt-2 text-xl sm:text-3xl md:text-4xl font-black uppercase text-white truncate">
            {copy.bowlingName}
          </p>
        </div>
      </div>
      <p className="inline-flex items-center gap-2 text-base sm:text-xl font-bold uppercase tracking-wider text-white/70">
        <Shield className="h-5 w-5 text-amber-300" />
        Scoreboard opens with the first ball
      </p>
    </div>
  );
}
