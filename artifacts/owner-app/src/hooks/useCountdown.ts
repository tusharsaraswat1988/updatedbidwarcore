import { useEffect, useState } from "react";

export function useCountdown(endsAt: string | null | undefined) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!endsAt) return 0;
    return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!endsAt) { setSecondsLeft(0); return; }

    function tick() {
      const ms = new Date(endsAt!).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.round(ms / 1000)));
    }

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  return {
    secondsLeft,
    isActive: secondsLeft > 0,
    isExpired: !!endsAt && secondsLeft === 0,
  };
}
