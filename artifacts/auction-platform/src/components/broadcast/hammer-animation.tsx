import { memo, useEffect, useState } from "react";
import { BROADCAST_FONTS } from "./tokens";

type HammerAnimationProps = {
  active: boolean;
  color?: string;
};

export const HammerAnimation = memo(function HammerAnimation({
  active,
  color = "#ef4444",
}: HammerAnimationProps) {
  const [strike, setStrike] = useState(false);

  useEffect(() => {
    if (!active) return;
    setStrike(true);
    const t = setTimeout(() => setStrike(false), 600);
    return () => clearTimeout(t);
  }, [active]);

  if (!active && !strike) return null;

  return (
    <div
      style={{
        position: "relative",
        width: 120,
        height: 120,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 72,
          transform: strike ? "rotate(-35deg) scale(1.1)" : "rotate(-15deg) scale(1)",
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: strike ? `drop-shadow(0 0 20px ${color})` : undefined,
        }}
        aria-hidden
      >
        🔨
      </div>
      {strike && (
        <div
          style={{
            position: "absolute",
            fontFamily: BROADCAST_FONTS.display,
            fontSize: 28,
            fontWeight: 900,
            color,
            letterSpacing: "0.1em",
            animation: "hammerFlash 0.5s ease-out forwards",
          }}
        >
          SOLD!
        </div>
      )}
      <style>{`
        @keyframes hammerFlash {
          0% { opacity: 0; transform: scale(0.5); }
          40% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});
