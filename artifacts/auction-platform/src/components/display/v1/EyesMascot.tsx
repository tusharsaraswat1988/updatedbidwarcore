import { memo, useEffect, useRef, useState } from "react";

type Offset = { x: number; y: number };

const CENTER: Offset = { x: 0, y: 0 };
const MAX_R = 2.8;

const GAZE_DIRS: Offset[] = [
  { x: MAX_R, y: 0 },
  { x: -MAX_R, y: 0 },
  { x: 0, y: -MAX_R },
  { x: 0, y: MAX_R },
  { x: MAX_R * 0.7, y: -MAX_R * 0.7 },
  { x: -MAX_R * 0.7, y: -MAX_R * 0.7 },
  { x: MAX_R * 0.7, y: MAX_R * 0.7 },
  { x: -MAX_R * 0.7, y: MAX_R * 0.7 },
];

function randomDir(exclude?: Offset): Offset {
  const choices = exclude
    ? GAZE_DIRS.filter((d) => d.x !== exclude.x || d.y !== exclude.y)
    : GAZE_DIRS;
  return choices[Math.floor(Math.random() * choices.length)]!;
}

const TRANSITION = "transform 0.35s cubic-bezier(.4,0,.2,1)";

/**
 * Two cartoon eyes that look around randomly while idle (awaiting),
 * and snap back to centre when the auction goes live or paused.
 *
 * Uses `transform` on `<g>` elements — not cx/cy — because CSS transitions
 * on SVG presentation attributes are unreliable in React.
 */
export const EyesMascot = memo(function EyesMascot({
  idle,
}: {
  idle: boolean;
}) {
  const [leftPupil, setLeftPupil] = useState<Offset>(CENTER);
  const [rightPupil, setRightPupil] = useState<Offset>(CENTER);
  const [blinking, setBlinking] = useState(false);
  const lastDir = useRef<Offset | null>(null);

  useEffect(() => {
    if (!idle) {
      setLeftPupil(CENTER);
      setRightPupil(CENTER);
      setBlinking(true);
      const t = setTimeout(() => setBlinking(false), 200);
      lastDir.current = null;
      return () => clearTimeout(t);
    }

    function look() {
      const dir = randomDir(lastDir.current ?? undefined);
      lastDir.current = dir;
      setLeftPupil(dir);
      setRightPupil({
        x: dir.x * (0.7 + Math.random() * 0.5),
        y: dir.y * (0.7 + Math.random() * 0.5),
      });
    }

    look();
    const id = setInterval(look, 1600 + Math.random() * 800);
    return () => clearInterval(id);
  }, [idle]);

  const EYE_R = 6;
  const PUPIL_R = 2.5;
  const lx = 9;
  const rx = 27;
  const ey = 10;

  // Blink: squish the eyes vertically
  const eyeScaleY = blinking ? 0.08 : 1;

  return (
    <svg
      width="44"
      height="24"
      viewBox="0 0 44 24"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Left eye */}
      <g
        transform={`translate(${lx}, ${ey})`}
        style={{ transition: "transform 0.1s" }}
      >
        {/* Eye white with blink squish */}
        <ellipse
          cx={0}
          cy={0}
          rx={EYE_R}
          ry={EYE_R}
          fill="white"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.5}
          style={{
            transform: `scaleY(${eyeScaleY})`,
            transition: "transform 0.07s",
            transformOrigin: "0 0",
          }}
        />
        {/* Left pupil group — translate for smooth gaze */}
        <g
          style={{
            transform: `translate(${leftPupil.x}px, ${leftPupil.y}px)`,
            transition: TRANSITION,
          }}
        >
          <ellipse
            cx={0}
            cy={0}
            rx={PUPIL_R}
            ry={PUPIL_R * (blinking ? 0.1 : 1)}
            fill="#111"
            style={{ transition: "ry 0.07s" }}
          />
          {/* Shine */}
          <circle cx={1} cy={-1.2} r={0.9} fill="white" opacity={0.7} />
        </g>
      </g>

      {/* Right eye */}
      <g
        transform={`translate(${rx}, ${ey})`}
        style={{ transition: "transform 0.1s" }}
      >
        <ellipse
          cx={0}
          cy={0}
          rx={EYE_R}
          ry={EYE_R}
          fill="white"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.5}
          style={{
            transform: `scaleY(${eyeScaleY})`,
            transition: "transform 0.07s",
            transformOrigin: "0 0",
          }}
        />
        {/* Right pupil group */}
        <g
          style={{
            transform: `translate(${rightPupil.x}px, ${rightPupil.y}px)`,
            transition: TRANSITION,
          }}
        >
          <ellipse
            cx={0}
            cy={0}
            rx={PUPIL_R}
            ry={PUPIL_R * (blinking ? 0.1 : 1)}
            fill="#111"
            style={{ transition: "ry 0.07s" }}
          />
          <circle cx={1} cy={-1.2} r={0.9} fill="white" opacity={0.7} />
        </g>
      </g>
    </svg>
  );
});
