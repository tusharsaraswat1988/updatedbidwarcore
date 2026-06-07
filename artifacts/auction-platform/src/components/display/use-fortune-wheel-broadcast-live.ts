import { useEffect, useRef, useState } from "react";

/**
 * Gate the fortune-wheel overlay so stale `fortuneWheelActive` from a prior
 * session does not cover the LED on connect. The overlay only goes live after
 * we've observed the flag turn off once (operator opened auction control or
 * closed a prior broadcast), or while a spin is actively in progress.
 */
export function useFortuneWheelBroadcastLive(
  fortuneWheelActive: boolean | null | undefined,
  wheelSpinning: boolean | null | undefined,
): boolean {
  const sawInactiveRef = useRef(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const active = !!fortuneWheelActive;
    const spinning = !!wheelSpinning;

    if (spinning) {
      setLive(true);
      return;
    }

    if (!active) {
      sawInactiveRef.current = true;
      setLive(false);
      return;
    }

    setLive(sawInactiveRef.current);
  }, [fortuneWheelActive, wheelSpinning]);

  return live;
}
