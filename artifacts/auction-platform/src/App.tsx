import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBranding } from "@/hooks/use-branding";
import { OrganizerGuard } from "@/components/organizer-guard";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { PageTracking } from "@/components/page-tracking";

import Landing from "@/pages/landing";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewTournament = lazy(() => import("@/pages/tournament-new"));
const TournamentHub = lazy(() => import("@/pages/tournament-hub"));
const Teams = lazy(() => import("@/pages/teams"));
const Categories = lazy(() => import("@/pages/categories"));
const Players = lazy(() => import("@/pages/players"));
const AuctionOperator = lazy(() => import("@/pages/auction-operator"));
const AuctionReset = lazy(() => import("@/pages/auction-reset"));
const DisplayView = lazy(() => import("@/pages/display"));
import { RedirectToOwnerApp } from "@/components/redirect-to-owner-app";
const Reports = lazy(() => import("@/pages/reports"));
const LinksPage = lazy(() => import("@/pages/links"));
const FortuneWheel = lazy(() => import("@/pages/fortune-wheel"));
const PlayerRegister = lazy(() => import("@/pages/player-register"));
const OrganizerLogin = lazy(() => import("@/pages/organizer-login"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminDashboard = lazy(() => import("@/pages/admin"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminIntelligence = lazy(() => import("@/pages/admin-intelligence"));
const ObsOverlay = lazy(() => import("@/pages/obs-overlay"));
const OrganizerPortal = lazy(() => import("@/pages/organizer-portal"));
const OrganizerProfile = lazy(() => import("@/pages/organizer-profile"));
const LegalPage = lazy(() => import("@/pages/legal"));
const LiveViewer = lazy(() => import("@/pages/liveviewer"));
const AdminCommunicate = lazy(() => import("@/pages/admin-communicate"));
const AdminBranding = lazy(() => import("@/pages/admin-branding"));
const WaConsent = lazy(() => import("@/pages/wa-consent"));
const CompleteProfile = lazy(() => import("@/pages/complete-profile"));
const BreakTimerPage = lazy(() => import("@/pages/break-timer"));
const LocalModePage = lazy(() => import("@/pages/local-mode"));
const TeamReports = lazy(() => import("@/pages/team-reports"));
const TournamentSettings = lazy(() => import("@/pages/tournament-settings"));
const SeoSportLanding = lazy(() => import("@/pages/seo-sport-landing"));
const UpcomingAuctions = lazy(() => import("@/pages/upcoming-auctions"));
const ContactPage = lazy(() => import("@/pages/contact"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

function BrandingEffects() {
  const { logos, brandName } = useBranding();

  useEffect(() => {
    if (logos.appIcon) {
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (icon) icon.href = logos.appIcon;
      if (apple) apple.href = logos.appIcon;
    }
    if (brandName && brandName !== "BidWar") {
      document.title = document.title.replace(/BidWar/g, brandName);
    }
  }, [logos.appIcon, brandName]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Landing} />
        <Route path="/upcoming-auctions" component={UpcomingAuctions} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/dashboard">{() => <Redirect to="/organizer" />}</Route>
        <Route path="/tournament/new" component={NewTournament} />
        <Route path="/tournament/:id/login" component={OrganizerLogin} />
        <Route path="/tournament/:id/display" component={DisplayView} />
        <Route path="/tournament/:id/liveviewer">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <TournamentCodeGate tournamentId={tid}>
                <LiveViewer />
              </TournamentCodeGate>
            );
          }}
        </Route>
        <Route path="/tournament/:id/register" component={PlayerRegister} />
        <Route path="/tournament/:id/obs" component={ObsOverlay} />
        <Route path="/tournament/:id/owner/:teamId">
          {(params) => (
            <RedirectToOwnerApp
              tournamentId={params?.id ?? "0"}
              teamId={params?.teamId ?? "0"}
            />
          )}
        </Route>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/reports" component={AdminReports} />
        <Route path="/admin/intelligence" component={AdminIntelligence} />
        <Route path="/admin/communicate/logs" component={AdminCommunicate} />
        <Route path="/admin/communicate" component={AdminCommunicate} />
        <Route path="/admin/branding" component={AdminBranding} />
        <Route path="/wa-consent/:token" component={WaConsent} />
        <Route path="/complete-profile" component={CompleteProfile} />
        <Route path="/organizer" component={OrganizerPortal} />
        <Route path="/organizer/profile" component={OrganizerProfile} />
        <Route path="/legal/:slug" component={LegalPage} />

        {/* SEO landing pages */}
        <Route path="/cricket-auction-software">{() => <SeoSportLanding slug="cricket-auction-software" />}</Route>
        <Route path="/football-player-auction">{() => <SeoSportLanding slug="football-player-auction" />}</Route>
        <Route path="/kabaddi-auction-platform">{() => <SeoSportLanding slug="kabaddi-auction-platform" />}</Route>
        <Route path="/esports-auction-system">{() => <SeoSportLanding slug="esports-auction-system" />}</Route>
        <Route path="/business-league-auction">{() => <SeoSportLanding slug="business-league-auction" />}</Route>
        <Route path="/live-player-bidding">{() => <SeoSportLanding slug="live-player-bidding" />}</Route>
        <Route path="/tournament-auction-platform">{() => <SeoSportLanding slug="tournament-auction-platform" />}</Route>

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

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <BrandingEffects />
          <PageTracking />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
