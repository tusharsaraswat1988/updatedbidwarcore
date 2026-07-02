import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import {
  dehydrate,
  QueryClient,
  type DehydratedState,
} from "@tanstack/react-query";
import type { HomeInitialData, PageInitialData } from "./types";
import { brandingPayloadToSettings } from "./branding-from-payload";
import { writeBrandingCache } from "@/lib/branding-cache";
import {
  brandingKeys,
  displayAuctionKeys,
  showcaseKeys,
} from "./query-keys";
import type { DisplayAuction } from "@/lib/auth";
import type { ShowcaseEventRecord } from "./types";

type InitialDataContextValue = {
  pageData: PageInitialData | null;
  hasServerSnapshot: boolean;
};

const InitialDataContext = createContext<InitialDataContextValue>({
  pageData: null,
  hasServerSnapshot: false,
});

export function seedHomepageQueryCache(
  queryClient: QueryClient,
  data: HomeInitialData,
): DehydratedState {
  queryClient.setQueryData<DisplayAuction[]>(displayAuctionKeys.landing, data.auctions);
  queryClient.setQueryData<ShowcaseEventRecord[]>(showcaseKeys.active, data.showcaseEvents);
  queryClient.setQueryData(brandingKeys.public, data.branding);
  return dehydrate(queryClient);
}

export function prefetchHomepageQueries(
  queryClient: QueryClient,
  data: HomeInitialData,
): DehydratedState {
  return seedHomepageQueryCache(queryClient, data);
}

type InitialDataProviderProps = {
  children: ReactNode;
  pageData?: PageInitialData | null;
  queryClient: QueryClient;
};

export function InitialDataProvider({
  children,
  pageData = null,
  queryClient,
}: InitialDataProviderProps) {
  const hasServerSnapshot = Boolean(pageData?.home);

  useEffect(() => {
    if (!pageData?.home) return;

    writeBrandingCache(pageData.home.branding);

    void queryClient.invalidateQueries({ queryKey: displayAuctionKeys.landing });
    void queryClient.invalidateQueries({ queryKey: showcaseKeys.active });
    void queryClient.invalidateQueries({ queryKey: brandingKeys.public });
  }, [pageData, queryClient]);

  return (
    <InitialDataContext.Provider value={{ pageData, hasServerSnapshot }}>
      {children}
    </InitialDataContext.Provider>
  );
}

export function usePageInitialData(): PageInitialData | null {
  return useContext(InitialDataContext).pageData;
}

export function useHomeInitialData(): HomeInitialData | null {
  return useContext(InitialDataContext).pageData?.home ?? null;
}

export function useHasServerSnapshot(): boolean {
  return useContext(InitialDataContext).hasServerSnapshot;
}

/** Normalize server-side homepage bundle into client initial data. */
export function normalizeHomepageBundle(bundle: {
  auctions: DisplayAuction[];
  showcaseEvents: ShowcaseEventRecord[];
  branding: Record<string, unknown>;
  generatedAt: string;
}): HomeInitialData {
  return {
    auctions: bundle.auctions,
    showcaseEvents: bundle.showcaseEvents,
    branding: brandingPayloadToSettings(bundle.branding),
    generatedAt: bundle.generatedAt,
  };
}

export function homePageInitialData(data: HomeInitialData): PageInitialData {
  return { page: "home", home: data };
}
