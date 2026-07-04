import { useCountdown } from "@/hooks/useCountdown";

export type ParsedDisplayCountdown = {
  type?: string;
  endsAt?: string;
  message?: string | null;
};

export function parseDisplayCountdown(raw: unknown): ParsedDisplayCountdown | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return parseDisplayCountdown(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    const dc = raw as ParsedDisplayCountdown;
    return dc.endsAt ? dc : null;
  }
  return null;
}

function isFutureEndsAt(endsAt: string): boolean {
  return new Date(endsAt).getTime() > Date.now();
}

/** Resolve active break/pre-auction countdown end time from auction state. */
export function breakCountdownEndsAt(raw: unknown): string | null {
  const dc = parseDisplayCountdown(raw);
  if (!dc?.endsAt || !isFutureEndsAt(dc.endsAt)) return null;
  if (dc.type && dc.type !== "break" && dc.type !== "pre-auction") return null;
  return dc.endsAt;
}

export function useBreakCountdownFromState(
  state: { displayCountdown?: unknown; lastAction?: string | null; status?: string } | null | undefined,
) {
  const parsed = parseDisplayCountdown(state?.displayCountdown);
  const breakEndsAt = breakCountdownEndsAt(state?.displayCountdown);
  const pausedForBreak = isAuctionPausedForBreak(state?.lastAction) && state?.status === "paused";
  const { secondsLeft } = useCountdown(breakEndsAt);
  const hasLiveCountdown = !!breakEndsAt && secondsLeft > 0;
  const isOnBreak = hasLiveCountdown || pausedForBreak;

  return {
    isOnBreak,
    hasLiveCountdown,
    breakMins: Math.floor(secondsLeft / 60),
    breakSecs: secondsLeft % 60,
    breakLabel: parsed?.type === "pre-auction" ? "Starting Soon" : "On Break",
    breakMessage: parsed?.message ?? null,
    breakEndsAt,
  };
}

export function isAuctionPausedForBreak(lastAction: string | null | undefined): boolean {
  return lastAction === "Auction paused for break";
}
