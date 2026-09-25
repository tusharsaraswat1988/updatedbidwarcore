import { useEffect, useRef, useState, type ReactNode } from "react";

/** Preview helper: scales the fixed 1920x1080 stage to fit its container. Not used on /obs. */
export function ScaledStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1920));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        {children}
      </div>
    </div>
  );
}
