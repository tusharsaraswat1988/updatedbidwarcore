import { memo, useEffect, useRef, useState } from "react";

type CountdownRingProps = {
  timerEndsAt?: string | null;
  size?: number;
};

export const CountdownRing = memo(function CountdownRing({
  timerEndsAt,
  size = 68,
}: CountdownRingProps) {
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(30);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(0);
      return;
    }
    const fullMs = new Date(timerEndsAt).getTime() - Date.now();
    totalRef.current = Math.max(1, Math.ceil(fullMs / 1000));
    const tick = () => {
      const ms = new Date(timerEndsAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  const pct = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const scale = size / 68;
  const r = 28 * scale;
  const cx = 34 * scale;
  const cy = 34 * scale;
  const circumference = 2 * Math.PI * r;
  const strokeDash = circumference * pct;
  const color = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#22c55e";
  const strokeWidth = Math.max(3, 4 * scale);

  if (!timerEndsAt) return null;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.25s linear" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(20 * scale),
          fontWeight: 900,
          color,
        }}
      >
        {remaining}
      </div>
    </div>
  );
});
