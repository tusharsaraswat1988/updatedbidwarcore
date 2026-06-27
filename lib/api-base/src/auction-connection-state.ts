/** Transport-level SSE socket status (from useAuctionSocket). */
export type AuctionSocketStatus = "connected" | "reconnecting" | "disconnected";

/** User-facing auction feed state derived from socket + operator activity. */
export type AuctionFeedState =
  | "live"
  | "awaiting_operator_response"
  | "reconnecting"
  | "disconnected";

/** SSE / REST payloads that mutate auction state or bids. */
export const AUCTION_ACTIVITY_EVENT_TYPES = new Set([
  "auction_state",
  "bid",
  "sold",
  "unsold",
]);

/** Default idle threshold before "Awaiting Operator Response". */
export const DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS = 60_000;

/** Re-show the banner after this interval while the feed stays non-live. */
export const CONNECTION_BANNER_REMIND_INTERVAL_MS = 60_000;

/** How long each banner pulse stays visible before auto-hiding. */
export const CONNECTION_BANNER_VISIBLE_MS = 5_000;

const activityByTournament = new Map<number, number>();

export function isAuctionActivityEventType(type: string | undefined): boolean {
  return type != null && AUCTION_ACTIVITY_EVENT_TYPES.has(type);
}

export function parseActivityTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Keep the most recent operator-driven activity timestamp per tournament. */
export function recordAuctionActivity(tournamentId: number, atMs: number): void {
  if (!Number.isFinite(atMs)) return;
  const prev = activityByTournament.get(tournamentId) ?? 0;
  if (atMs > prev) activityByTournament.set(tournamentId, atMs);
}

export function getRecordedAuctionActivity(tournamentId: number): number | null {
  return activityByTournament.get(tournamentId) ?? null;
}

export function clearRecordedAuctionActivity(tournamentId: number): void {
  activityByTournament.delete(tournamentId);
}

export type AuctionFeedAudience = "viewer" | "operator";

export function resolveAuctionFeedState(input: {
  connectionStatus: AuctionSocketStatus;
  lastActivityAt: number | null;
  now?: number;
  awaitingThresholdMs?: number;
  /** Operator console stays "live" while connected — idle timeout is for display surfaces only. */
  audience?: AuctionFeedAudience;
}): {
  state: AuctionFeedState;
  lastActivityAt: number | null;
  secondsSinceLastActivity: number | null;
} {
  const now = input.now ?? Date.now();
  const threshold = input.awaitingThresholdMs ?? DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS;
  const lastActivityAt = input.lastActivityAt;
  const secondsSinceLastActivity =
    lastActivityAt == null ? null : Math.max(0, Math.floor((now - lastActivityAt) / 1000));

  if (input.connectionStatus === "disconnected") {
    return { state: "disconnected", lastActivityAt, secondsSinceLastActivity };
  }
  if (input.connectionStatus === "reconnecting") {
    return { state: "reconnecting", lastActivityAt, secondsSinceLastActivity };
  }

  if (
    input.audience !== "operator" &&
    lastActivityAt != null &&
    now - lastActivityAt > threshold
  ) {
    return { state: "awaiting_operator_response", lastActivityAt, secondsSinceLastActivity };
  }

  return { state: "live", lastActivityAt, secondsSinceLastActivity };
}

export const AUCTION_FEED_UI: Record<
  AuctionFeedState,
  { title: string; subtitle: string; diagnosticLabel: string }
> = {
  live: {
    title: "Live",
    subtitle: "Receiving auction updates",
    diagnosticLabel: "Live feed",
  },
  awaiting_operator_response: {
    title: "Awaiting Operator Response",
    subtitle: "Waiting for latest auction update",
    diagnosticLabel: "Awaiting operator",
  },
  reconnecting: {
    title: "Reconnecting to Auction Room",
    subtitle: "Attempting to restore live connection",
    diagnosticLabel: "Reconnecting",
  },
  disconnected: {
    title: "Connection Lost",
    subtitle: "Unable to receive auction updates",
    diagnosticLabel: "Disconnected",
  },
};

export function formatLastActivityDiagnostic(secondsSinceLastActivity: number | null): string | null {
  if (secondsSinceLastActivity == null) return null;
  return `Last activity ${secondsSinceLastActivity}s ago`;
}

export type ConnectionBannerPulse = {
  lastShownAt: number | null;
  visibleUntil: number | null;
};

export const INITIAL_CONNECTION_BANNER_PULSE: ConnectionBannerPulse = {
  lastShownAt: null,
  visibleUntil: null,
};

/** Show briefly, hide, then re-show every remind interval while feed stays non-live. */
export function advanceConnectionBannerPulse(
  feedState: AuctionFeedState,
  now: number,
  pulse: ConnectionBannerPulse,
): { visible: boolean; pulse: ConnectionBannerPulse } {
  if (feedState === "live") {
    return { visible: false, pulse: INITIAL_CONNECTION_BANNER_PULSE };
  }

  if (pulse.visibleUntil != null && now < pulse.visibleUntil) {
    return { visible: true, pulse };
  }

  const due =
    pulse.lastShownAt == null ||
    now - pulse.lastShownAt >= CONNECTION_BANNER_REMIND_INTERVAL_MS;

  if (due) {
    return {
      visible: true,
      pulse: {
        lastShownAt: now,
        visibleUntil: now + CONNECTION_BANNER_VISIBLE_MS,
      },
    };
  }

  return { visible: false, pulse };
}

export function nextConnectionBannerPulseDelayMs(
  feedState: AuctionFeedState,
  pulse: ConnectionBannerPulse,
  now: number,
): number {
  if (feedState === "live") return CONNECTION_BANNER_REMIND_INTERVAL_MS;

  if (pulse.visibleUntil != null && now < pulse.visibleUntil) {
    return pulse.visibleUntil - now;
  }

  if (pulse.lastShownAt == null) return 0;

  const nextShowAt = pulse.lastShownAt + CONNECTION_BANNER_REMIND_INTERVAL_MS;
  return Math.max(0, nextShowAt - now);
}
