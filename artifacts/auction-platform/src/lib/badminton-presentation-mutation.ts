/**
 * Shared Broadcast Director presentation mutation helpers.
 * Optimistic UI so Moments / Venue scene buttons never feel "dead" while PATCH is in flight.
 *
 * Mission Control is the operator hot path — never block on cancelQueries / branding refetch.
 */

import type { QueryClient } from "@tanstack/react-query";
import type {
  BadmintonOverlayScene,
  BadmintonVenueScene,
} from "@/lib/badminton-broadcast-director";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";

export type PresentationPatch = {
  overlayScene?: BadmintonOverlayScene;
  venueScene?: BadmintonVenueScene;
  upNextMatchId?: number | null;
  spotlightSponsorUrl?: string | null;
  pinnedSponsorUrl?: string | null;
  venueMusicPlaying?: boolean;
  venueMusicUrl?: string | null;
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  importAuctionMusic?: true;
  venueBannerUrl?: string | null;
  venueBannerPublicId?: string | null;
  venueBannerFit?: "cover" | "contain";
  importAuctionBanner?: true;
  primaryBroadcastMatchId?: number | null;
};

export type PresentationMutateContext = {
  previous?: BadmintonBranding;
};

/** How long a live SSE/optimistic patch wins over a racing GET /branding response. */
const PRESENTATION_RACE_GUARD_MS = 15_000;

export function brandingQueryKey(tournamentId: number) {
  return ["badminton-branding", tournamentId] as const;
}

export function isPresentationPayload(data: Record<string, unknown>): boolean {
  return (
    data.kind === "broadcast_presentation"
    || "primaryBroadcastMatchId" in data
    || "venueScene" in data
    || "overlayScene" in data
    || "upNextMatchId" in data
    || "spotlightSponsorUrl" in data
    || "pinnedSponsorUrl" in data
    || "venueMusicPlaying" in data
    || "resolvedVenueMusicUrl" in data
    || "resolvedVenueBannerUrl" in data
    || "venueBannerUrl" in data
  );
}

/** Minimal shell so SSE / optimistic music patches are not dropped before first GET. */
export function emptyBrandingShell(): BadmintonBranding {
  return {
    displayName: "",
    logoUrl: null,
    sponsorLogos: null,
    venue: null,
    organizerName: null,
    primaryColor: "#0070f3",
    accentColor: "#4fc3f7",
    scoreBoardSponsor: null,
  };
}

function pickPresentationFields(from: BadmintonBranding): Partial<BadmintonBranding> {
  return {
    primaryBroadcastMatchId: from.primaryBroadcastMatchId,
    overlayScene: from.overlayScene,
    venueScene: from.venueScene,
    upNextMatchId: from.upNextMatchId,
    spotlightSponsorUrl: from.spotlightSponsorUrl,
    pinnedSponsorUrl: from.pinnedSponsorUrl,
    venueMusicPlaying: from.venueMusicPlaying,
    venueMusicUrl: from.venueMusicUrl,
    venueMusicFileName: from.venueMusicFileName,
    venueMusicVolume: from.venueMusicVolume,
    resolvedVenueMusicUrl: from.resolvedVenueMusicUrl,
    venueBannerUrl: from.venueBannerUrl,
    venueBannerPublicId: from.venueBannerPublicId,
    venueBannerFit: from.venueBannerFit,
    auctionMainBannerUrl: from.auctionMainBannerUrl,
    resolvedVenueBannerUrl: from.resolvedVenueBannerUrl,
    resolvedVenueBannerFit: from.resolvedVenueBannerFit,
    _presentationPatchedAt: from._presentationPatchedAt,
  };
}

/**
 * When GET /branding races with an SSE presentation patch, keep the live fields
 * briefly so a stale in-flight GET cannot turn music back off.
 */
export function mergeFetchedBrandingWithLivePresentation(
  fetched: BadmintonBranding,
  live: BadmintonBranding | undefined,
): BadmintonBranding {
  const patchedAt = live?._presentationPatchedAt;
  if (!live || typeof patchedAt !== "number") return fetched;
  if (Date.now() - patchedAt > PRESENTATION_RACE_GUARD_MS) return fetched;

  return {
    ...fetched,
    ...pickPresentationFields(live),
  };
}

/** Patch branding cache from SSE / optimistic UI (never requires a refetch). */
export function applyPresentationPayload(
  prev: BadmintonBranding | undefined,
  payload: Record<string, unknown>,
): BadmintonBranding | undefined {
  if (!isPresentationPayload(payload) && !prev) return prev;

  const next: BadmintonBranding = { ...(prev ?? emptyBrandingShell()) };
  let touched = false;

  if ("primaryBroadcastMatchId" in payload) {
    const raw = payload.primaryBroadcastMatchId;
    next.primaryBroadcastMatchId =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : null;
    touched = true;
  }
  if (typeof payload.venueScene === "string") {
    next.venueScene = payload.venueScene as BadmintonBranding["venueScene"];
    touched = true;
  }
  if (typeof payload.overlayScene === "string") {
    next.overlayScene = payload.overlayScene as BadmintonBranding["overlayScene"];
    touched = true;
  }
  if ("upNextMatchId" in payload) {
    const raw = payload.upNextMatchId;
    next.upNextMatchId =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : null;
    touched = true;
  }
  if ("spotlightSponsorUrl" in payload) {
    const url = payload.spotlightSponsorUrl;
    next.spotlightSponsorUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if ("pinnedSponsorUrl" in payload) {
    const url = payload.pinnedSponsorUrl;
    next.pinnedSponsorUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if (typeof payload.venueMusicPlaying === "boolean") {
    next.venueMusicPlaying = payload.venueMusicPlaying;
    touched = true;
  }
  if ("resolvedVenueMusicUrl" in payload) {
    const url = payload.resolvedVenueMusicUrl;
    next.resolvedVenueMusicUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if ("venueMusicUrl" in payload) {
    const url = payload.venueMusicUrl;
    next.venueMusicUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if (typeof payload.venueMusicFileName === "string" || payload.venueMusicFileName === null) {
    next.venueMusicFileName =
      typeof payload.venueMusicFileName === "string"
        ? payload.venueMusicFileName.trim() || null
        : null;
    touched = true;
  }
  if (typeof payload.venueMusicVolume === "number" && Number.isFinite(payload.venueMusicVolume)) {
    next.venueMusicVolume = Math.max(0, Math.min(100, Math.round(payload.venueMusicVolume)));
    touched = true;
  }
  if ("resolvedVenueBannerUrl" in payload) {
    const url = payload.resolvedVenueBannerUrl;
    next.resolvedVenueBannerUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if ("venueBannerUrl" in payload) {
    const url = payload.venueBannerUrl;
    next.venueBannerUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }
  if (payload.resolvedVenueBannerFit === "cover" || payload.resolvedVenueBannerFit === "contain") {
    next.resolvedVenueBannerFit = payload.resolvedVenueBannerFit;
    touched = true;
  }
  if (payload.venueBannerFit === "cover" || payload.venueBannerFit === "contain") {
    next.venueBannerFit = payload.venueBannerFit;
    touched = true;
  }
  if ("auctionMainBannerUrl" in payload) {
    const url = payload.auctionMainBannerUrl;
    next.auctionMainBannerUrl = typeof url === "string" && url.trim() ? url.trim() : null;
    touched = true;
  }

  if (!touched && !prev) return undefined;
  if (touched) {
    next._presentationPatchedAt = Date.now();
  }
  return next;
}

/**
 * Optimistic patch — must stay synchronous.
 * Do NOT await cancelQueries here (slow/hung branding refetch left buttons stuck).
 */
export function onPresentationMutate(
  qc: QueryClient,
  tournamentId: number,
  body: PresentationPatch,
): PresentationMutateContext {
  void qc.cancelQueries({ queryKey: brandingQueryKey(tournamentId) });
  const previous = qc.getQueryData<BadmintonBranding>(brandingQueryKey(tournamentId));
  const next = applyPresentationPayload(previous, body as Record<string, unknown>);
  if (next) {
    qc.setQueryData<BadmintonBranding>(brandingQueryKey(tournamentId), next);
  }
  return { previous };
}

export function onPresentationError(
  qc: QueryClient,
  tournamentId: number,
  context: PresentationMutateContext | undefined,
) {
  if (context?.previous) {
    qc.setQueryData(brandingQueryKey(tournamentId), context.previous);
  }
}

export function onPresentationSuccess(
  qc: QueryClient,
  tournamentId: number,
  data: BadmintonBranding,
) {
  qc.setQueryData(brandingQueryKey(tournamentId), {
    ...data,
    _presentationPatchedAt: Date.now(),
  });
}
