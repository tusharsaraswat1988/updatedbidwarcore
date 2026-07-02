import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import App from "@/App";
import {
  homePageInitialData,
  seedHomepageQueryCache,
} from "@/lib/initial-data/initial-data-provider";
import type { HomeInitialData, HomeInitialDataWire } from "@/lib/initial-data/types";
import { normalizeHomeInitialData } from "@/lib/initial-data/types";

function createSsrQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 20_000,
      },
    },
  });
}

export type RenderHomePageResult = {
  appHtml: string;
  dehydratedState: ReturnType<typeof seedHomepageQueryCache>;
  initialData: HomeInitialDataWire;
};

export function renderHomePage(wire: HomeInitialDataWire): RenderHomePageResult {
  const initialData = normalizeHomeInitialData(wire);
  const queryClient = createSsrQueryClient();
  const dehydratedState = seedHomepageQueryCache(queryClient, initialData);
  const pageData = homePageInitialData(initialData);

  const appHtml = renderToString(
    <App pageData={pageData} dehydratedState={dehydratedState} ssrPath="/" />,
  );

  return { appHtml, dehydratedState, initialData: wire };
}
