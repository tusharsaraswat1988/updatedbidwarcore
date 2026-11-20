import { Suspense, lazy, useEffect, useMemo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useRoute, Redirect } from "wouter";
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
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { ScoringAppDocumentChrome } from "@/components/scoring-app-document-chrome";
import { ScorerPwaProvider } from "@/contexts/scorer-pwa-context";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";

// Route-level code splitting — loading one organizer page must not pull in
// players/matches/mission-control/image-cropper and the rest of the graph.
const SportsMissionControlPage = lazyWithRetry(() => import("@/pages/sports/mission-control"));
const BadmintonTournamentHub = lazyWithRetry(() => import("@/pages/badminton/tournament-hub"));
const BadmintonPlayersPage = lazyWithRetry(() => import("@/pages/badminton/players"));
const BadmintonMatchesPage = lazyWithRetry(() => import("@/pages/badminton/matches"));
const BadmintonMatchControlPage = lazyWithRetry(() => import("@/pages/badminton/match-control"));
const BadmintonCourtsPage = lazyWithRetry(() => import("@/pages/badminton/courts"));
const BadmintonScorersPage = lazyWithRetry(() => import("@/pages/badminton/scorers"));
const BadmintonCategoriesPage = lazyWithRetry(() => import("@/pages/badminton/categories"));
const BadmintonFixturesPage = lazyWithRetry(() => import("@/pages/badminton/fixtures"));
const BadmintonSchedulePage = lazyWithRetry(() => import("@/pages/badminton/schedule"));
const BadmintonControlCenterPage = lazyWithRetry(() => import("@/pages/badminton/control-center"));
const BadmintonResultsPage = lazyWithRetry(() => import("@/pages/badminton/results"));
const BadmintonSummaryPage = lazyWithRetry(() => import("@/pages/badminton/summary"));
const BadmintonScoringFormatPage = lazyWithRetry(() => import("@/pages/badminton/scoring-format"));
const BadmintonAnalyticsPage = lazyWithRetry(() => import("@/pages/badminton/analytics"));
const BadmintonBrandingPage = lazyWithRetry(() => import("@/pages/badminton/branding"));
const BadmintonBroadcastPage = lazyWithRetry(() => import("@/pages/badminton/broadcast"));

const CricketDashboard = lazyWithRetry(() => import("@/pages/cricket/dashboard"));
const CricketSettings = lazyWithRetry(() => import("@/pages/cricket/settings"));
const CricketRules = lazyWithRetry(() => import("@/pages/cricket/rules"));
const CricketTeams = lazyWithRetry(() => import("@/pages/cricket/teams"));
const CricketPlayers = lazyWithRetry(() => import("@/pages/cricket/players"));
const CricketFixtures = lazyWithRetry(() => import("@/pages/cricket/fixtures"));
const CricketStandings = lazyWithRetry(() => import("@/pages/cricket/standings"));
const CricketStats = lazyWithRetry(() => import("@/pages/cricket/stats"));
const CricketOfficials = lazyWithRetry(() => import("@/pages/cricket/officials"));
const CricketAwards = lazyWithRetry(() => import("@/pages/cricket/awards"));
const CricketReports = lazyWithRetry(() => import("@/pages/cricket/reports"));
const CricketMatchCenter = lazyWithRetry(() => import("@/pages/cricket/match-center"));
const CricketLiveControl = lazyWithRetry(() => import("@/pages/cricket/live-control"));
const CricketLinks = lazyWithRetry(() => import("@/pages/cricket/links"));
const ScoringMatchList = lazyWithRetry(() => import("@/pages/scoring-match-list"));
const ScoringMatch = lazyWithRetry(() => import("@/pages/scoring-match"));
const ScoringSchedule = lazyWithRetry(() => import("@/pages/scoring-schedule"));
const ScoringPublic = lazyWithRetry(() => import("@/pages/scoring-public"));
const ScoringPublicMatches = lazyWithRetry(() => import("@/pages/scoring-public-matches"));
const ScoringPublicStandings = lazyWithRetry(() => import("@/pages/scoring-public-standings"));
const ScoringPublicTeams = lazyWithRetry(() => import("@/pages/scoring-public-teams"));
const ScoringPublicPlayers = lazyWithRetry(() => import("@/pages/scoring-public-players"));
const ScoringPublicStatistics = lazyWithRetry(() => import("@/pages/scoring-public-statistics"));
const ScoringPublicSponsors = lazyWithRetry(() => import("@/pages/scoring-public-sponsors"));
const ScoringMatchPublic = lazyWithRetry(() => import("@/pages/scoring-match-public"));
const ScoringPlayerPublic = lazyWithRetry(() => import("@/pages/scoring-player-public"));
const ScoringTeamPublic = lazyWithRetry(() => import("@/pages/scoring-team-public"));
const CricketGlobalPlayer = lazyWithRetry(() => import("@/pages/cricket-global-player"));
const CricketGlobalLeaderboards = lazyWithRetry(() => import("@/pages/cricket-global-leaderboards"));
const CricketScorerHomePage = lazyWithRetry(() => import("@/pages/cricket/scorer-home"));
const CricketScorerPage = lazyWithRetry(() => import("@/pages/cricket/scorer"));
const ScoreDisplay = lazyWithRetry(() => import("@/pages/score-display"));
const BadmintonScorerPage = lazyWithRetry(() => import("@/pages/badminton/scorer"));
const BadmintonScorerHomePage = lazyWithRetry(() => import("@/pages/badminton/scorer-home"));
const BadmintonPublicStandingsPage = lazyWithRetry(() => import("@/pages/badminton/public-standings"));
const BadmintonDisplayPage = lazyWithRetry(() => import("@/pages/badminton/display"));
const BadmintonOverlayPage = lazyWithRetry(() => import("@/pages/badminton/overlay"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
const ScoringLoginPage = lazyWithRetry(() => import("@/pages/scoring-login"));

const BASE = SCORING_APP_BASE.replace(/\/$/, "");

function isSportsMissionControlPath(path: string): boolean {
  return /^\/tournament\/\d+\/mission-control\/?$/.test(path.split("?")[0] ?? path);
}

function tournamentIdFromMissionControlPath(path: string): number {
  const match = path.match(/^\/tournament\/(\d+)\/mission-control/);
  return match ? parseInt(match[1], 10) : 0;
}

function SportsTabSuspenseSkeleton() {
  return (
    <div className="bw-organizer-light p-6 md:p-8 max-w-7xl mx-auto space-y-6" data-surface="organizer" aria-busy="true" aria-label="Loading section">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28 rounded bg-primary/20" />
          <Skeleton className="h-7 w-64 rounded-lg bg-slate-200" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg bg-slate-200" />
          <Skeleton className="h-9 w-32 rounded-lg bg-primary/20" />
        </div>
      </div>

      {/* KPI / Metric Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-24 rounded-xl bg-card border border-border/40" />
        <Skeleton className="h-24 rounded-xl bg-card border border-border/40" />
        <Skeleton className="h-24 rounded-xl bg-card border border-border/40" />
        <Skeleton className="h-24 rounded-xl bg-card border border-border/40" />
      </div>

      {/* Main Content / Table Skeleton */}
      <div className="rounded-xl border border-border/40 bg-card/40 p-6 space-y-4">
        <div className="flex justify-between items-center pb-2">
          <Skeleton className="h-5 w-44 rounded bg-slate-200" />
          <Skeleton className="h-8 w-28 rounded-md bg-slate-200" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg bg-slate-200" />
        <Skeleton className="h-12 w-full rounded-lg bg-slate-200" />
        <Skeleton className="h-12 w-full rounded-lg bg-slate-200" />
        <Skeleton className="h-12 w-full rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

/** Retired cricket OBS scorebug. Old browser sources open the V2 overlay. */
function RedirectLegacyCricketObs() {
  const [, params] = useRoute("/tournament/:id/cricket/obs/:matchId");
  const tournamentId = params?.id ?? "";

  useEffect(() => {
    if (!tournamentId) return;
    window.location.replace(`/tournament/${tournamentId}/cricket/obs/v2`);
  }, [tournamentId]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Opening broadcast overlay…
    </div>
  );
}

function RouteSuspenseFallback() {
  return <GlobalLoadingScreen label="Loading scoring…" />;
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
    if (tournament?.sport === "badminton") return getBadmintonSportNav();
    return getCricketSportNav();
  }, [tournament?.sport]);

  if (isLoading || !tournament) {
    return <GlobalLoadingScreen label="Loading sports…" />;
  }

  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId} requiredModule="scoring">
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
  const nav = useMemo(() => getBadmintonSportNav(), []);
  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId} requiredModule="scoring" requiredSport="badminton">
        <SportsShell tournamentId={tournamentId} nav={nav} noPadding>
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
  const nav = useMemo(() => getCricketSportNav(), []);
  return (
    <ScoringFeatureGuard>
      <OrganizerGuard tournamentId={tournamentId} requiredModule="scoring" requiredSport="cricket">
        <SportsShell tournamentId={tournamentId} nav={nav} noPadding>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Switch>
              <Route path="/tournament/:id/score/dashboard" component={CricketDashboard} />
              <Route path="/tournament/:id/score/settings" component={CricketSettings} />
              <Route path="/tournament/:id/score/rules" component={CricketRules} />
              <Route path="/tournament/:id/score/teams" component={CricketTeams} />
              <Route path="/tournament/:id/score/players" component={CricketPlayers} />
              <Route path="/tournament/:id/score/fixtures" component={CricketFixtures} />
              <Route path="/tournament/:id/score/standings" component={CricketStandings} />
              <Route path="/tournament/:id/score/stats" component={CricketStats} />
              <Route path="/tournament/:id/score/officials" component={CricketOfficials} />
              <Route path="/tournament/:id/score/awards" component={CricketAwards} />
              <Route path="/tournament/:id/score/reports" component={CricketReports} />
              <Route path="/tournament/:id/score/schedule" component={ScoringSchedule} />
              <Route path="/tournament/:id/score/live-control" component={CricketLiveControl} />
              <Route path="/tournament/:id/score/links" component={CricketLinks} />
              <Route path="/tournament/:id/score/:matchId/live" component={ScoringMatch} />
              <Route path="/tournament/:id/score/:matchId" component={CricketMatchCenter} />
              <Route path="/tournament/:id/score" component={CricketFixtures} />
            </Switch>
          </Suspense>
        </SportsShell>
      </OrganizerGuard>
    </ScoringFeatureGuard>
  );
}

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    syncDocumentSurfaceTheme(location);
  }, [location]);

  // Normalize accidental double base prefix (e.g. /scoring-app/scoring-app/... -> /scoring-app/...)
  if (location === "/scoring-app" || location.startsWith("/scoring-app/")) {
    const canonical = location.slice("/scoring-app".length) || "/";
    return <Redirect to={canonical} replace />;
  }

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
        <Route path="/">
          {() => <Redirect to="/cricket/scorer" replace />}
        </Route>
        <Route path="/login" component={ScoringLoginPage} />
        <Route path="/tournament/:id/score-display" component={ScoreDisplay} />
        <Route path="/tournament/:id/cricket/obs/:matchId" component={RedirectLegacyCricketObs} />

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
        <Route path="/cricket/scorer">
          {() => <ScoringFeatureGuard><CricketScorerHomePage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/cricket/:matchId/score">
          {() => <ScoringFeatureGuard><CricketScorerPage /></ScoringFeatureGuard>}
        </Route>
        <Route path="/:code/fanpage">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/fan/:id">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/fanpage/:id">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>
        <Route path="/tournament/:id/fan">
          {() => <ScoringFeatureGuard><ScoringPublic /></ScoringFeatureGuard>}
        </Route>
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

function ScoringShell() {
  const [location] = useLocation();

  return (
    <ErrorBoundary fallbackTitle="BidWar Sports Platform" resetKey={location}>
      <ScorerPwaProvider>
        <ScoringAppDocumentChrome />
        <LocalOperatorPinEffects />
        <Router />
      </ScorerPwaProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <WouterRouter base={BASE}>
      <ScoringShell />
    </WouterRouter>
  );
}
