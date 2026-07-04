import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const DEFAULT_DURATION_MS = 480;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useAnimatedNumber(value: number, durationMs = DEFAULT_DURATION_MS) {
  const [display, setDisplay] = useState(value);
  const [isChanging, setIsChanging] = useState(false);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (fromRef.current === value) return;

    const from = fromRef.current;
    const to = value;
    fromRef.current = value;
    const start = performance.now();
    setIsChanging(true);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = from + (to - from) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        setIsChanging(false);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return { display, isChanging };
}

export function TeamWiseAnimatedNumber({
  value,
  className,
  style,
  durationMs = DEFAULT_DURATION_MS,
  format = (n) => String(Math.round(n)),
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
  durationMs?: number;
  format?: (value: number) => ReactNode;
}) {
  const { display, isChanging } = useAnimatedNumber(value, durationMs);
  return (
    <span
      className={`team-wise-animated-value${isChanging ? " team-wise-animated-value--changing" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={style}
    >
      {format(display)}
    </span>
  );
}
