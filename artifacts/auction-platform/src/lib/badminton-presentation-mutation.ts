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
  venueMusicPlaying?: boolean;
  venueMusicUrl?: string | null;
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  importAuctionMusic?: true;
  primaryBroadcastMatchId?: number | null;
};

export type PresentationMutateContext = {
  previous?: BadmintonBranding;
};

export function brandingQueryKey(tournamentId: number) {
  return ["badminton-branding", tournamentId] as const;
}

export function isPresentationPayload(data: Record<string, unknown>): boolean {
  return (
    data.kind === "broadcast_presentation"
    || "primaryBroadcastMatchId" in data
    || "venueScene" in data
    || "overlayScene" in data
    || "venueMusicPlaying" in data
    || "resolvedVenueMusicUrl" in data
  );
}

/** Patch branding cache from SSE / optimistic UI (never requires a refetch). */
export function applyPresentationPayload(
  prev: BadmintonBranding | undefined,
  payload: Record<string, unknown>,
): BadmintonBranding | undefined {
  if (!prev) return prev;
  const next = { ...prev };
  if ("primaryBroadcastMatchId" in payload) {
    const raw = payload.primaryBroadcastMatchId;
    next.primaryBroadcastMatchId =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : null;
  }
  if (typeof payload.venueScene === "string") {
    next.venueScene = payload.venueScene as BadmintonBranding["venueScene"];
  }
  if (typeof payload.overlayScene === "string") {
    next.overlayScene = payload.overlayScene as BadmintonBranding["overlayScene"];
  }
  if (typeof payload.venueMusicPlaying === "boolean") {
    next.venueMusicPlaying = payload.venueMusicPlaying;
  }
  if ("resolvedVenueMusicUrl" in payload) {
    const url = payload.resolvedVenueMusicUrl;
    next.resolvedVenueMusicUrl = typeof url === "string" && url.trim() ? url.trim() : null;
  }
  if ("venueMusicUrl" in payload) {
    const url = payload.venueMusicUrl;
    next.venueMusicUrl = typeof url === "string" && url.trim() ? url.trim() : null;
  }
  if (typeof payload.venueMusicFileName === "string" || payload.venueMusicFileName === null) {
    next.venueMusicFileName =
      typeof payload.venueMusicFileName === "string"
        ? payload.venueMusicFileName.trim() || null
        : null;
  }
  if (typeof payload.venueMusicVolume === "number" && Number.isFinite(payload.venueMusicVolume)) {
    next.venueMusicVolume = Math.max(0, Math.min(100, Math.round(payload.venueMusicVolume)));
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
  if (previous) {
    qc.setQueryData<BadmintonBranding>(
      brandingQueryKey(tournamentId),
      applyPresentationPayload(previous, body as Record<string, unknown>) ?? previous,
    );
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
  qc.setQueryData(brandingQueryKey(tournamentId), data);
}
