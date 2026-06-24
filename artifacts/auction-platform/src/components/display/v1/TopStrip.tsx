import { memo, useEffect, useRef, useState } from "react";
import type { LedView } from "@/lib/led-view/types";

/* ─── Animated eyes mascot (shown when auction is awaiting) ─── */

type Offset = { x: number; y: number };
const CENTER: Offset = { x: 0, y: 0 };
const MAX_R = 2.5;
const GAZE_DIRS: Offset[] = [
  { x: MAX_R, y: 0 }, { x: -MAX_R, y: 0 },
  { x: 0, y: -MAX_R }, { x: 0, y: MAX_R },
  { x: MAX_R * 0.7, y: -MAX_R * 0.7 }, { x: -MAX_R * 0.7, y: -MAX_R * 0.7 },
  { x: MAX_R * 0.7, y: MAX_R * 0.7 }, { x: -MAX_R * 0.7, y: MAX_R * 0.7 },
];
function randomDir(exclude?: Offset): Offset {
  const choices = exclude
    ? GAZE_DIRS.filter((d) => d.x !== exclude.x || d.y !== exclude.y)
    : GAZE_DIRS;
  return choices[Math.floor(Math.random() * choices.length)]!;
}

const EyesMascot = memo(function EyesMascot({ idle }: { idle: boolean }) {
  const [left, setLeft] = useState<Offset>(CENTER);
  const [right, setRight] = useState<Offset>(CENTER);
  const [blink, setBlink] = useState(false);
  const lastDir = useRef<Offset | null>(null);

  useEffect(() => {
    if (!idle) {
      setLeft(CENTER);
      setRight(CENTER);
      setBlink(true);
      const t = setTimeout(() => setBlink(false), 180);
      lastDir.current = null;
      return () => clearTimeout(t);
    }
    function look() {
      const dir = randomDir(lastDir.current ?? undefined);
      lastDir.current = dir;
      setLeft(dir);
      setRight({ x: dir.x * (0.8 + Math.random() * 0.4), y: dir.y * (0.8 + Math.random() * 0.4) });
    }
    look();
    const id = setInterval(look, 1500 + Math.random() * 900);
    return () => clearInterval(id);
  }, [idle]);

  const EYE_R = 6;
  const PUPIL_R = 2.4;
  const ey = 11;

  return (
    <svg width="46" height="22" viewBox="0 0 46 22" style={{ display: "block", flexShrink: 0 }}>
      {/* Left eye */}
      <circle cx={10} cy={ey} r={EYE_R} fill="white" opacity={blink ? 0.15 : 1} />
      {!blink && (
        <g style={{ transform: `translate(${left.x}px,${left.y}px)`, transition: "transform 0.32s cubic-bezier(.4,0,.2,1)" }}>
          <circle cx={10} cy={ey} r={PUPIL_R} fill="#1a1a1a" />
          <circle cx={11.2} cy={ey - 1.4} r={0.85} fill="white" opacity={0.75} />
        </g>
      )}
      {/* Right eye */}
      <circle cx={36} cy={ey} r={EYE_R} fill="white" opacity={blink ? 0.15 : 1} />
      {!blink && (
        <g style={{ transform: `translate(${right.x}px,${right.y}px)`, transition: "transform 0.32s cubic-bezier(.4,0,.2,1)" }}>
          <circle cx={36} cy={ey} r={PUPIL_R} fill="#1a1a1a" />
          <circle cx={37.2} cy={ey - 1.4} r={0.85} fill="white" opacity={0.75} />
        </g>
      )}
    </svg>
  );
});

/* ─── TopStrip ─── */

/**
 * TOP STRIP — BIDWAR LIVE brand, tournament line, LIVE pill, remaining counter.
 * Pure presentation. Sourced from TOURNAMENT + state.isBidding + queue.length.
 */
export const TopStrip = memo(function TopStrip({ view }: { view: LedView }) {
  const { tournament, state, remaining, totalPlayers } = view;
  const paused = view.derivedState === "paused";
  const live = state.isBidding && !paused;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-[3%] min-h-[3.5rem] h-full border-b border-white/10 bg-black/40 overflow-hidden">
      {/* Left: brand mark + tournament */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            BIDWAR
          </span>
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            LIVE
          </span>
        </div>
        <div className="hidden md:flex flex-col leading-none border-l border-white/15 pl-4">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
            Tournament
          </span>
          <span className="font-['Bebas_Neue'] text-base tracking-widest uppercase text-white/95 mt-1">
            {tournament.name}
          </span>
        </div>
      </div>

      {/* Center: LIVE pill */}
      <div className="flex items-center justify-center">
        <div
          className={`flex items-center gap-2 px-4 py-1.5 border ${
            live
              ? "border-red-500/50 bg-red-500/10"
              : paused
                ? "border-amber-400/50 bg-amber-400/10"
                : "border-white/15 bg-white/5"
          }`}
        >
          {!live && !paused ? (
            /* Awaiting: cartoon eyes instead of static text */
            <>
              <EyesMascot idle />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/50">
                Awaiting
              </span>
            </>
          ) : (
            <>
              <span
                className={`size-2 rounded-full ${
                  live
                    ? "bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"
                    : "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
                }`}
              />
              <span
                className={`text-[10px] font-mono uppercase tracking-[0.4em] ${
                  live ? "text-red-300" : "text-amber-300"
                }`}
              >
                {live ? "Live · Bidding Open" : "Paused"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: remaining players */}
      <div className="flex flex-col items-end leading-none">
        <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
          Players Remaining
        </span>
        <span className="font-['Bebas_Neue'] text-2xl tabular-nums mt-1 text-white/95">
          <span style={{ color: "var(--accent)" }}>{remaining}</span>
          <span className="text-white/40"> / {totalPlayers}</span>
        </span>
      </div>
    </div>
  );
});
