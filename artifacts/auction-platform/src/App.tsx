import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, hydrate, type DehydratedState } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBranding } from "@/hooks/use-branding";
import { OrganizerGuard } from "@/components/organizer-guard";
import { PageTracking } from "@/components/page-tracking";
import { applyPwaHeadBranding, ADMIN_MANIFEST_HREF, isAdminPwaRoute } from "@/lib/branding-pwa";
import { AdminPwaProvider } from "@/contexts/admin-pwa-context";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { LocalVenueGate } from "@/components/local-venue-gate";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { RedirectToScoringApp } from "@/components/redirect-to-scoring-app";
import TournamentSettings from "@/pages/tournament-settings";
import AuctionOperator from "@/pages/auction-operator";
import {
  InitialDataProvider,
  homePageInitialData,
  seedHomepageQueryCache,
} from "@/lib/initial-data/initial-data-provider";
import type { PageInitialData } from "@/lib/initial-data/types";
import { readWindowDehydratedState, readWindowInitialData, normalizeHomeInitialData } from "@/lib/initial-data/types";
import { readWindowAcademyData } from "@/lib/academy-public";

import { BootSplash } from "@/components/boot-splash";
const Landing = lazy(() => import("@/pages/landing"));

const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewTournament = lazy(() => import("@/pages/tournament-new"));
const TournamentHub = lazy(() => import("@/pages/tournament-hub"));
const Teams = lazy(() => import("@/pages/teams"));
const Categories = lazy(() => import("@/pages/categories"));
const Players = lazy(() => import("@/pages/players"));
const AuctionReset = lazy(() => import("@/pages/auction-reset"));
const DisplayView = lazy(() => import("@/pages/display"));
const SideDisplayView = lazy(() => import("@/pages/side-display"));
import { RedirectToOwnerApp } from "@/components/redirect-to-owner-app";
const Reports = lazy(() => import("@/pages/reports"));
const LinksPage = lazy(() => import("@/pages/links"));
const FortuneWheel = lazy(() => import("@/pages/fortune-wheel"));
const PlayerRegister = lazy(() => import("@/pages/player-register"));
const PlayerRegisterLegacy = lazy(() => import("@/pages/player-register-legacy"));
const OrganizerLogin = lazy(() => import("@/pages/organizer-login"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminDashboardOverview = lazy(() => import("@/pages/admin-dashboard-overview"));
const AdminLiveOperations = lazy(() => import("@/pages/admin-live-operations"));
const AdminTournamentsList = lazy(() => import("@/pages/admin-tournaments-list"));
const AdminOrganisersList = lazy(() => import("@/pages/admin-organisers-list"));
const AdminSportsPage = lazy(() => import("@/pages/admin-sports-page"));
const AdminSystemPage = lazy(() => import("@/pages/admin-system-page"));
const AdminTournamentDetail = lazy(() => import("@/pages/admin-tournament-detail"));
const TournamentMasterWorkbook = lazy(() => import("@/pages/tournament-master-workbook"));
const AdminOrganiserDetail = lazy(() => import("@/pages/admin-organiser-detail"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminIntelligence = lazy(() => import("@/pages/admin-intelligence"));
const ObsOverlayPreview = lazy(() => import("@/pages/obs-overlay-preview"));
const ObsOverlay = lazy(() => import("@/pages/obs-overlay"));
const OrganizerPortal = lazy(() => import("@/pages/organizer-portal"));
const OrganizerProfile = lazy(() => import("@/pages/organizer-profile"));
const LegalPage = lazy(() => import("@/pages/legal"));
const LiveViewer = lazy(() => import("@/pages/liveviewer"));
const AdminCommunicationCenter = lazy(() => import("@/pages/admin-communication-center"));
const AdminCommunicate = lazy(() => import("@/pages/admin-communicate"));
const AdminNotificationCenter = lazy(() => import("@/pages/admin-notification-center"));
const AdminAdminNotifications = lazy(() => import("@/pages/admin-admin-notifications"));
const AdminAdminNotificationSettings = lazy(() => import("@/pages/admin-admin-notification-settings"));
const AdminBranding = lazy(() => import("@/pages/admin-branding"));
const AdminCreativeAssets = lazy(() => import("@/pages/admin-creative-assets"));
const AdminAcademyLessonsList = lazy(() => import("@/pages/admin-academy-lessons-list"));
const AdminAcademyLessonForm = lazy(() => import("@/pages/admin-academy-lesson-form"));
const AcademyIndex = lazy(() => import("@/pages/academy/index"));
const AcademyLesson = lazy(() => import("@/pages/academy/lesson"));
const BuzzStudioDevPage = lazy(() => import("@/pages/buzz-studio-dev/BuzzStudioDevPage"));
const WaConsent = lazy(() => import("@/pages/wa-consent"));
const CompleteProfile = lazy(() => import("@/pages/complete-profile"));
const BreakTimerPage = lazy(() => import("@/pages/break-timer"));
const LocalModePage = lazy(() => import("@/pages/local-mode"));
const TeamReports = lazy(() => import("@/pages/team-reports"));
const MediaCenterPage = lazy(() => import("@/pages/media-center/MediaCenterPage"));
const TemplateStudioPage = lazy(() => import("@/pages/media-center/template-studio-page"));
const SeoSportLanding = lazy(() => import("@/pages/seo-sport-landing"));
const UpcomingAuctions = lazy(() => import("@/pages/upcoming-auctions"));
const ContactPage = lazy(() => import("@/pages/contact"));
const AuctionTipsPage = lazy(() => import("@/pages/auction-tips"));
const NotFound = lazy(() => import("@/pages/not-found"));

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

function RouteSuspenseFallback() {
  if (
    readWindowAcademyData() &&
    (document.getElementById("academy-ssr-content") ||
      document.getElementById("academy-ssr-fallback"))
  ) {
    return null;
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (/^\/tournament\/\d+\/auction\/?$/.test(path)) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f1117] text-white"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading auction control"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
        <p className="text-sm text-white/50">Loading auction control…</p>
      </div>
    );
  }

  if (/^\/tournament\/\d+\//.test(path)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading tournament page"
      >
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return <BootSplash />;
}

function Router() {
  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Landing} />
        <Route path="/upcoming-auctions" component={UpcomingAuctions} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/auction-tips" component={AuctionTipsPage} />
        <Route path="/dashboard">{() => <Redirect to="/organizer" />}</Route>
        <Route path="/tournament/new" component={NewTournament} />
        <Route path="/tournament/:id/login" component={OrganizerLogin} />
        <Route path="/tournament/:id/display" component={DisplayView} />
        <Route path="/tournament/:id/side-display" component={SideDisplayView} />
        <Route path="/tournament/:id/score-display" component={RedirectToScoringApp} />
        {/* Public live viewer — no auction code gate; share /live/:id with fans */}
        <Route path="/live/:id" component={LiveViewer} />
        <Route path="/live">
          {() => {
            const auction = new URLSearchParams(window.location.search).get("auction");
            if (auction && /^\d+$/.test(auction)) {
              return <Redirect to={`/live/${auction}`} />;
            }
            return <Redirect to="/upcoming-auctions" />;
          }}
        </Route>
        <Route path="/tournament/:id/liveviewer" component={LiveViewer} />
        <Route path="/register/:code" component={PlayerRegister} />
        <Route path="/tournament/:id/register" component={PlayerRegisterLegacy} />
        <Route path="/tournament/:id/obs/preview" component={ObsOverlayPreview} />
        <Route path="/tournament/:id/obs" component={ObsOverlay} />

        {/* Scoring — redirect legacy URLs to external scoring app */}
        <Route path="/badminton/:matchId/score" component={RedirectToScoringApp} />
        <Route path="/badminton/:matchId/display" component={RedirectToScoringApp} />
        <Route path="/badminton/:matchId/overlay" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/owner/:teamId">
          {(params) => (
            <RedirectToOwnerApp
              tournamentId={params?.id ?? "0"}
              teamId={params?.teamId ?? "0"}
            />
          )}
        </Route>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/live" component={AdminLiveOperations} />
        <Route path="/admin/live/auctions" component={AdminLiveOperations} />
        <Route path="/admin/live/monitor" component={AdminLiveOperations} />
        <Route path="/admin/live/monitor/:id" component={AdminLiveOperations} />
        <Route path="/admin/live/displays" component={AdminLiveOperations} />
        <Route path="/admin/live/displays/:id" component={AdminLiveOperations} />
        <Route path="/admin/live/owner-apps" component={AdminLiveOperations} />
        <Route path="/admin/live/owner-apps/:id" component={AdminLiveOperations} />
        <Route path="/admin/live/sessions" component={AdminLiveOperations} />
        <Route path="/admin/live/sessions/:id" component={AdminLiveOperations} />
        <Route path="/admin/live/emergency" component={AdminLiveOperations} />
        <Route path="/admin/live/emergency/:id" component={AdminLiveOperations} />
        <Route path="/admin/tournaments" component={AdminTournamentsList} />
        <Route path="/admin/tournaments/new" component={AdminTournamentsList} />
        <Route path="/admin/tournaments/sports" component={AdminSportsPage} />
        <Route path="/admin/tournaments/:id" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/overview" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/players" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/players/auction-data-manager">
          {({ id }) => <Redirect to={`/admin/tournaments/${id}/workbook`} />}
        </Route>
        <Route path="/admin/tournaments/:id/workbook" component={TournamentMasterWorkbook} />
        <Route path="/admin/tournaments/:id/teams" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/bids" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/monitor" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/displays" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/owner-apps" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/sessions" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/emergency" component={AdminTournamentDetail} />
        <Route path="/admin/organisers" component={AdminOrganisersList} />
        <Route path="/admin/organisers/:id" component={AdminOrganiserDetail} />
        <Route path="/admin/settings/reports" component={AdminReports} />
        <Route path="/admin/settings/intelligence" component={AdminIntelligence} />
        <Route path="/admin/settings/intelligence/:tab" component={AdminIntelligence} />
        <Route path="/admin/communication/:tab" component={AdminCommunicationCenter} />
        <Route path="/admin/communication" component={AdminCommunicationCenter} />
        <Route path="/admin/settings/communication/logs" component={AdminCommunicate} />
        <Route path="/admin/settings/communication/:tab" component={AdminCommunicate} />
        <Route path="/admin/settings/communication" component={AdminCommunicate} />
        <Route path="/admin/notifications" component={AdminAdminNotifications} />
        <Route path="/admin/settings/admin-notifications" component={AdminAdminNotificationSettings} />
        <Route path="/admin/settings/notifications" component={AdminNotificationCenter} />
        <Route path="/admin/settings/branding" component={AdminBranding} />
        <Route path="/admin/settings/branding/:tab" component={AdminBranding} />
        <Route path="/admin/creative-assets" component={AdminCreativeAssets} />
        <Route path="/admin/knowledge-center/academy/new" component={AdminAcademyLessonForm} />
        <Route path="/admin/knowledge-center/academy/:id" component={AdminAcademyLessonForm} />
        <Route path="/admin/knowledge-center/academy" component={AdminAcademyLessonsList} />
        <Route path="/admin/settings/system/audit-logs" component={AdminSystemPage} />
        <Route path="/admin/settings/system/sms" component={AdminSystemPage} />
        <Route path="/admin/settings/system/session-lock" component={AdminSystemPage} />
        <Route path="/admin/settings/system/installer" component={AdminSystemPage} />
        <Route path="/admin/settings/system/builds" component={AdminSystemPage} />
        <Route path="/admin/settings/system/default-audio" component={AdminSystemPage} />
        <Route path="/admin/settings/system/upcoming-display" component={AdminSystemPage} />
        <Route path="/admin/settings/system/showcase" component={AdminSystemPage} />
        <Route path="/admin/buzz-studio-dev" component={BuzzStudioDevPage} />
        <Route path="/admin/reports">{() => <Redirect to="/admin/settings/reports" />}</Route>
        <Route path="/admin/intelligence">{() => <Redirect to="/admin/settings/intelligence" />}</Route>
        <Route path="/admin/communicate/logs">{() => <Redirect to="/admin/settings/communication/logs" />}</Route>
        <Route path="/admin/communicate">{() => <Redirect to="/admin/settings/communication" />}</Route>
        <Route path="/admin/branding">{() => <Redirect to="/admin/settings/branding" />}</Route>
        <Route path="/admin" component={AdminDashboardOverview} />
        <Route path="/wa-consent/:token" component={WaConsent} />
        <Route path="/complete-profile" component={CompleteProfile} />
        <Route path="/organizer" component={OrganizerPortal} />
        <Route path="/organizer/profile" component={OrganizerProfile} />
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

        {/* Organizer-protected routes */}
        <Route path="/tournament/:id">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><TournamentHub /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/teams">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><Teams /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/categories">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><Categories /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/players">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><Players /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/auction">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><AuctionOperator /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/reset">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><AuctionReset /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/reports">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><Reports /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/team-reports">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><TeamReports /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/links">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><LinksPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/fortune-wheel">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><FortuneWheel /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/break-timer">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><BreakTimerPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/local-mode">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><LocalModePage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/settings">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><TournamentSettings /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/media-center/:templateId">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><TemplateStudioPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/media-center">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><MediaCenterPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/organizer/media-center/:id/:templateId">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><TemplateStudioPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/organizer/media-center/:id">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid}><MediaCenterPage /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/cricket/match/:matchId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/player/:playerId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/team/:teamId" component={RedirectToScoringApp} />
        <Route path="/cricket/leaderboards" component={RedirectToScoringApp} />
        <Route path="/player/:globalPlayerId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/schedule" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/:matchId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/players" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/matches/:matchId/control" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/matches" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/courts" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/categories" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/analytics" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/branding" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/broadcast" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton" component={RedirectToScoringApp} />

        <Route component={NotFound} />
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
        <TooltipProvider>
          <WouterRouter
            base={import.meta.env.BASE_URL.replace(/\/$/, "")}
            ssrPath={props.ssrPath}
          >
            <BrandingEffects />
            <AdminPwaProvider>
              <LocalOperatorPinEffects />
              <PageTracking />
              <LocalVenueGate>
                <Router />
              </LocalVenueGate>
            </AdminPwaProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </InitialDataProvider>
    </QueryClientProvider>
  );
}

export { homePageInitialData };

export default App;
