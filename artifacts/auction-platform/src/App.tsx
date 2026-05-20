import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBranding } from "@/hooks/use-branding";
import { OrganizerGuard } from "@/components/organizer-guard";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NewTournament from "@/pages/tournament-new";
import TournamentHub from "@/pages/tournament-hub";
import Teams from "@/pages/teams";
import Categories from "@/pages/categories";
import Players from "@/pages/players";
import AuctionOperator from "@/pages/auction-operator";
import AuctionReset from "@/pages/auction-reset";
import DisplayView from "@/pages/display";
import OwnerPanel from "@/pages/owner-panel";
import Reports from "@/pages/reports";
import LinksPage from "@/pages/links";
import FortuneWheel from "@/pages/fortune-wheel";
import PlayerRegister from "@/pages/player-register";
import OrganizerLogin from "@/pages/organizer-login";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin";
import AdminReports from "@/pages/admin-reports";
import AdminIntelligence from "@/pages/admin-intelligence";
import ObsOverlay from "@/pages/obs-overlay";
import OrganizerPortal from "@/pages/organizer-portal";
import LegalPage from "@/pages/legal";
import LiveViewer from "@/pages/liveviewer";
import AdminCommunicate from "@/pages/admin-communicate";
import AdminBranding from "@/pages/admin-branding";
import WaConsent from "@/pages/wa-consent";
import CompleteProfile from "@/pages/complete-profile";
import BreakTimerPage from "@/pages/break-timer";
import LocalModePage from "@/pages/local-mode";
import SeoSportLanding from "@/pages/seo-sport-landing";

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
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
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
      <Route path="/tournament/:id/owner/:teamId" component={OwnerPanel} />
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <BrandingEffects />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
