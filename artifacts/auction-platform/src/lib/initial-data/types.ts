import type { DehydratedState } from "@tanstack/react-query";
import type { BrandingSettings } from "@/hooks/use-branding";
import type { DisplayAuction } from "@/lib/auth";
import { brandingPayloadToSettings } from "./branding-from-payload";

export type ShowcaseEventRecord = {
  id: number;
  imageUrl: string;
  sportName: string;
  tournamentName: string;
  description?: string | null;
  altText?: string | null;
  displayOrder?: number;
  active?: boolean;
};

/** Wire format embedded in window.__BIDWAR_INITIAL_DATA__ */
export type HomeInitialDataWire = {
  auctions: DisplayAuction[];
  showcaseEvents: ShowcaseEventRecord[];
  branding: Record<string, unknown>;
  generatedAt: string;
};

/** Normalized homepage payload for React Query + UI. */
export type HomeInitialData = {
  auctions: DisplayAuction[];
  showcaseEvents: ShowcaseEventRecord[];
  branding: BrandingSettings;
  generatedAt: string;
};

/** Extensible union for future SSR pages (pricing, blog, …). */
export type PageInitialData = {
  page: "home";
  home: HomeInitialData;
};

declare global {
  interface Window {
    __BIDWAR_INITIAL_DATA__?: HomeInitialDataWire;
    __REACT_QUERY_DEHYDRATED__?: DehydratedState;
  }
}

export function readWindowInitialData(): HomeInitialDataWire | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__BIDWAR_INITIAL_DATA__;
}

export function normalizeHomeInitialData(wire: HomeInitialDataWire): HomeInitialData {
  return {
    auctions: wire.auctions,
    showcaseEvents: wire.showcaseEvents,
    branding: brandingPayloadToSettings(wire.branding),
    generatedAt: wire.generatedAt,
  };
}

export function readWindowDehydratedState(): DehydratedState | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__REACT_QUERY_DEHYDRATED__;
}
