/**
 * Single source of truth for pause / break / live display semantics.
 * LED, Live Viewer, and OBS all derive overlay behavior from here.
 */

export type AuctionDisplayPhase = "live" | "paused" | "break" | "idle" | "sold" | "unsold";

export type ParsedDisplayCountdown = {
  type: "break" | "pre-auction";
  endsAt: string;
  message: string | null;
};

type RawCountdown = {
  type?: string;
  endsAt?: string;
  message?: string | null;
  label?: string | null;
} | null | undefined;

type RawAuctionState = {
  status?: string | null;
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

export type AuctionDisplayMode = {
  /** Normalized phase for UI labels */
  phase: AuctionDisplayPhase;
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
  else if (isLive) phase = "live";
  else if (status === "sold") phase = "sold";
  else if (status === "unsold") phase = "unsold";
  else phase = "idle";

  return {
    phase,
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
