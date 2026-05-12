import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrganizerGuard } from "@/components/organizer-guard";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NewTournament from "@/pages/tournament-new";
import TournamentHub from "@/pages/tournament-hub";
import Teams from "@/pages/teams";
import Categories from "@/pages/categories";
import Players from "@/pages/players";
import AuctionOperator from "@/pages/auction-operator";
import DisplayView from "@/pages/display";
import OwnerPanel from "@/pages/owner-panel";
import Reports from "@/pages/reports";
import LinksPage from "@/pages/links";
import FortuneWheel from "@/pages/fortune-wheel";
import PlayerRegister from "@/pages/player-register";
import OrganizerLogin from "@/pages/organizer-login";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin";
import ObsOverlay from "@/pages/obs-overlay";
import OrganizerPortal from "@/pages/organizer-portal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tournament/new" component={NewTournament} />
      <Route path="/tournament/:id/login" component={OrganizerLogin} />
      <Route path="/tournament/:id/display" component={DisplayView} />
      <Route path="/tournament/:id/register" component={PlayerRegister} />
      <Route path="/tournament/:id/obs" component={ObsOverlay} />
      <Route path="/tournament/:id/owner/:teamId" component={OwnerPanel} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/organizer" component={OrganizerPortal} />

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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
