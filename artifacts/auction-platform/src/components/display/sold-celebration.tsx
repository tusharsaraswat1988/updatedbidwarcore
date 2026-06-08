import { memo, useMemo } from "react";

const CONFETTI_COLORS = ["#22c55e", "#eab308", "#a78bfa", "#f59e0b", "#ef4444", "#38bdf8", "#ffffff"];

/**
 * Lightweight sold celebration — CSS-only confetti burst.
 * Auto-contained; parent unmounts after sold card phase ends.
 * No canvas / third-party libs — safe for venue hardware.
 */
export const SoldCelebration = memo(function SoldCelebration({
  teamColor = "#22c55e",
  durationSec = 4,
}: {
  teamColor?: string;
  durationSec?: number;
}) {
  const pieces = useMemo(() => {
    const palette = [teamColor, ...CONFETTI_COLORS];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${4 + (i * 3.4) % 92}%`,
      color: palette[i % palette.length],
      delay: `${(i % 7) * 0.08}s`,
      dur: `${durationSec - 0.5 + (i % 5) * 0.15}s`,
      size: 8 + (i % 4) * 3,
    }));
  }, [teamColor, durationSec]);

  return (
    <div className="absolute inset-0 z-[21] overflow-hidden pointer-events-none" aria-hidden>
      {pieces.map(p => (
        <div
          key={p.id}
          className="led-confetti-piece"
          style={{
            left: p.left,
            top: "-2%",
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            ["--fall-dur" as string]: p.dur,
            ["--fall-delay" as string]: p.delay,
          }}
        />
      ))}
    </div>
  );
});
