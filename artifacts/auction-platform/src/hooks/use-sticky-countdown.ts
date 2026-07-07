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
 * clears it on natural expiry (which happens immediately on read once endsAt passes).
 *
 * Holds for 5 s after endsAt so the post-expiry notification banner can
 * complete before the overlay unmounts. Operator cancel clears immediately.
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

    const endsAtMs = new Date(current.endsAt).getTime();
    const now = Date.now();

    // Server cleared countdown before it expired — operator cancelled; dismiss immediately.
    if (now < endsAtMs) {
      setLocal(null);
      return;
    }

    // Natural expiry: hold 5 s so post-expiry banner can finish.
    const holdUntil = endsAtMs + 5000;
    const remaining = holdUntil - now;
    if (remaining <= 0) {
      setLocal(null);
      return;
    }
    const id = setTimeout(() => setLocal(null), remaining);
    return () => clearTimeout(id);
  }, [serverDc?.type, serverDc?.endsAt]);

  return local;
}
