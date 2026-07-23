/** How long after the last local mirror we treat the venue auction as active on LAN. */
export const VENUE_MIRROR_TTL_MS = 10 * 60 * 1000;

export type VenueAuctionGuardInput = {
  localModeEnabled: boolean;
  cloudSessionStatus: string;
  lastMirrorAt: Date | string | null | undefined;
  now?: number;
};

export type VenueAuctionGuardResult = {
  recentMirror: boolean;
  cloudLive: boolean;
  blockCloudStart: boolean;
  blockLocalStart: boolean;
  blockCloudStartReason: string | null;
  blockLocalStartReason: string | null;
};

export function evaluateVenueAuctionGuard(input: VenueAuctionGuardInput): VenueAuctionGuardResult {
  const now = input.now ?? Date.now();
  const mirrorMs = input.lastMirrorAt ? new Date(input.lastMirrorAt).getTime() : 0;
  const recentMirror = mirrorMs > 0 && now - mirrorMs < VENUE_MIRROR_TTL_MS;
  const cloudLive = input.cloudSessionStatus === "active" || input.cloudSessionStatus === "paused";

  const blockCloudStart = input.localModeEnabled && recentMirror;
  const blockLocalStart = input.localModeEnabled && cloudLive && !recentMirror;

  return {
    recentMirror,
    cloudLive,
    blockCloudStart,
    blockLocalStart,
    blockCloudStartReason: blockCloudStart
      ? "A venue auction is running on BidWar Local. Conclude the local auction before starting on cloud."
      : null,
    blockLocalStartReason: blockLocalStart
      ? "This tournament auction is already running in the cloud. Stop the cloud auction before starting at the venue."
      : null,
  };
}
