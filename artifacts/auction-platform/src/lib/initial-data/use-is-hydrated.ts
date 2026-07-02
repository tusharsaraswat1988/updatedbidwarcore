import { useEffect, useState } from "react";

/** False on the server and until the client finishes hydrating. */
export function useIsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
