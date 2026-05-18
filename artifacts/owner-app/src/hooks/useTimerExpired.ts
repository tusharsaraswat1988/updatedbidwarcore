import { useEffect, useState } from "react";

export function useTimerExpired(timerEndsAt: string | null | undefined): boolean {
  const [expired, setExpired] = useState<boolean>(() => {
    if (!timerEndsAt) return false;
    return new Date(timerEndsAt).getTime() <= Date.now();
  });

  useEffect(() => {
    if (!timerEndsAt) { setExpired(false); return; }
    const remaining = new Date(timerEndsAt).getTime() - Date.now();
    if (remaining <= 0) { setExpired(true); return; }
    setExpired(false);
    const id = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(id);
  }, [timerEndsAt]);

  return expired;
}
