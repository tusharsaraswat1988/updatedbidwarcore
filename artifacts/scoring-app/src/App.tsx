import { Suspense, lazy, useMemo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { SCORING_APP_BASE, sportsMissionControlPath } from "@workspace/api-base/scoring-urls";
import { OrganizerGuard } from "@/components/organizer-guard";
import { ScoringFeatureGuard } from "@/components/scoring-feature-guard";
import { SportsShell } from "@/components/sports-shell";
import { getBadmintonSportNav } from "@/lib/badminton-sport-nav";
import { getCricketSportNav } from "@/lib/cricket-sport-nav";
import { BADMINTON_ROUTE_LOADING_CLASS, isBadmintonOrganizerPath } from "@/lib/badminton-routes";
import {
  CRICKET_ROUTE_LOADING_CLASS,
  isCricketOrganizerPath,
} from "@/lib/cricket-routes";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { ScoringAppDocumentChrome } from "@/components/scoring-app-document-chrome";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";

// Route-level code splitting — loading one organizer page must not pull in
// players/matches/mission-control/image-cropper and the rest of the graph.
const SportsMissionControlPage = lazy(() => import("@/pages/sports/mission-control"));
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

const CricketDashboard = lazy(() => import("@/pages/cricket/dashboard"));
const CricketSettings = lazy(() => import("@/pages/cricket/settings"));
const CricketTeams = lazy(() => import("@/pages/cricket/teams"));
const CricketPlayers = lazy(() => import("@/pages/cricket/players"));
const CricketFixtures = lazy(() => import("@/pages/cricket/fixtures"));
const CricketStandings = lazy(() => import("@/pages/cricket/standings"));
const CricketStats = lazy(() => import("@/pages/cricket/stats"));
const CricketOfficials = lazy(() => import("@/pages/cricket/officials"));
const CricketAwards = lazy(() => import("@/pages/cricket/awards"));
const CricketReports = lazy(() => import("@/pages/cricket/reports"));
const CricketMatchCenter = lazy(() => import("@/pages/cricket/match-center"));
const ScoringMatchList = lazy(() => import("@/pages/scoring-match-list"));
const ScoringMatch = lazy(() => import("@/pages/scoring-match"));
const ScoringSchedule = lazy(() => import("@/pages/scoring-schedule"));
const ScoringPublic = lazy(() => import("@/pages/scoring-public"));
const ScoringPublicMatches = lazy(() => import("@/pages/scoring-public-matches"));
const ScoringPublicStandings = lazy(() => import("@/pages/scoring-public-standings"));
const ScoringPublicTeams = lazy(() => import("@/pages/scoring-public-teams"));
const ScoringPublicPlayers = lazy(() => import("@/pages/scoring-public-players"));
const ScoringPublicStatistics = lazy(() => import("@/pages/scoring-public-statistics"));
const ScoringPublicSponsors = lazy(() => import("@/pages/scoring-public-sponsors"));
const ScoringMatchPublic = lazy(() => import("@/pages/scoring-match-public"));
const ScoringPlayerPublic = lazy(() => import("@/pages/scoring-player-public"));
const ScoringTeamPublic = lazy(() => import("@/pages/scoring-team-public"));
const CricketGlobalPlayer = lazy(() => import("@/pages/cricket-global-player"));
const CricketGlobalLeaderboards = lazy(() => import("@/pages/cricket-global-leaderboards"));
const ScoreDisplay = lazy(() => import("@/pages/score-display"));
const CricketObsOverlay = lazy(() => import("@/pages/cricket/obs-overlay"));
const BadmintonScorerPage = lazy(() => import("@/pages/badminton/scorer"));
const BadmintonScorerHomePage = lazy(() => import("@/pages/badminton/scorer-home"));
const BadmintonPublicStandingsPage = lazy(() => import("@/pages/badminton/public-standings"));
const BadmintonDisplayPage = lazy(() => import("@/pages/badminton/display"));
const BadmintonOverlayPage = lazy(() => import("@/pages/badminton/overlay"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ScoringLoginPage = lazy(() => import("@/pages/scoring-login"));

const BASE = SCORING_APP_BASE.replace(/\/$/, "");
const badmintonSportNav = getBadmintonSportNav();
const cricketSportNav = getCricketSportNav();

function isSportsMissionControlPath(path: string): boolean {
  return /^\/tournament\/\d+\/mission-control\/?$/.test(path.split("?")[0] ?? path);
}

function tournamentIdFromMissionControlPath(path: string): number {
  const match = path.match(/^\/tournament\/(\d+)\/mission-control/);
  return match ? parseInt(match[1], 10) : 0;
}

function RouteSuspenseFallback() {
  const [location] = useLocation();
  const className = isBadmintonOrganizerPath(location)
    ? BADMINTON_ROUTE_LOADING_CLASS
    : isCricketOrganizerPath(location) || isSportsMissionControlPath(location)
      ? CRICKET_ROUTE_LOADING_CLASS
      : "min-h-screen bg-background";
  return <div className={className} aria-busy="true" />;
}

function badmintonTournamentIdFromPath(path: string): number {
  const match = path.match(/^\/tournament\/(\d+)\/badminton(\/|$)/);
  return match ? parseInt(match[1], 10) : 0;
}

function cricketTournamentIdFromPath(path: string): number {
  const match = path.match(/^\/tournament\/(\d+)\/score(\/|$)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Sports product home — Tournament Mission Control.
 * Temporarily hosted under /scoring-app; ownership is Sports.
 */
function SportsMissionControlLayout({ tournamentId }: { tournamentId: number }) {
  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const nav = useMemo(() => {
    if (tournament?.sport === "badminton") return badmintonSportNav;
    return cricketSportNav;
  }, [tournament?.sport]);

  if (isLoading || !tournament) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading Sports" />
    );
  }

  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId}>
        <SportsShell tournamentId={tournamentId} nav={nav} noPadding>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <SportsMissionControlPage />
          </Suspense>
        </SportsShell>
      </OrganizerGuard>
    </ScoringFeatureGuard>
  );
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

/**
 * Cricket organizer OS — SportsShell stays mounted across sidebar navigations.
 * CricketOrganizerPageShell becomes a no-op inside this shell.
 */
function CricketOrganizerLayout({ tournamentId }: { tournamentId: number }) {
  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId}>
        <SportsShell tournamentId={tournamentId} nav={cricketSportNav} noPadding>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Switch>
              <Route path="/tournament/:id/score/dashboard" component={CricketDashboard} />
              <Route path="/tournament/:id/score/settings" component={CricketSettings} />
              <Route path="/tournament/:id/score/teams" component={CricketTeams} />
              <Route path="/tournament/:id/score/players" component={CricketPlayers} />
              <Route path="/tournament/:id/score/fixtures" component={CricketFixtures} />
              <Route path="/tournament/:id/score/standings" component={CricketStandings} />
              <Route path="/tournament/:id/score/stats" component={CricketStats} />
              <Route path="/tournament/:id/score/officials" component={CricketOfficials} />
              <Route path="/tournament/:id/score/awards" component={CricketAwards} />
              <Route path="/tournament/:id/score/reports" component={CricketReports} />
              <Route path="/tournament/:id/score/schedule" component={ScoringSchedule} />
              <Route path="/tournament/:id/score/:matchId/live" component={ScoringMatch} />
              <Route path="/tournament/:id/score/:matchId" component={CricketMatchCenter} />
              <Route path="/tournament/:id/score" component={ScoringMatchList} />
            </Switch>
          </Suspense>
        </SportsShell>
      </OrganizerGuard>
    </ScoringFeatureGuard>
  );
}

function Router() {
  const [location] = useLocation();

  if (isSportsMissionControlPath(location)) {
    return (
      <SportsMissionControlLayout
        tournamentId={tournamentIdFromMissionControlPath(location)}
      />
    );
  }

  if (isBadmintonOrganizerPath(location)) {
    return <BadmintonOrganizerLayout tournamentId={badmintonTournamentIdFromPath(location)} />;
  }

  if (isCricketOrganizerPath(location)) {
    return <CricketOrganizerLayout tournamentId={cricketTournamentIdFromPath(location)} />;
  }

  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Switch>
        <Route path="/login" component={ScoringLoginPage} />
        <Route path="/tournament/:id/score-display" component={ScoreDisplay} />
        <Route path="/tournament/:id/cricket/obs/:matchId" component={CricketObsOverlay} />

        <Route path="/badminton/scorer">
          {() => <ScoringFeatureGuard><BadmintonScorerHomePage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/badminton/standings">
          {() => <ScoringFeatureGuard><BadmintonPublicStandingsPage /></ScoringFeatureGuard>}
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
        <Route path="/tournament/:id/cricket/matches">
          {() => <ScoringFeatureGuard><ScoringPublicMatches /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/standings">
          {() => <ScoringFeatureGuard><ScoringPublicStandings /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/teams">
          {() => <ScoringFeatureGuard><ScoringPublicTeams /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/players">
          {() => <ScoringFeatureGuard><ScoringPublicPlayers /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/statistics">
          {() => <ScoringFeatureGuard><ScoringPublicStatistics /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/cricket/sponsors">
          {() => <ScoringFeatureGuard><ScoringPublicSponsors /></ScoringFeatureGuard>}
        </Route>
        <Route path="/cricket/leaderboards" component={CricketGlobalLeaderboards} />
        <Route path="/player/:globalPlayerId" component={CricketGlobalPlayer} />
        <Route path="/tournament/:id/cricket">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>

        <Route path="/tournament/:id">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <Redirect to={sportsMissionControlPath(tid)} replace />;
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
