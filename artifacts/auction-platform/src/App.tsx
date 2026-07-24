import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, hydrate, type DehydratedState } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";
import { PageTracking } from "@/components/page-tracking";
import { applyPwaHeadBranding, ADMIN_MANIFEST_HREF, isAdminPwaRoute } from "@/lib/branding-pwa";
import {
  InitialDataProvider,
  homePageInitialData,
  seedHomepageQueryCache,
} from "@/lib/initial-data/initial-data-provider";
import type { PageInitialData } from "@/lib/initial-data/types";
import { readWindowDehydratedState, readWindowInitialData, normalizeHomeInitialData } from "@/lib/initial-data/types";

import { BootSplash } from "@/components/boot-splash";
import Landing from "@/pages/landing";

const PlatformApp = lazy(() => import("./platform-app"));

const LegalPage = lazy(() => import("@/pages/legal"));
const AcademyIndex = lazy(() => import("@/pages/academy/index"));
const AcademyLesson = lazy(() => import("@/pages/academy/lesson"));
const SeoSportLanding = lazy(() => import("@/pages/seo-sport-landing"));
const UpcomingAuctions = lazy(() => import("@/pages/upcoming-auctions"));
const ContactPage = lazy(() => import("@/pages/contact"));
const AuctionTipsPage = lazy(() => import("@/pages/auction-tips"));

// Blog
const BlogIndex    = lazy(() => import("@/pages/blog/index"));
const BlogArticle  = lazy(() => import("@/pages/blog/article"));
const BlogCategory = lazy(() => import("@/pages/blog/category"));
const BlogTag      = lazy(() => import("@/pages/blog/tag"));
const BlogAuthor   = lazy(() => import("@/pages/blog/author"));


function makeBrowserQueryClient(
  dehydratedState?: DehydratedState,
  pageData?: PageInitialData | null,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5000,
      },
    },
  });

  if (dehydratedState) {
    hydrate(client, dehydratedState);
  } else if (pageData?.home) {
    seedHomepageQueryCache(client, pageData.home);
  }

  return client;
}

let browserQueryClient: QueryClient | undefined;

function getBrowserQueryClient(
  dehydratedState?: DehydratedState,
  pageData?: PageInitialData | null,
) {
  if (typeof window === "undefined") {
    return makeBrowserQueryClient(dehydratedState, pageData);
  }
  if (!browserQueryClient) {
    browserQueryClient = makeBrowserQueryClient(dehydratedState, pageData);
  }
  return browserQueryClient;
}

export type AppProps = {
  pageData?: PageInitialData | null;
  dehydratedState?: DehydratedState;
  /** Server render only — matches wouter SSR path for `/`. */
  ssrPath?: string;
};

function resolveClientBootstrapProps(): Pick<AppProps, "pageData" | "dehydratedState"> {
  const initialWire = readWindowInitialData();
  if (!initialWire) {
    return { pageData: null, dehydratedState: readWindowDehydratedState() };
  }
  return {
    pageData: homePageInitialData(normalizeHomeInitialData(initialWire)),
    dehydratedState: readWindowDehydratedState(),
  };
}

function BrandingEffects() {
  const [location] = useLocation();
  const { logos, brandName, iconVersion } = useBranding();
  const googleSiteVerification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  const manifestHref = isAdminPwaRoute(location) ? ADMIN_MANIFEST_HREF : "/site.webmanifest";

  useEffect(() => {
    applyPwaHeadBranding(logos, manifestHref, iconVersion);

    if (brandName && brandName !== "BidWar") {
      document.title = document.title.replace(/BidWar/g, brandName);
    }
  }, [logos.favicon, logos.appleTouchIcon, logos.pwaIcon, logos.appIcon, brandName, iconVersion, manifestHref]);

  useEffect(() => {
    const ogImage = logos.openGraph;
    if (!ogImage) return;

    function setMeta(selector: string, attr: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = attr.split("=");
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    setMeta('meta[property="og:image"]', "property=og:image", ogImage);
    setMeta('meta[name="twitter:image"]', "name=twitter:image", ogImage);
  }, [logos.openGraph]);

  useEffect(() => {
    const selector = 'meta[name="google-site-verification"]';
    let tag = document.querySelector<HTMLMetaElement>(selector);

    if (!googleSiteVerification) {
      if (tag) tag.remove();
      return;
    }

    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "google-site-verification");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", googleSiteVerification);
  }, [googleSiteVerification]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<BootSplash />}>
      <Switch>
        {/* Marketing routes */}
        <Route path="/" component={Landing} />
        <Route path="/upcoming-auctions" component={UpcomingAuctions} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/auction-tips" component={AuctionTipsPage} />
        <Route path="/legal">{() => <Redirect to="/legal/terms" />}</Route>
        <Route path="/legal/:slug" component={LegalPage} />

        {/* Blog */}
        <Route path="/blog" component={BlogIndex} />
        <Route path="/blog/category/:slug">
          {(params) => <BlogCategory slug={params?.slug ?? ""} />}
        </Route>
        <Route path="/blog/tag/:slug">
          {(params) => <BlogTag slug={params?.slug ?? ""} />}
        </Route>
        <Route path="/blog/author/:slug">
          {(params) => <BlogAuthor slug={params?.slug ?? ""} />}
        </Route>
        <Route path="/blog/:slug">
          {(params) => <BlogArticle slug={params?.slug ?? ""} />}
        </Route>

        {/* Academy */}
        <Route path="/academy" component={AcademyIndex} />
        <Route path="/academy/:slug">
          {(params) => <AcademyLesson slug={params?.slug ?? ""} />}
        </Route>

        {/* SEO landing pages */}
        <Route path="/cricket-auction-software">{() => <SeoSportLanding slug="cricket-auction-software" />}</Route>
        <Route path="/football-player-auction">{() => <SeoSportLanding slug="football-player-auction" />}</Route>
        <Route path="/kabaddi-auction-platform">{() => <SeoSportLanding slug="kabaddi-auction-platform" />}</Route>
        <Route path="/esports-auction-system">{() => <SeoSportLanding slug="esports-auction-system" />}</Route>
        <Route path="/business-league-auction">{() => <SeoSportLanding slug="business-league-auction" />}</Route>
        <Route path="/live-player-bidding">{() => <SeoSportLanding slug="live-player-bidding" />}</Route>
        <Route path="/tournament-auction-platform">{() => <SeoSportLanding slug="tournament-auction-platform" />}</Route>
        <Route path="/basketball-auction-software">{() => <SeoSportLanding slug="basketball-auction-software" />}</Route>
        <Route path="/badminton-auction-platform">{() => <SeoSportLanding slug="badminton-auction-platform" />}</Route>
        <Route path="/volleyball-player-auction">{() => <SeoSportLanding slug="volleyball-player-auction" />}</Route>
        <Route path="/sports-auction-software">{() => <SeoSportLanding slug="sports-auction-software" />}</Route>
        <Route path="/franchise-auction-software">{() => <SeoSportLanding slug="franchise-auction-software" />}</Route>
        <Route path="/player-auction-software">{() => <SeoSportLanding slug="player-auction-software" />}</Route>
        <Route path="/sports-league-management-software">{() => <SeoSportLanding slug="sports-league-management-software" />}</Route>
        <Route path="/badminton-scoring-software">{() => <SeoSportLanding slug="badminton-scoring-software" />}</Route>

        {/* Everything else lives in the operator/admin app shell */}
        <Route>
          <Suspense fallback={<BootSplash />}>
            <PlatformApp />
          </Suspense>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App(props: AppProps = {}) {
  const bootstrap = props.pageData === undefined && props.dehydratedState === undefined
    ? resolveClientBootstrapProps()
    : { pageData: props.pageData ?? null, dehydratedState: props.dehydratedState };

  const [client] = useState(() =>
    typeof window === "undefined"
      ? makeBrowserQueryClient(bootstrap.dehydratedState, bootstrap.pageData)
      : getBrowserQueryClient(bootstrap.dehydratedState, bootstrap.pageData),
  );

  return (
    <QueryClientProvider client={client}>
      <InitialDataProvider pageData={bootstrap.pageData} queryClient={client}>
        <WouterRouter
          base={import.meta.env.BASE_URL.replace(/\/$/, "")}
          ssrPath={props.ssrPath}
        >
          <BrandingEffects />
          <PageTracking />
          <Router />
        </WouterRouter>
      </InitialDataProvider>
    </QueryClientProvider>
  );
}

export { homePageInitialData };

export default App;
