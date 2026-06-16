import { useEffect, useState } from "react";

/** Live countdown seconds from a server ISO end time — isolated from heavy view derivations. */
export function useCountdownSeconds(endsAt: string | null | undefined): number {
  const [seconds, setSeconds] = useState(() => computeRemainingSeconds(endsAt));

  useEffect(() => {
    setSeconds(computeRemainingSeconds(endsAt));
    if (!endsAt) return;

    const endMs = Date.parse(endsAt);
    if (Number.isNaN(endMs)) return;

    const tick = () => setSeconds(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return seconds;
}

function computeRemainingSeconds(endsAt: string | null | undefined): number {
  if (!endsAt) return 0;
  const endMs = Date.parse(endsAt);
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
}
