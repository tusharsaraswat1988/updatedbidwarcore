/**
 * Corporate Match Center — single operational page for one match.
 * Route: /tournament/:id/score/:matchId
 *
 * Live Control (scorer) remains at /tournament/:id/score/:matchId/live
 * Reuses: MatchSummaryCard, ScorecardView, ShareButtons, scoring APIs.
 */
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { buildCricketMatchSummary } from "@workspace/scoring-core";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { ScorecardView } from "@/components/scoring/scorecard-view";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatch } from "@/hooks/use-scoring-match";
import {
  getCricketMasterTeams,
  getPublicMatchScorecard,
  isTerminalCricketMatchStatus,
} from "@/lib/scoring-api";
import { getMatchSquads, listOfficials, type MatchSquadJson } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import {
  buildMatchStatSnapshots,
  buildMatchTimeline,
  currentRunRate,
  formatInningsScore,
  matchDurationLabel,
} from "@/lib/cricket-match-center";
import {
  cricketDashboardPath,
  cricketLiveControlPath,
  cricketScoreHubPath,
} from "@/lib/cricket-routes";
import {
  cricketMatchPublicPath,
  cricketObsLivePath,
  cricketObsMatchPath,
  cricketPublicPath,
  openScoreDisplay,
  scoreDisplayPath,
} from "@/lib/tournament-navigation";
import { sportsMissionControlPath } from "@workspace/api-base/scoring-urls";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Monitor,
  Printer,
  Radio,
  Trophy,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketMatchCenterPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data, isLoading, isError, error, refetch, isFetching } = useScoringMatch(
    tournamentId,
    matchId,
    scoringActive,
  );

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: scorecard } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId),
    enabled: scoringActive && !!tournamentId && !!matchId,
    refetchInterval: data?.match.status === "live" ? 10000 : false,
  });
  const { data: squads } = useQuery({
    queryKey: ["scoring-match-squads", tournamentId, matchId],
    queryFn: () => getMatchSquads(tournamentId, matchId),
    enabled: scoringActive && !!tournamentId && !!matchId,
  });
  const { data: officials } = useQuery({
    queryKey: ["scoring-officials", tournamentId],
    queryFn: () => listOfficials(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const playerName = (id: number) =>
    scorecard?.players[String(id)] ?? `Player ${id}`;

  const home = data ? teamMap.get(data.match.homeTeamId) : undefined;
  const away = data ? teamMap.get(data.match.awayTeamId) : undefined;
  const state = data?.state;
  const isLive = data?.match.status === "live";
  const isFinished = data ? isTerminalCricketMatchStatus(data.match.status) : false;

  const summary = useMemo(() => {
    if (!data) return null;
    return (
      data.summary ??
      (isFinished || data.state.matchStatus === "live"
        ? buildCricketMatchSummary(data.state)
        : null)
    );
  }, [data, isFinished]);

  const homeScore = state ? formatInningsScore(state, state.homeTeamId) : null;
  const awayScore = state ? formatInningsScore(state, state.awayTeamId) : null;
  const rr = state ? currentRunRate(state) : null;

  const timeline = useMemo(() => {
    if (!data || !state) return [];
    return buildMatchTimeline({
      match: data.match,
      state,
      scorecard: scorecard ?? null,
      teamName: (id) => teamMap.get(id)?.shortCode ?? teamMap.get(id)?.name ?? `Team ${id}`,
      playerName: (id) => scorecard?.players[String(id)] ?? `Player ${id}`,
    });
  }, [data, state, scorecard, teamMap]);

  const stats = useMemo(
    () => buildMatchStatSnapshots(scorecard ?? null),
    [scorecard],
  );

  const duration = matchDurationLabel(
    data?.match.startedAt ?? null,
    data?.match.completedAt ?? null,
  );

  const captainLabel = (teamId: number) => {
    const rows = (
      squads as { squads?: Array<{ teamId: number; squadJson?: MatchSquadJson }> } | undefined
    )?.squads;
    const row = rows?.find((s) => s.teamId === teamId);
    const captainId = row?.squadJson?.captainId;
    if (!captainId) return null;
    return playerName(captainId);
  };

  const publicMatchUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cricketMatchPublicPath(tournamentId, matchId)}`
      : cricketMatchPublicPath(tournamentId, matchId);

  const liveHref = cricketLiveControlPath(tournamentId, matchId);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (tournamentLoading || (scoringActive && isLoading && !data)) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (!scoringActive) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament, then return here."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (isError && !data) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Could not load match"
            desc={error instanceof Error ? error.message : "Something went wrong."}
            action={{ label: "Retry", onClick: () => void refetch() }}
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (!data || !state) return null;

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Match Center"
        title={`${home?.shortCode ?? "Home"} vs ${away?.shortCode ?? "Away"}`}
        subtitle={tournament?.name}
        badge={isLive ? "LIVE" : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <BtnPrimary href={liveHref} className={btnCompactClass}>
              <Radio className="w-4 h-4" />
              Open Live Control
            </BtnPrimary>
            <BtnSecondary
              className={btnCompactClass}
              onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
            >
              <Monitor className="w-4 h-4" />
              LED
            </BtnSecondary>
            <BtnSecondary
              className={btnCompactClass}
              onClick={() =>
                window.open(
                  cricketObsLivePath(tournamentId, tournament?.auctionCode),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <Tv className="w-4 h-4" />
              Cricket OBS
            </BtnSecondary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {/* Header meta */}
        <section className={cn(hubPanelClass, "flex flex-wrap gap-x-4 gap-y-2 text-sm")}>
          <MetaChip label="Status" value={data.match.status} emphasize={isLive} />
          {tournament?.name ? <MetaChip label="Tournament" value={tournament.name} /> : null}
          {tournament?.sport ? <MetaChip label="Competition" value={tournament.sport} /> : null}
          {data.match.roundName ? <MetaChip label="Round" value={data.match.roundName} /> : null}
          {data.match.venue ? <MetaChip label="Ground" value={data.match.venue} /> : null}
          {data.match.scheduledAt ? (
            <MetaChip
              label="Time"
              value={new Date(data.match.scheduledAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
          ) : null}
          <MetaChip label="Match #" value={String(data.match.id)} />
          {(officials?.length ?? 0) > 0 ? (
            <MetaChip
              label="Officials"
              value={(officials ?? [])
                .slice(0, 3)
                .map((o) => o.name)
                .join(", ")}
            />
          ) : null}
          {isFetching ? (
            <span className="text-xs text-muted-foreground self-center">Updating…</span>
          ) : null}
        </section>

        {/* Teams + score */}
        <section className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <TeamPanel
            name={home?.name ?? "Home"}
            shortCode={home?.shortCode ?? "H"}
            logoUrl={home?.logoUrl}
            color={home?.color}
            score={homeScore}
            captain={captainLabel(data.match.homeTeamId)}
          />
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              vs
            </span>
            {rr != null ? (
              <span className="text-xs text-muted-foreground tabular-nums">CRR {rr.toFixed(2)}</span>
            ) : null}
            {state.target != null ? (
              <span className="text-xs font-semibold text-primary">Target {state.target}</span>
            ) : null}
          </div>
          <TeamPanel
            name={away?.name ?? "Away"}
            shortCode={away?.shortCode ?? "A"}
            logoUrl={away?.logoUrl}
            color={away?.color}
            score={awayScore}
            captain={captainLabel(data.match.awayTeamId)}
          />
        </section>

        {/* Quick actions */}
        <section>
          <HubSectionHeader title="Quick actions" subtitle="Everything you need for this match" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
            <ActionLink href={liveHref} label="Live Control" icon={Radio} primary />
            <ActionLink
              href={scoreDisplayPath(tournamentId, tournament?.auctionCode)}
              label="LED / Scoreboard"
              icon={Monitor}
              external
            />
            <ActionLink
              href={cricketObsLivePath(tournamentId, tournament?.auctionCode)}
              label="Cricket OBS"
              icon={Tv}
              external
            />
            <ActionLink
              href={cricketObsMatchPath(tournamentId, matchId, tournament?.auctionCode)}
              label="Cricket OBS (this match)"
              icon={Tv}
              external
            />
            <ActionLink
              href={cricketMatchPublicPath(tournamentId, matchId)}
              label="Public Match"
              icon={ExternalLink}
              external
            />
            <ActionLink
              href={cricketPublicPath(tournamentId)}
              label="Public Tournament"
              icon={Trophy}
              external
            />
            <button
              type="button"
              onClick={() => window.print()}
              className={cn(hubPanelClass, "text-left text-sm font-semibold hover:border-primary/30 flex items-center gap-2")}
            >
              <Printer className="w-4 h-4 text-primary shrink-0" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => {
                const a = document.createElement("a");
                a.href = cricketMatchPublicPath(tournamentId, matchId);
                a.target = "_blank";
                a.rel = "noopener";
                a.click();
              }}
              className={cn(hubPanelClass, "text-left text-sm font-semibold hover:border-primary/30 flex items-center gap-2")}
            >
              <Download className="w-4 h-4 text-primary shrink-0" />
              Scorecard
            </button>
            <Link
              href={sportsMissionControlPath(tournamentId)}
              className={cn(hubPanelClass, "text-sm font-semibold hover:border-primary/30 flex items-center gap-2")}
            >
              Tournament Dashboard
            </Link>
            <Link
              href={cricketDashboardPath(tournamentId)}
              className={cn(hubPanelClass, "text-sm font-semibold hover:border-primary/30 flex items-center gap-2")}
            >
              Dashboard
            </Link>
          </div>
          <div className="mt-3">
            <ShareButtons
              url={publicMatchUrl}
              shareText={`${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
            />
          </div>
        </section>

        {/* Timeline */}
        <section>
          <HubSectionHeader title="Timeline" subtitle="From existing match state and scorecard" />
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">
              Timeline fills as toss, XI, and balls are recorded in Live Control.
            </p>
          ) : (
            <ol className="mt-3 space-y-2 border-l border-border ml-2 pl-4">
              {timeline.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  {item.detail ? (
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  ) : null}
                  {item.at ? (
                    <p className="text-[11px] text-muted-foreground/80">
                      {new Date(item.at).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Live scorecard — reuse ScorecardView */}
        <section className="print:break-before-page">
          <HubSectionHeader title="Scorecard" subtitle="Same projection as the public scorecard" />
          <div className="mt-3">
            {scorecard ? (
              <ScorecardView data={scorecard} tournamentId={tournamentId} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Scorecard appears once scoring has started.
              </p>
            )}
          </div>
        </section>

        {/* Match summary — reuse MatchSummaryCard */}
        {summary ? (
          <section>
            <HubSectionHeader title="Match summary" />
            <div className="mt-3 space-y-3">
              <MatchSummaryCard summary={summary} teams={teams} />
              <div className={cn(hubPanelClass, "grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm")}>
                {scorecard?.manOfTheMatch ? (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Player of Match</p>
                    <p className="font-semibold">{scorecard.manOfTheMatch.playerName}</p>
                  </div>
                ) : null}
                {duration ? (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className="font-semibold">{duration}</p>
                  </div>
                ) : null}
                {(officials?.length ?? 0) > 0 ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Officials</p>
                    <p className="font-semibold">
                      {(officials ?? []).map((o) => `${o.name} (${o.role})`).join(" · ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Stats snapshot from this match scorecard */}
        {stats.length > 0 ? (
          <section>
            <HubSectionHeader title="Statistics snapshot" subtitle="From this match scorecard" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
              {stats.map((s) => (
                <div key={s.label} className={cn(hubCardClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-semibold truncate mt-1">{s.playerName}</p>
                  <p className="text-lg font-display font-bold text-primary tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Downloads + public links */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <HubSectionHeader title="Downloads" />
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => window.print()}
                >
                  Print / save PDF scorecard
                </button>
              </li>
              <li>
                <a
                  href={cricketMatchPublicPath(tournamentId, matchId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold hover:underline"
                >
                  Open public scorecard (print from there)
                </a>
              </li>
            </ul>
          </div>
          <div>
            <HubSectionHeader title="Public links" />
            <ul className="mt-3 space-y-2 text-sm break-all">
              <li>
                <span className="text-muted-foreground">Match: </span>
                <a
                  href={cricketMatchPublicPath(tournamentId, matchId)}
                  className="text-primary font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cricketMatchPublicPath(tournamentId, matchId)}
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">Tournament: </span>
                <a
                  href={cricketPublicPath(tournamentId)}
                  className="text-primary font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cricketPublicPath(tournamentId)}
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 text-sm print:hidden">
          <Link href={cricketScoreHubPath(tournamentId)} className="text-primary font-semibold">
            ← All matches
          </Link>
          <Link href={cricketDashboardPath(tournamentId)} className="text-muted-foreground">
            Dashboard
          </Link>
        </div>
      </div>
    </CricketOrganizerPageShell>
  );
}

function MetaChip({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
      {emphasize ? (
        <Badge variant="destructive" className="capitalize">
          {value}
        </Badge>
      ) : (
        <span className="font-medium capitalize truncate">{value}</span>
      )}
    </div>
  );
}

function TeamPanel({
  name,
  shortCode,
  logoUrl,
  color,
  score,
  captain,
}: {
  name: string;
  shortCode: string;
  logoUrl?: string | null;
  color?: string | null;
  score: { runs: number; wickets: number; overs: string } | null;
  captain: string | null;
}) {
  return (
    <div className={cn(hubCardClass, "p-4 space-y-2")}>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain bg-white/5" />
        ) : (
          <span
            className="h-10 w-10 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: color ? `${color}33` : undefined }}
          >
            {shortCode.slice(0, 3)}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-display font-bold truncate">{name}</p>
          {captain ? (
            <p className="text-xs text-muted-foreground truncate">Captain · {captain}</p>
          ) : null}
        </div>
      </div>
      {score ? (
        <p className="text-2xl font-display font-bold tabular-nums">
          {score.runs}/{score.wickets}{" "}
          <span className="text-sm font-normal text-muted-foreground">({score.overs} ov)</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Yet to bat</p>
      )}
    </div>
  );
}

function ActionLink({
  href,
  label,
  icon: Icon,
  external,
  primary,
}: {
  href: string;
  label: string;
  icon: typeof Radio;
  external?: boolean;
  primary?: boolean;
}) {
  const className = cn(
    hubPanelClass,
    "text-sm font-semibold hover:border-primary/30 flex items-center gap-2",
    primary && "border-primary/40 bg-primary/5",
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <Icon className="w-4 h-4 text-primary shrink-0" />
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <Icon className="w-4 h-4 text-primary shrink-0" />
      {label}
    </Link>
  );
}
