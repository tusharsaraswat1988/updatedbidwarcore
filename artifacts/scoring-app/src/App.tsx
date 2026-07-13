import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { OrganizerGuard } from "@/components/organizer-guard";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { ScoringFeatureGuard } from "@/components/scoring-feature-guard";
import { ScoringAppTournamentHomeRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { useLocation } from "wouter";

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
const BadmintonTournamentHub = lazy(() => import("@/pages/badminton/tournament-hub"));
const BadmintonPlayersPage = lazy(() => import("@/pages/badminton/players"));
const BadmintonMatchesPage = lazy(() => import("@/pages/badminton/matches"));
const BadmintonMatchControlPage = lazy(() => import("@/pages/badminton/match-control"));
const BadmintonCourtsPage = lazy(() => import("@/pages/badminton/courts"));
const BadmintonCategoriesPage = lazy(() => import("@/pages/badminton/categories"));
const BadmintonFixturesPage = lazy(() => import("@/pages/badminton/fixtures"));
const BadmintonSchedulePage = lazy(() => import("@/pages/badminton/schedule"));
const BadmintonControlCenterPage = lazy(() => import("@/pages/badminton/control-center"));
const BadmintonResultsPage = lazy(() => import("@/pages/badminton/results"));
const BadmintonScoringFormatPage = lazy(() => import("@/pages/badminton/scoring-format"));
const BadmintonAnalyticsPage = lazy(() => import("@/pages/badminton/analytics"));
const BadmintonBrandingPage = lazy(() => import("@/pages/badminton/branding"));
const BadmintonBroadcastPage = lazy(() => import("@/pages/badminton/broadcast"));
const BadmintonScorerPage = lazy(() => import("@/pages/badminton/scorer"));
const BadmintonScorerHomePage = lazy(() => import("@/pages/badminton/scorer-home"));
const BadmintonDisplayPage = lazy(() => import("@/pages/badminton/display"));
const BadmintonOverlayPage = lazy(() => import("@/pages/badminton/overlay"));
const NotFound = lazy(() => import("@/pages/not-found"));

const BASE = SCORING_APP_BASE.replace(/\/$/, "");

function RouteSuspenseFallback() {
  const [location] = useLocation();
  const className = isBadmintonOrganizerPath(location)
    ? BADMINTON_ROUTE_LOADING_CLASS
    : "min-h-screen bg-background";
  return <div className={className} aria-busy="true" />;
}

function Router() {
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

        <Route path="/tournament/:id/badminton/players">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonPlayersPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/matches/:matchId/control">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonMatchControlPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/matches">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonMatchesPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/courts">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonCourtsPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/categories">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonCategoriesPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/fixtures">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonFixturesPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/schedule">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonSchedulePage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/control">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonControlCenterPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/results">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonResultsPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/scoring-format">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonScoringFormatPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/analytics">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonAnalyticsPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/branding">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonBrandingPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton/broadcast">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonBroadcastPage /></OrganizerGuard>
              </ScoringFeatureGuard>
            );
          }}
        </Route>
        <Route path="/tournament/:id/badminton">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return (
              <ScoringFeatureGuard>
                <OrganizerGuard tournamentId={tid}><BadmintonTournamentHub /></OrganizerGuard>
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
      <LocalOperatorPinEffects />
      <Router />
    </WouterRouter>
  );
}
