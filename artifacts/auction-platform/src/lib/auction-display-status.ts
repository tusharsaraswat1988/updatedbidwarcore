/**
 * Single source of truth for pause / break / live display semantics.
 * LED, Live Viewer, and Broadcast Overlay all derive overlay behavior from here.
 */

export type AuctionDisplayPhase = "live" | "paused" | "break" | "idle" | "sold" | "unsold";

export type ParsedDisplayCountdown = {
  type: "break" | "pre-auction";
  endsAt: string;
  message: string | null;
};

export type AuctionOutcomeRecord = {
  playerName: string | null;
  photoUrl: string | null;
  teamName: string | null;
  teamColor: string | null;
  teamLogoUrl: string | null;
  amount: number | null;
};

export type AuctionDisplayOutcome = {
  type: "sold" | "unsold";
  action: string;
  isManual: boolean;
  /** Authoritative result data from the server, when available. */
  record: AuctionOutcomeRecord | null;
} | null;

type RawCountdown = {
  type?: string;
  endsAt?: string;
  message?: string | null;
  label?: string | null;
} | null | undefined;

/** Structured outcome emitted by the backend (auction_sessions.lastOutcome). */
type RawOutcome = {
  type?: string | null;
  playerName?: string | null;
  photoUrl?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  teamLogoUrl?: string | null;
  amount?: number | null;
  isManual?: boolean | null;
} | null | undefined;

type RawAuctionState = {
  status?: string | null;
  lastAction?: string | null;
  outcome?: RawOutcome;
  displayCountdown?: RawCountdown;
} | null | undefined;

export function parseDisplayCountdown(dc: RawCountdown): ParsedDisplayCountdown | null {
  if (!dc?.type || !dc.endsAt) return null;
  if (dc.type !== "break" && dc.type !== "pre-auction") return null;
  return {
    type: dc.type,
    endsAt: dc.endsAt,
    message: dc.message ?? null,
  };
}

export function parseAuctionDisplayOutcome(lastAction: string | null | undefined): AuctionDisplayOutcome {
  const action = lastAction?.trim();
  if (!action) return null;
  if (action.startsWith("SOLD:")) {
    return { type: "sold", action, isManual: /\(manual\)\s*$/i.test(action), record: null };
  }
  if (action.startsWith("UNSOLD:")) {
    return { type: "unsold", action, isManual: false, record: null };
  }
  return null;
}

/**
 * Prefer the authoritative structured outcome the backend now emits; fall back to
 * parsing the human-readable lastAction string for older servers.
 */
export function resolveAuctionDisplayOutcome(state: RawAuctionState): AuctionDisplayOutcome {
  const raw = state?.outcome;
  if (raw && (raw.type === "sold" || raw.type === "unsold")) {
    return {
      type: raw.type,
      action: state?.lastAction ?? raw.type,
      isManual: !!raw.isManual,
      record: {
        playerName: raw.playerName ?? null,
        photoUrl: raw.photoUrl ?? null,
        teamName: raw.teamName ?? null,
        teamColor: raw.teamColor ?? null,
        teamLogoUrl: raw.teamLogoUrl ?? null,
        amount: raw.amount ?? null,
      },
    };
  }
  return parseAuctionDisplayOutcome(state?.lastAction);
}

/** Stable dedupe key for sold/unsold animation and result capture. */
export function outcomeEventKey(outcome: AuctionDisplayOutcome): string | null {
  if (!outcome) return null;
  const r = outcome.record;
  if (r?.playerName) {
    if (outcome.type === "sold") {
      return `sold:${r.playerName}:${r.amount ?? 0}:${r.teamName ?? ""}:${outcome.isManual ? "m" : "a"}`;
    }
    return `unsold:${r.playerName}`;
  }
  return outcome.action;
}

export function soldRecordFromOutcome(outcome: AuctionDisplayOutcome): {
  playerName: string;
  photoUrl: string | null | undefined;
  amount: number;
  teamName: string;
  teamColor: string;
  teamLogoUrl?: string | null;
} | null {
  if (!outcome || outcome.type !== "sold") return null;
  const r = outcome.record;
  if (!r?.playerName) return null;
  return {
    playerName: r.playerName,
    photoUrl: r.photoUrl,
    amount: r.amount ?? 0,
    teamName: r.teamName ?? "Unknown Team",
    teamColor: r.teamColor ?? "#F59E0B",
    teamLogoUrl: r.teamLogoUrl,
  };
}

export function unsoldRecordFromOutcome(outcome: AuctionDisplayOutcome): {
  playerName: string;
  photoUrl: string | null | undefined;
} | null {
  if (!outcome || outcome.type !== "unsold") return null;
  const r = outcome.record;
  if (!r?.playerName) return null;
  return {
    playerName: r.playerName,
    photoUrl: r.photoUrl,
  };
}

export type AuctionDisplayMode = {
  /** Normalized phase for UI labels */
  phase: AuctionDisplayPhase;
  /** Authoritative sold/unsold result from the backend (falls back to lastAction parsing) */
  outcome: AuctionDisplayOutcome;
  isLive: boolean;
  isPaused: boolean;
  isBreak: boolean;
  /** Pause or break banner over main content (not pre-auction countdown) */
  showStatusOverlay: boolean;
  overlayMode: "paused" | "break" | null;
  breakEndsAt: string | null;
  breakMessage: string | null;
  /** Full-screen digit countdown — pre-auction only */
  preAuctionCountdown: ParsedDisplayCountdown | null;
  /** Freeze bid timer and suppress bid animations */
  freezeBidUpdates: boolean;
};

export function deriveAuctionDisplayMode(state: RawAuctionState): AuctionDisplayMode {
  const status = state?.status ?? "idle";
  const countdown = parseDisplayCountdown(state?.displayCountdown);
  const outcome = resolveAuctionDisplayOutcome(state);

  const isBreak = countdown?.type === "break";
  const isPreAuction = countdown?.type === "pre-auction";
  const isPaused = status === "paused";
  const isLive = status === "active";

  const overlayMode: "paused" | "break" | null = isBreak
    ? "break"
    : isPaused
      ? "paused"
      : null;

  let phase: AuctionDisplayPhase;
  if (isBreak) phase = "break";
  else if (isPaused) phase = "paused";
  else if (outcome) phase = outcome.type;
  else if (isLive) phase = "live";
  else if (status === "sold") phase = "sold";
  else if (status === "unsold") phase = "unsold";
  else phase = "idle";

  return {
    phase,
    outcome,
    isLive,
    isPaused,
    isBreak,
    showStatusOverlay: overlayMode !== null,
    overlayMode,
    breakEndsAt: isBreak ? countdown!.endsAt : null,
    breakMessage: isBreak ? countdown!.message : null,
    preAuctionCountdown: isPreAuction ? countdown : null,
    freezeBidUpdates: isPaused || isBreak,
  };
}
