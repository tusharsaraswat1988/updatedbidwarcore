/**
 * Shared Broadcast Director presentation mutation helpers.
 * Optimistic UI so Moments / Venue scene buttons never feel "dead" while PATCH is in flight.
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
  venueMusicVolume?: number;
  importAuctionMusic?: true;
};

export type PresentationMutateContext = {
  previous?: BadmintonBranding;
};

export function brandingQueryKey(tournamentId: number) {
  return ["badminton-branding", tournamentId] as const;
}

export async function onPresentationMutate(
  qc: QueryClient,
  tournamentId: number,
  body: PresentationPatch,
): Promise<PresentationMutateContext> {
  await qc.cancelQueries({ queryKey: brandingQueryKey(tournamentId) });
  const previous = qc.getQueryData<BadmintonBranding>(brandingQueryKey(tournamentId));
  if (previous) {
    qc.setQueryData<BadmintonBranding>(brandingQueryKey(tournamentId), {
      ...previous,
      ...(body.overlayScene !== undefined ? { overlayScene: body.overlayScene } : {}),
      ...(body.venueScene !== undefined ? { venueScene: body.venueScene } : {}),
      ...(body.venueMusicPlaying !== undefined
        ? { venueMusicPlaying: body.venueMusicPlaying }
        : {}),
      ...(body.venueMusicUrl !== undefined ? { venueMusicUrl: body.venueMusicUrl } : {}),
      ...(body.venueMusicVolume !== undefined
        ? { venueMusicVolume: body.venueMusicVolume }
        : {}),
    });
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
