import { useEffect, useRef, useState } from "react";
import {
  INITIAL_CONNECTION_BANNER_PULSE,
  advanceConnectionBannerPulse,
  nextConnectionBannerPulseDelayMs,
  type AuctionFeedState,
  type ConnectionBannerPulse,
} from "@workspace/api-base/auction-connection-state";

export function useConnectionBannerPulse(feedState: AuctionFeedState): boolean {
  const pulseRef = useRef<ConnectionBannerPulse>(INITIAL_CONNECTION_BANNER_PULSE);
  const feedStateRef = useRef(feedState);
  feedStateRef.current = feedState;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const now = Date.now();
      const result = advanceConnectionBannerPulse(
        feedStateRef.current,
        now,
        pulseRef.current,
      );
      pulseRef.current = result.pulse;
      setVisible(result.visible);

      const delay = Math.max(200, nextConnectionBannerPulseDelayMs(
        feedStateRef.current,
        result.pulse,
        now,
      ));
      timer = setTimeout(tick, delay);
    };

    if (feedState === "live") {
      pulseRef.current = INITIAL_CONNECTION_BANNER_PULSE;
      setVisible(false);
    }

    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [feedState]);

  return visible;
}
