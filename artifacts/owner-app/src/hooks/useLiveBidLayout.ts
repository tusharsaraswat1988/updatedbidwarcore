import { useEffect, useState } from "react";

/** mobile <768 · tablet 768–1023 · laptop ≥1024 */
export type DeviceTier = "mobile" | "tablet" | "laptop";

/** stacked = phone/portrait · split = side panel with 40% bid column */
export type LiveBidLayout = "stacked" | "split";

function compute(width: number, height: number): { layout: LiveBidLayout; tier: DeviceTier } {
  const tier: DeviceTier = width >= 1024 ? "laptop" : width >= 768 ? "tablet" : "mobile";
  const landscape = width > height;
  const split = width >= 1024 || (width >= 768 && landscape);
  return { layout: split ? "split" : "stacked", tier };
}

export function useLiveBidLayout(): { layout: LiveBidLayout; tier: DeviceTier } {
  const [state, setState] = useState(() => compute(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const update = () => setState(compute(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
