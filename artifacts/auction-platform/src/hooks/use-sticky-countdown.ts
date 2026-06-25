import { useEffect, useRef, useState } from "react";

type CountdownState = {
  endsAt: string;
  message: string | null;
} | null;

function isCountdownType(type: string | undefined): boolean {
  return type === "break" || type === "pre-auction";
}

/**
 * Keeps the last seen countdown alive on the client even after the server
 * clears it (which happens immediately on read once the countdown expires).
 *
 * Holds for 5 s after endsAt so the post-expiry notification banner can
 * complete before the overlay unmounts.
 */
export function useStickyCountdown(
  serverDc:
    | { type?: string; endsAt?: string; message?: string | null }
    | null
    | undefined,
): CountdownState {
  const [local, setLocal] = useState<CountdownState>(null);
  const localRef = useRef<CountdownState>(null);
  localRef.current = local;

  useEffect(() => {
    if (serverDc?.type && serverDc?.endsAt && isCountdownType(serverDc.type)) {
      setLocal({
        endsAt: serverDc.endsAt,
        message: serverDc.message ?? null,
      });
      return;
    }

    const current = localRef.current;
    if (!current) return;

    const holdUntil = new Date(current.endsAt).getTime() + 5000;
    const remaining = holdUntil - Date.now();
    if (remaining <= 0) {
      setLocal(null);
      return;
    }
    const id = setTimeout(() => setLocal(null), remaining);
    return () => clearTimeout(id);
  }, [serverDc?.type, serverDc?.endsAt]);

  return local;
}
