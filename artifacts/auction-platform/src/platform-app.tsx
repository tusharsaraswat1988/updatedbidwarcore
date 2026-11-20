import { lazy, Suspense, useMemo, useEffect } from "react";
import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrganizerGuard } from "@/components/organizer-guard";
import { AppLayout } from "@/components/layout";
import { parseAuctionOrganizerShell } from "@/lib/auction-organizer-shell";
import { AdminPwaProvider } from "@/contexts/admin-pwa-context";
import { LocalVenueGate } from "@/components/local-venue-gate";
import { LocalOperatorPinEffects } from "@/components/local-operator-pin-effects";
import { RedirectToScoringApp } from "@/components/redirect-to-scoring-app";
import { RedirectToOwnerApp } from "@/components/redirect-to-owner-app";
import { readWindowAcademyData } from "@/lib/academy-public";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

import { isOrganizerRoute, syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";
import AdminLogin from "@/pages/admin-login";

const TournamentSettings = lazyWithRetry(() => import("@/pages/tournament-settings"));
const AuctionOperator = lazyWithRetry(() => import("@/pages/auction-operator"));
const NewTournament = lazyWithRetry(() => import("@/pages/tournament-new"));
const TournamentHome = lazyWithRetry(() => import("@/pages/tournament-home"));
const AuctionOverview = lazyWithRetry(() => import("@/pages/auction-overview"));
const Teams = lazyWithRetry(() => import("@/pages/teams"));
const Categories = lazyWithRetry(() => import("@/pages/categories"));
const Players = lazyWithRetry(() => import("@/pages/players"));
const AuctionReset = lazyWithRetry(() => import("@/pages/auction-reset"));
const DisplayView = lazyWithRetry(() => import("@/pages/display"));
const SideDisplayView = lazyWithRetry(() => import("@/pages/side-display"));
const Reports = lazyWithRetry(() => import("@/pages/reports"));
const LinksPage = lazyWithRetry(() => import("@/pages/links"));
const FortuneWheel = lazyWithRetry(() => import("@/pages/fortune-wheel"));
const PlayerRegister = lazyWithRetry(() => import("@/pages/player-register"));
const PlayerRegisterLegacy = lazyWithRetry(() => import("@/pages/player-register-legacy"));
const OrganizerLogin = lazyWithRetry(() => import("@/pages/organizer-login"));
const AdminDashboardOverview = lazyWithRetry(() => import("@/pages/admin-dashboard-overview"));
const AdminEventsActivities = lazyWithRetry(() => import("@/pages/admin-events-activities"));
const AdminLiveOperations = lazyWithRetry(() => import("@/pages/admin-live-operations"));
const AdminTournamentsList = lazyWithRetry(() => import("@/pages/admin-tournaments-list"));
const AdminBplEditions = lazyWithRetry(() => import("@/pages/admin-bpl-editions"));
const AdminOrganisersList = lazyWithRetry(() => import("@/pages/admin-organisers-list"));
const AdminMembersList = lazyWithRetry(() => import("@/pages/admin-members-list"));
const AdminSportsPage = lazyWithRetry(() => import("@/pages/admin-sports-page"));
const AdminSystemPage = lazyWithRetry(() => import("@/pages/admin-system-page"));
const AdminTournamentDetail = lazyWithRetry(() => import("@/pages/admin-tournament-detail"));
const TournamentMasterWorkbook = lazyWithRetry(() => import("@/pages/tournament-master-workbook"));
const AdminOrganiserDetail = lazyWithRetry(() => import("@/pages/admin-organiser-detail"));
const AdminReports = lazyWithRetry(() => import("@/pages/admin-reports"));
const AdminIntelligence = lazyWithRetry(() => import("@/pages/admin-intelligence"));
const ObsV2OverlayPreview = lazyWithRetry(() => import("@/pages/obs-v2-overlay-preview"));
/** Design preview sandbox — not production. Remove/gate after approval. */
const SoldPosterV2Preview = lazyWithRetry(() => import("@/pages/sold-poster-v2-preview"));
const ObsV2Overlay = lazyWithRetry(() => import("@/pages/obs-v2-overlay"));
/** @deprecated Prefer /obs/v2 — kept for bookmarks during rollout */
const ObsLabOverlayPreview = lazyWithRetry(() => import("@/pages/obs-v2-overlay-preview"));
const ObsLabOverlay = lazyWithRetry(() => import("@/pages/obs-v2-overlay"));
const CricketObsV2Preview = lazyWithRetry(() => import("@/pages/cricket-obs-v2-preview"));
const CricketObsWedding = lazyWithRetry(() => import("@/pages/cricket-obs-wedding"));
const CricketObsWeddingPreview = lazyWithRetry(() => import("@/pages/cricket-obs-wedding-preview"));
const OrganizerPortal = lazyWithRetry(() => import("@/pages/organizer-portal"));
const OrganizerProfile = lazyWithRetry(() => import("@/pages/organizer-profile"));
const LiveViewer = lazyWithRetry(() => import("@/pages/liveviewer"));
const AdminCommunicationCenter = lazyWithRetry(() => import("@/pages/admin-communication-center"));
const AdminCommunicate = lazyWithRetry(() => import("@/pages/admin-communicate"));
const AdminAdminNotifications = lazyWithRetry(() => import("@/pages/admin-admin-notifications"));
const AdminAdminNotificationSettings = lazyWithRetry(() => import("@/pages/admin-admin-notification-settings"));
const AdminBranding = lazyWithRetry(() => import("@/pages/admin-branding"));
const AdminAcademyLessonsList = lazyWithRetry(() => import("@/pages/admin-academy-lessons-list"));
const AdminAcademyLessonForm = lazyWithRetry(() => import("@/pages/admin-academy-lesson-form"));
const WaConsent = lazyWithRetry(() => import("@/pages/wa-consent"));
const CompleteProfile = lazyWithRetry(() => import("@/pages/complete-profile"));
const BreakTimerPage = lazyWithRetry(() => import("@/pages/break-timer"));
const LocalModePage = lazyWithRetry(() => import("@/pages/local-mode"));
const UnifiedFanPage = lazyWithRetry(() => import("@/pages/unified-fan-page"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));

function RouteSuspenseFallback() {
  if (
    readWindowAcademyData() &&
    (document.getElementById("academy-ssr-content") ||
      document.getElementById("academy-ssr-fallback"))
  ) {
    return null;
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "";

  // OBS overlays must boot transparent (Browser Source chroma).
  if (/\/obs(\/(v2|lab))?(\/preview)?\/?$/.test(path) || path.includes("/obs/")) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background: "transparent",
        }}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading broadcast overlay"
      />
    );
  }

  if (path === "/admin/login" || path.startsWith("/admin/login")) {
    return null;
  }

  return <GlobalLoadingScreen />;
}

/** Old classic overlay URLs. Graphics are v2; bookmarks and OBS sources keep working. */
function LegacyObsRedirect({
  tournamentId,
  preview = false,
}: {
  tournamentId: string;
  preview?: boolean;
}) {
  const search = useSearch();
  const base = `/tournament/${tournamentId}/obs/v2${preview ? "/preview" : ""}`;
  const qs = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return <Redirect to={`${base}${qs}`} />;
}

function LegacyLiveRedirect() {
  const search = useSearch();
  const auction = useMemo(() => {
    try {
      return new URLSearchParams(search).get("auction");
    } catch {
      return null;
    }
  }, [search]);

  if (auction && /^\d+$/.test(auction)) {
    return <Redirect to={`/live/${auction}`} />;
  }
  return <Redirect to="/upcoming-auctions" />;
}

function OrganizerPageFallback() {
  return <GlobalLoadingScreen fullScreen={false} theme="light" label="Loading…" />;
}

/**
 * One organiser shell for auction setup pages. Lazy pages suspend inside the
 * main pane, so the sidebar stays mounted across those route changes.
 * Auction Control, scoring, and OBS stay on their own routes.
 */
function AuctionOrganizerShell({
  tournamentId,
  requiredModule,
}: {
  tournamentId: number;
  requiredModule?: "auction";
}) {
  return (
    <OrganizerGuard tournamentId={tournamentId} requiredModule={requiredModule}>
      <AppLayout tournamentId={tournamentId}>
        <Suspense fallback={<OrganizerPageFallback />}>
          <Switch>
            <Route path="/tournament/:id/auction-overview">
              {() => <AuctionOverview />}
            </Route>
            <Route path="/tournament/:id/overview">
              {() => <AuctionOverview />}
            </Route>
            <Route path="/tournament/:id/teams" component={Teams} />
            <Route path="/tournament/:id/categories" component={Categories} />
            <Route path="/tournament/:id/players" component={Players} />
            <Route path="/tournament/:id/reset" component={AuctionReset} />
            <Route path="/tournament/:id/reports" component={Reports} />
            <Route path="/tournament/:id/links" component={LinksPage} />
            <Route path="/tournament/:id/fortune-wheel" component={FortuneWheel} />
            <Route path="/tournament/:id/break-timer" component={BreakTimerPage} />
            <Route path="/tournament/:id/local-mode" component={LocalModePage} />
            <Route path="/tournament/:id/settings" component={TournamentSettings} />
            <Route path="/tournament/:id">{() => <TournamentHome />}</Route>
          </Switch>
        </Suspense>
      </AppLayout>
    </OrganizerGuard>
  );
}

function PlatformRouter() {
  const [location] = useLocation();

  useEffect(() => {
    syncDocumentSurfaceTheme(location);
    return () => {
      // Ensure organizer/admin classes are removed when navigating away from PlatformApp
      syncDocumentSurfaceTheme(window.location.pathname);
    };
  }, [location]);

  const organizerShell = parseAuctionOrganizerShell(location);
  if (organizerShell) {
    return (
      <AuctionOrganizerShell
        tournamentId={organizerShell.tournamentId}
        requiredModule={organizerShell.requiredModule}
      />
    );
  }

  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Switch>
        <Route path="/dashboard">{() => <Redirect to="/organizer" />}</Route>
        <Route path="/tournament/new" component={NewTournament} />
        <Route path="/tournament/:id/login" component={OrganizerLogin} />
        <Route path="/live/:id" component={LiveViewer} />
        <Route path="/live" component={LegacyLiveRedirect} />
        <Route path="/tournament/:id/liveviewer" component={LiveViewer} />
        <Route path="/register/:code" component={PlayerRegister} />
        <Route path="/register">{() => <Redirect to="/upcoming-auctions" />}</Route>
        <Route path="/tournament/:id/register" component={PlayerRegisterLegacy} />
        <Route path="/tournament/:id/display" component={DisplayView} />
        <Route path="/tournament/:id/side-display" component={SideDisplayView} />
        <Route path="/tournament/:id/score-display" component={RedirectToScoringApp} />
        {/* SOLD Poster V2 design preview - standalone sandbox, not production */}
        <Route path="/poster-v2-preview" component={SoldPosterV2Preview} />
        <Route path="/preview-loader">
          {() => {
            const search = typeof window !== "undefined" ? window.location.search : "";
            const params = new URLSearchParams(search);
            const theme = (params.get("theme") as "dark" | "light" | "auto") || "auto";
            const label = params.get("label") ?? "Loading BidWar...";
            return <GlobalLoadingScreen theme={theme} label={label} />;
          }}
        </Route>

                {/* V2 Broadcast Overlays (Must precede legacy :matchId wildcard) */}
        <Route path="/tournament/:id/cricket/obs/v2/preview" component={CricketObsV2Preview} />
        <Route path="/tournament/:id/cricket/obs/v2" component={CricketObsV2Preview} />
        <Route path="/cricket/obs/v2/preview" component={CricketObsV2Preview} />
        <Route path="/cricket/obs/v2" component={CricketObsV2Preview} />
        {/* Royal Wedding Edition Cricket OBS Broadcast Overlays */}
        <Route path="/cricket/obs-wedding-preview" component={CricketObsWeddingPreview} />
        <Route path="/tournament/:id/cricket/obs/wedding/preview" component={CricketObsWedding} />
        <Route path="/tournament/:id/cricket/obs/wedding" component={CricketObsWedding} />
        <Route path="/cricket/obs/wedding/preview" component={CricketObsWedding} />
        <Route path="/cricket/obs/wedding" component={CricketObsWedding} />
        <Route path="/tournament/:id/obs/v2/preview" component={ObsV2OverlayPreview} />
        <Route path="/tournament/:id/obs/v2" component={ObsV2Overlay} />
        <Route path="/tournament/:id/obs/lab/preview" component={ObsLabOverlayPreview} />
        <Route path="/tournament/:id/obs/lab" component={ObsLabOverlay} />

        {/* Retired cricket OBS scorebug. Bookmarks open the V2 broadcast overlay. */}
        <Route path="/tournament/:id/cricket/obs/:matchId">
          {(params) => <Redirect to={`/tournament/${params?.id ?? "0"}/cricket/obs/v2`} />}
        </Route>
        <Route path="/tournament/:id/obs/preview">
          {(params) => (
            <LegacyObsRedirect tournamentId={params?.id ?? "0"} preview />
          )}
        </Route>
        <Route path="/tournament/:id/obs">
          {(params) => <LegacyObsRedirect tournamentId={params?.id ?? "0"} />}
        </Route>

        {/* Scoring — redirect legacy URLs to external scoring app */}
        <Route path="/badminton/scorer" component={RedirectToScoringApp} />
        <Route path="/badminton/standings" component={RedirectToScoringApp} />
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
        <Route path="/admin/events-activities" component={AdminEventsActivities} />
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
        <Route path="/admin/bpl" component={AdminBplEditions} />
        <Route path="/admin/bpl/editions" component={AdminBplEditions} />
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
        <Route path="/admin/tournaments/:id/live/endpoints" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/displays" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/owner-apps" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/sessions" component={AdminTournamentDetail} />
        <Route path="/admin/tournaments/:id/live/emergency" component={AdminTournamentDetail} />
        <Route path="/admin/organisers" component={AdminOrganisersList} />
        <Route path="/admin/organisers/:id" component={AdminOrganiserDetail} />
        <Route path="/admin/members" component={AdminMembersList} />
        <Route path="/admin/members/:id" component={AdminMembersList} />
        <Route path="/admin/settings/reports" component={AdminReports} />
        <Route path="/admin/settings/intelligence" component={AdminIntelligence} />
        <Route path="/admin/settings/intelligence/:tab" component={AdminIntelligence} />
        <Route path="/admin/communication/:tab" component={AdminCommunicationCenter} />
        <Route path="/admin/communication" component={AdminCommunicationCenter} />
        <Route path="/admin/settings/communication/logs">{() => <Redirect to="/admin/communication/logs" />}</Route>
        <Route path="/admin/settings/communication/:tab">{(params) => <Redirect to={`/admin/communication/${params?.tab || "sms"}`} />}</Route>
        <Route path="/admin/settings/communication">{() => <Redirect to="/admin/communication/sms" />}</Route>
        <Route path="/admin/notifications" component={AdminAdminNotifications} />
        <Route path="/admin/settings/admin-notifications" component={AdminAdminNotificationSettings} />
        <Route path="/admin/settings/notifications">{() => <Redirect to="/admin/communication" />}</Route>
        <Route path="/admin/settings/branding" component={AdminBranding} />
        <Route path="/admin/settings/branding/:tab" component={AdminBranding} />
        <Route path="/admin/knowledge-center/academy/new" component={AdminAcademyLessonForm} />
        <Route path="/admin/knowledge-center/academy/:id" component={AdminAcademyLessonForm} />
        <Route path="/admin/knowledge-center/academy" component={AdminAcademyLessonsList} />
        <Route path="/admin/settings/system/diagnostics" component={AdminSystemPage} />
        <Route path="/admin/settings/system/audit-logs" component={AdminSystemPage} />
        <Route path="/admin/settings/system/clients" component={AdminSystemPage} />
        <Route path="/admin/settings/system/sms" component={AdminSystemPage} />
        <Route path="/admin/settings/system/session-lock" component={AdminSystemPage} />
        <Route path="/admin/settings/system/installer" component={AdminSystemPage} />
        <Route path="/admin/settings/system/builds" component={AdminSystemPage} />
        <Route path="/admin/settings/system/default-audio" component={AdminSystemPage} />
        <Route path="/admin/settings/system/upcoming-display" component={AdminSystemPage} />
        <Route path="/admin/settings/system/showcase" component={AdminSystemPage} />
        <Route path="/admin/settings/system/search-console" component={AdminSystemPage} />
        <Route path="/admin/clients">{() => <Redirect to="/admin/settings/system/clients" />}</Route>
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

        {/* Canonical public tournament redirects (prevents 404 on plural /tournaments/ links) */}
        <Route path="/tournaments/:id/schedule">
          {(params) => <Redirect to={`/tournament/${params?.id}/cricket/matches`} />}
        </Route>
        <Route path="/tournaments/:id/standings">
          {(params) => <Redirect to={`/tournament/${params?.id}/cricket/standings`} />}
        </Route>
        <Route path="/tournaments/:id">
          {(params) => <Redirect to={`/tournament/${params?.id}/fan`} />}
        </Route>

        {/* Auction Control stays outside the persistent organiser shell. */}
        <Route path="/tournament/:id/auction">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid} requiredModule="auction"><AuctionOperator /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/team-reports">
          {(params) => <Redirect to={`/tournament/${params?.id ?? "0"}/reports?doc=planning`} />}
        </Route>
        {/* Sports Mission Control — temporary host under scoring-app */}
        <Route path="/tournament/:id/mission-control">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid} requiredModule="scoring"><RedirectToScoringApp /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/cricket/match/:matchId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/player/:playerId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/team/:teamId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/matches" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/standings" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/teams" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/players" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/statistics" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/cricket/sponsors" component={RedirectToScoringApp} />
        <Route path="/cricket/leaderboards" component={RedirectToScoringApp} />
        <Route path="/player/:globalPlayerId" component={RedirectToScoringApp} />
        <Route path="/cricket/scorer" component={RedirectToScoringApp} />
        <Route path="/cricket/:matchId/score" component={RedirectToScoringApp} />
        <Route path="/:code/fanpage" component={RedirectToScoringApp} />
        <Route path="/fan/:id" component={RedirectToScoringApp} />
        <Route path="/fanpage/:id" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/fan">
          {(params) => <UnifiedFanPage routeIdentifier={params?.id} />}
        </Route>
        <Route path="/tournament/:id/cricket" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/dashboard" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/settings" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/rules" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/teams" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/players" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/fixtures" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/standings" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/stats" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/officials" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/awards" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/reports" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/schedule" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/live-control" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/links" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/:matchId/live" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score/:matchId" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/score">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid} requiredModule="scoring"><RedirectToScoringApp /></OrganizerGuard>;
          }}
        </Route>
        <Route path="/tournament/:id/badminton/players" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/matches/:matchId/control" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/matches" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/courts" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/scorers" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/categories" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/fixtures" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/schedule" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/control" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/results" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/summary" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/scoring-format" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/analytics" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/branding" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton/broadcast" component={RedirectToScoringApp} />
        <Route path="/tournament/:id/badminton">
          {(params) => {
            const tid = parseInt(params?.id || "0");
            return <OrganizerGuard tournamentId={tid} requiredModule="scoring"><RedirectToScoringApp /></OrganizerGuard>;
          }}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PlatformApp() {
  return (
    <TooltipProvider>
      <AdminPwaProvider>
        <LocalOperatorPinEffects />
        <LocalVenueGate>
          <PlatformRouter />
        </LocalVenueGate>
      </AdminPwaProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default PlatformApp;
