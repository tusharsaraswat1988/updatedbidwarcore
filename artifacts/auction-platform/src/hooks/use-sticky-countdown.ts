import { useEffect, useRef, useState } from "react";

type CountdownState = {
  type: "break" | "pre-auction";
  endsAt: string;
  message: string | null;
} | null;

/**
 * Keeps the last seen countdown alive on the client even after the server
 * clears it (which happens immediately on read once the countdown expires).
 *
 * - Break / pre-auction: holds for 5 s after endsAt so the post-expiry
 *   notification banner can complete before the overlay unmounts.
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
    if (serverDc?.type && serverDc?.endsAt) {
      setLocal({
        type: serverDc.type as "break" | "pre-auction",
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
