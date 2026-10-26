import { memo, useEffect, useState } from "react";
import type { LedView } from "@/lib/led-view/types";
import { EyesMascot } from "./EyesMascot";
import { TeamsPurseBoard } from "./TeamsPurseBoard";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const AWAITING_FADE_MS = 700;

/** Occasionally surfaces the awaiting eyes when hammer time has no live data. */
function useIntermittentAwaiting(suppressed: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setVisible(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleHidden = (visibleMs: number) => {
      timers.push(
        setTimeout(() => {
          setVisible(false);
          scheduleShow(5000 + Math.random() * 5000);
        }, visibleMs),
      );
    };

    const scheduleShow = (hiddenMs: number) => {
      timers.push(
        setTimeout(() => {
          setVisible(true);
          scheduleHidden(2800 + Math.random() * 2400);
        }, hiddenMs),
      );
    };

    scheduleShow(2000 + Math.random() * 4000);

    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [suppressed]);

  return visible;
}

/**
 * TIMER PANEL — countdown with progress bar scaled to tournament timer settings.
 * Includes middle TeamsPurseBoard showing all teams' remaining purse and max bid allowed per player.
 * When idle, an awaiting eyes overlay occasionally fades in over the placeholder.
 */
export const TimerPanel = memo(function TimerPanel({ view }: { view: LedView }) {
  const { state, nextMinLabel, incrementLabel, timerCeiling } = view;
  const countdown = state.countdown;
  const hammerActive = state.isBidding;
  const awaitingPeek = useIntermittentAwaiting(hammerActive);
  const urgent = hammerActive && countdown <= 5 && countdown > 0;
  const ceiling = Math.max(1, timerCeiling);
  const pct = Math.max(0, Math.min(100, (countdown / ceiling) * 100));

  return (
    <div className="flex flex-col justify-between gap-2.5 h-full min-h-0">
      <div className="flex flex-col items-end w-full shrink-0">
        <span
          className="led-label text-[clamp(0.95rem,1.3cqw,1.45rem)] font-extrabold uppercase tracking-[0.08em] text-white/85 mb-1 font-['Space_Grotesk']"
          style={{
            opacity: hammerActive || !awaitingPeek ? 1 : 0,
            transition: hammerActive ? "none" : `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
          }}
        >
          Hammer Time
        </span>

        <div className="relative w-full min-h-[8.1cqh] flex items-end justify-end">
          <div
            className="led-timer font-mono text-[clamp(2.75rem,8cqw,5rem)] font-extrabold leading-none tabular-nums"
            style={{
              color: hammerActive
                ? urgent
                  ? "#ef4444"
                  : "var(--accent)"
                : "rgba(255,255,255,0.2)",
              animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
              opacity: hammerActive ? 1 : awaitingPeek ? 0.1 : 1,
              transition: hammerActive ? "none" : `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
            }}
          >
            {hammerActive ? fmt(countdown) : "--:--"}
          </div>

          {!hammerActive ? (
            <div
              className="absolute inset-0 flex items-center justify-end gap-2 pointer-events-none"
              style={{
                opacity: awaitingPeek ? 1 : 0,
                transition: `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
              }}
            >
              <EyesMascot idle={awaitingPeek} />
              <span className="led-label text-[clamp(0.9rem,1.2cqw,1.35rem)] font-bold uppercase tracking-[0.06em] text-white/80">
                Awaiting
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-2 h-1.5 w-full bg-white/15 overflow-hidden rounded-full">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${pct}%`,
              backgroundColor: urgent ? "#ef4444" : "var(--accent)",
            }}
          />
        </div>
      </div>

      {/* Teams Purse & Max Bid board occupies the spacious middle area */}
      <TeamsPurseBoard view={view} />

      <div
        className="w-full p-2.5 border shrink-0"
        style={{
          backgroundColor: hammerActive
            ? "color-mix(in srgb, var(--accent) 15%, rgba(0,0,0,0.6))"
            : "rgba(255,255,255,0.04)",
          borderColor: hammerActive
            ? "color-mix(in srgb, var(--accent) 45%, transparent)"
            : "rgba(255,255,255,0.12)",
        }}
      >
        <p className="led-label text-[clamp(0.85rem,1.15cqw,1.3rem)] font-extrabold uppercase tracking-[0.06em] text-white/85 font-['Space_Grotesk']">
          Next Minimum
        </p>
        <p
          className="led-value font-['Bebas_Neue'] text-[clamp(1.75rem,3.2cqw,2.75rem)] font-black leading-none mt-1 tabular-nums"
          style={{ color: hammerActive ? "var(--accent)" : "rgba(255,255,255,0.85)" }}
        >
          {nextMinLabel}
        </p>
        <p className="led-value-sub text-[clamp(0.95rem,1.25cqw,1.4rem)] font-bold uppercase tracking-[0.04em] text-white/90 mt-1 tabular-nums">
          Increment {incrementLabel}
        </p>
      </div>
    </div>
  );
});
