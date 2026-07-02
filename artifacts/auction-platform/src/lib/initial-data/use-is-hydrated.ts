import { useEffect, useState } from "react";
import type { TargetAndTransition } from "framer-motion";

/** False on the server and until the client finishes hydrating. */
export function useIsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

/** Render at the visible `animate` state on SSR/first paint; animate in after hydration. */
export function enterInitial(
  isHydrated: boolean,
  hidden: TargetAndTransition,
): TargetAndTransition | false {
  return isHydrated ? hidden : false;
}
