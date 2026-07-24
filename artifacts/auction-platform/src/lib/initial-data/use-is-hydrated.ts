import { useEffect, useState } from "react";

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
  hidden: Record<string, unknown>,
): Record<string, unknown> | false {
  return isHydrated ? hidden : false;
}
