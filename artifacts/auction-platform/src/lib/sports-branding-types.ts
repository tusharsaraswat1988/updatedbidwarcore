/**
 * Module-neutral sports branding types for frontend consumers.
 */

export interface ScoreBoardSponsor {
  logoUrl: string | null;
  logoPublicId?: string | null;
  name: string | null;
  title: string | null;
}

export type SportsBannerFit = "cover" | "contain";

export type SportsOverlayScene =
  | "auto"
  | "compact"
  | "full"
  | "intro"
  | "winner"
  | "sponsor"
  | "next"
  | "multi"
  | "results"
  | "leaderboards";

export type SportsVenueScene =
  | "auto"
  | "live_score"
  | "standby"
  | "multi"
  | "intro"
  | "winner"
  | "sponsor"
  | "banner"
  | "next"
  | "results"
  | "leaderboards";

export interface SportsBranding {
  displayName: string;
  logoUrl: string | null;
  sponsorLogos: string | null;
  venue: string | null;
  organizerName: string | null;
  primaryColor: string;
  accentColor: string;
  scoreBoardSponsor: ScoreBoardSponsor | null;
  /** Organizer-selected LIVE match for persistent Venue/OBS follow URLs. */
  primaryBroadcastMatchId?: number | null;
  /** Operator Broadcast Director — OBS scene (`auto` = URL type + live follow). */
  overlayScene?: SportsOverlayScene;
  /** Operator Broadcast Director — Venue Scoreboard scene. */
  venueScene?: SportsVenueScene;
  /** Operator-selected upcoming match for the Next moment. */
  upNextMatchId?: number | null;
  /** Operator-selected sponsor URL for the full-screen Sponsor moment. */
  spotlightSponsorUrl?: string | null;
  /** Operator-pinned sponsor URL on live venue/OBS chrome until unpin. */
  pinnedSponsorUrl?: string | null;
  /** YouTube, Facebook, or other https watch URL shown on the public fan page. */
  liveStreamUrl?: string | null;
  /** Control Center On/Pause for venue LED loop music. */
  venueMusicPlaying?: boolean;
  /** Sport-specific override track (null = auction/platform fallthrough). */
  venueMusicUrl?: string | null;
  /** Display name for the override track. */
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  /** Resolved loop URL for venue LED playback. */
  resolvedVenueMusicUrl?: string | null;
  /** Sport banner override (null = auction main banner fallthrough). */
  venueBannerUrl?: string | null;
  venueBannerPublicId?: string | null;
  venueBannerFit?: SportsBannerFit;
  auctionMainBannerUrl?: string | null;
  resolvedVenueBannerUrl?: string | null;
  resolvedVenueBannerFit?: SportsBannerFit;
  /**
   * Client-only: last SSE / optimistic presentation patch time.
   * Used so a racing GET /branding cannot wipe a fresher music/scene flag.
   */
  _presentationPatchedAt?: number;
}
