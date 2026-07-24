import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { OrganizerGuard } from "@/components/organizer-guard";
import { ScoringFeatureGuard } from "@/components/scoring-feature-guard";
import { SportsShell } from "@/components/sports-shell";
import { getBadmintonSportNav } from "@/lib/badminton-sport-nav";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { ScoringAppDocumentChrome } from "@/components/scoring-app-document-chrome";

// Route-level code splitting — loading one organizer page must not pull in
// players/matches/mission-control/image-cropper and the rest of the graph.
const BadmintonTournamentHub = lazy(() => import("@/pages/badminton/tournament-hub"));
const BadmintonPlayersPage = lazy(() => import("@/pages/badminton/players"));
const BadmintonMatchesPage = lazy(() => import("@/pages/badminton/matches"));
const BadmintonMatchControlPage = lazy(() => import("@/pages/badminton/match-control"));
const BadmintonCourtsPage = lazy(() => import("@/pages/badminton/courts"));
const BadmintonScorersPage = lazy(() => import("@/pages/badminton/scorers"));
const BadmintonCategoriesPage = lazy(() => import("@/pages/badminton/categories"));
const BadmintonFixturesPage = lazy(() => import("@/pages/badminton/fixtures"));
const BadmintonSchedulePage = lazy(() => import("@/pages/badminton/schedule"));
const BadmintonControlCenterPage = lazy(() => import("@/pages/badminton/control-center"));
const BadmintonResultsPage = lazy(() => import("@/pages/badminton/results"));
const BadmintonSummaryPage = lazy(() => import("@/pages/badminton/summary"));
const BadmintonScoringFormatPage = lazy(() => import("@/pages/badminton/scoring-format"));
const BadmintonAnalyticsPage = lazy(() => import("@/pages/badminton/analytics"));
const BadmintonBrandingPage = lazy(() => import("@/pages/badminton/branding"));
const BadmintonBroadcastPage = lazy(() => import("@/pages/badminton/broadcast"));

const ScoringMatchList = lazy(() => import("@/pages/scoring-match-list"));
const ScoringMatch = lazy(() => import("@/pages/scoring-match"));
const ScoringSchedule = lazy(() => import("@/pages/scoring-schedule"));
const ScoringPublic = lazy(() => import("@/pages/scoring-public"));
const ScoringMatchPublic = lazy(() => import("@/pages/scoring-match-public"));
const ScoringPlayerPublic = lazy(() => import("@/pages/scoring-player-public"));
const ScoringTeamPublic = lazy(() => import("@/pages/scoring-team-public"));
const CricketGlobalPlayer = lazy(() => import("@/pages/cricket-global-player"));
const CricketGlobalLeaderboards = lazy(() => import("@/pages/cricket-global-leaderboards"));
const ScoreDisplay = lazy(() => import("@/pages/score-display"));
const BadmintonScorerPage = lazy(() => import("@/pages/badminton/scorer"));
const BadmintonScorerHomePage = lazy(() => import("@/pages/badminton/scorer-home"));
const BadmintonDisplayPage = lazy(() => import("@/pages/badminton/display"));
const BadmintonOverlayPage = lazy(() => import("@/pages/badminton/overlay"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ScoringAppTournamentHomeRedirect = lazy(
  () => import("@/components/scoring/cricket-scoring-sport-redirect").then((m) => ({
    default: m.ScoringAppTournamentHomeRedirect,
  })),
);

const BASE = SCORING_APP_BASE.replace(/\/$/, "");
const badmintonSportNav = getBadmintonSportNav();

function RouteSuspenseFallback() {
  const [location] = useLocation();
  const className = isBadmintonOrganizerPath(location)
    ? BADMINTON_ROUTE_LOADING_CLASS
    : "min-h-screen bg-background";
  return <div className={className} aria-busy="true" />;
}

function badmintonTournamentIdFromPath(path: string): number {
  const match = path.match(/^\/tournament\/(\d+)\/badminton(\/|$)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Guards + SportsShell stay mounted across badminton sidebar navigations.
 * Pages keep using HubPageShell, which becomes a no-op inside this shell.
 */
function BadmintonOrganizerLayout({ tournamentId }: { tournamentId: number }) {
  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId}>
        <SportsShell tournamentId={tournamentId} nav={badmintonSportNav} noPadding>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Switch>
              <Route path="/tournament/:id/badminton/players" component={BadmintonPlayersPage} />
              <Route path="/tournament/:id/badminton/matches/:matchId/control" component={BadmintonMatchControlPage} />
              <Route path="/tournament/:id/badminton/matches" component={BadmintonMatchesPage} />
              <Route path="/tournament/:id/badminton/courts" component={BadmintonCourtsPage} />
              <Route path="/tournament/:id/badminton/scorers" component={BadmintonScorersPage} />
              <Route path="/tournament/:id/badminton/categories" component={BadmintonCategoriesPage} />
              <Route path="/tournament/:id/badminton/fixtures" component={BadmintonFixturesPage} />
              <Route path="/tournament/:id/badminton/schedule" component={BadmintonSchedulePage} />
              <Route path="/tournament/:id/badminton/control" component={BadmintonControlCenterPage} />
              <Route path="/tournament/:id/badminton/results" component={BadmintonResultsPage} />
              <Route path="/tournament/:id/badminton/summary" component={BadmintonSummaryPage} />
              <Route path="/tournament/:id/badminton/scoring-format" component={BadmintonScoringFormatPage} />
              <Route path="/tournament/:id/badminton/analytics" component={BadmintonAnalyticsPage} />
              <Route path="/tournament/:id/badminton/branding" component={BadmintonBrandingPage} />
              <Route path="/tournament/:id/badminton/broadcast" component={BadmintonBroadcastPage} />
              <Route path="/tournament/:id/badminton" component={BadmintonTournamentHub} />
            </Switch>
          </Suspense>
        </SportsShell>
      </OrganizerGuard>
    </ScoringFeatureGuard>
  );
}

function Router() {
  const [location] = useLocation();

  if (isBadmintonOrganizerPath(location)) {
    return <BadmintonOrganizerLayout tournamentId={badmintonTournamentIdFromPath(location)} />;
  }

  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Switch>
        <Route path="/tournament/:id/score-display" component={ScoreDisplay} />

        <Route path="/badminton/scorer">
          {() => <ScoringFeatureGuard><BadmintonScorerHomePage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/badminton/:matchId/score">
          {() => <ScoringFeatureGuard><BadmintonScorerPage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/badminton/:matchId/display">
          {() => <ScoringFeatureGuard><BadmintonDisplayPage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/badminton/:matchId/overlay">
          {() => <ScoringFeatureGuard><BadmintonOverlayPage /></ScoringFeatureGuard>}
        </Route>

        <Route path="/tournament/:id/cricket/match/:matchId">
          {() => <ScoringFeatureGuard><ScoringMatchPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/player/:playerId">
          {() => <ScoringFeatureGuard><ScoringPlayerPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/team/:teamId">
          {() => <ScoringFeatureGuard><ScoringTeamPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/cricket/leaderboards" component={CricketGlobalLeaderboards} />
        <Route path="/player/:globalPlayerId" component={CricketGlobalPlayer} />
        <Route path="/tournament/:id/cricket">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>

        <Route path="/tournament/:id/score/schedule">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><ScoringSchedule /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/score/:matchId">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><ScoringMatch /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/score">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><ScoringMatchList /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>

        <Route path="/tournament/:id">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <ScoringAppTournamentHomeRedirect tournamentId={tid} />;
          }}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <WouterRouter base={BASE}>
      <ScoringAppDocumentChrome />
      <LocalOperatorPinEffects />
      <Router />
    </WouterRouter>
  );
}
