import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

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
      <Route path="/" component={Dashboard} />
      <Route path="/tournament/new" component={NewTournament} />
      <Route path="/tournament/:id" component={TournamentHub} />
      <Route path="/tournament/:id/teams" component={Teams} />
      <Route path="/tournament/:id/categories" component={Categories} />
      <Route path="/tournament/:id/players" component={Players} />
      <Route path="/tournament/:id/auction" component={AuctionOperator} />
      <Route path="/tournament/:id/display" component={DisplayView} />
      <Route path="/tournament/:id/owner/:teamId" component={OwnerPanel} />
      <Route path="/tournament/:id/reports" component={Reports} />
      <Route path="/tournament/:id/links" component={LinksPage} />
      <Route path="/tournament/:id/fortune-wheel" component={FortuneWheel} />
      <Route path="/tournament/:id/register" component={PlayerRegister} />
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
