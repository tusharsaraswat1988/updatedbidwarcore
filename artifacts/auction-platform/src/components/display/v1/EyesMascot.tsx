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

/**
 * Two cartoon eyes that look around randomly while idle (awaiting),
 * and snap back to centre when the auction goes live or paused.
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

  // Gaze loop when idle
  useEffect(() => {
    if (!idle) {
      // Snap pupils to centre then blink once on becoming active
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
      // Pupils can move slightly independently for a more natural look
      setLeftPupil(dir);
      setRightPupil({
        x: dir.x * (0.7 + Math.random() * 0.5),
        y: dir.y * (0.7 + Math.random() * 0.5),
      });
    }

    // Initial glance
    look();
    const id = setInterval(look, 1600 + Math.random() * 800);
    return () => clearInterval(id);
  }, [idle]);

  const EYE_R = 6;
  const PUPIL_R = 2.5;
  const lx = 9;
  const rx = 27;
  const cy = 10;

  return (
    <svg
      width="36"
      height="20"
      viewBox="0 0 36 20"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Left eye white */}
      <circle cx={lx} cy={cy} r={EYE_R} fill="white" opacity={blinking ? 0.15 : 1} />
      {/* Right eye white */}
      <circle cx={rx} cy={cy} r={EYE_R} fill="white" opacity={blinking ? 0.15 : 1} />

      {!blinking && (
        <>
          {/* Left pupil */}
          <circle
            cx={lx + leftPupil.x}
            cy={cy + leftPupil.y}
            r={PUPIL_R}
            fill="#111"
            style={{ transition: "cx 0.35s cubic-bezier(.4,0,.2,1), cy 0.35s cubic-bezier(.4,0,.2,1)" }}
          />
          {/* Left pupil shine */}
          <circle
            cx={lx + leftPupil.x + 1}
            cy={cy + leftPupil.y - 1.2}
            r={0.9}
            fill="white"
            opacity={0.7}
            style={{ transition: "cx 0.35s cubic-bezier(.4,0,.2,1), cy 0.35s cubic-bezier(.4,0,.2,1)" }}
          />
          {/* Right pupil */}
          <circle
            cx={rx + rightPupil.x}
            cy={cy + rightPupil.y}
            r={PUPIL_R}
            fill="#111"
            style={{ transition: "cx 0.35s cubic-bezier(.4,0,.2,1), cy 0.35s cubic-bezier(.4,0,.2,1)" }}
          />
          {/* Right pupil shine */}
          <circle
            cx={rx + rightPupil.x + 1}
            cy={cy + rightPupil.y - 1.2}
            r={0.9}
            fill="white"
            opacity={0.7}
            style={{ transition: "cx 0.35s cubic-bezier(.4,0,.2,1), cy 0.35s cubic-bezier(.4,0,.2,1)" }}
          />
        </>
      )}
    </svg>
  );
});
