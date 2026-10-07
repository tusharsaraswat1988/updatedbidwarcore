import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CircleDot,
  MapPin,
  CalendarDays,
  Layers,
  Trophy,
  Tv,
  Flame,
  MessageCircle,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { useListPlayers } from "@workspace/api-client-react";
import {
  getPublicMatchScorecard,
  getScoringLeaderboard,
  getScoringLive,
  getScoringStandings,
  listScoringAwards,
} from "@/lib/scoring-api";
import { StandingsTable } from "@/components/scoring/standings-table";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { PublicMatchCard } from "@/components/scoring/public-match-card";
import { PublicSponsorsStrip, parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import { LiveMiniScoreboard } from "@/components/scoring/live-mini-scoreboard";
import {
  FanCheerFloatingWidget,
  FanArenaSection,
  useFanCheerState,
} from "@/components/scoring/fan-cheer-chat";
import {
  TournamentFanHeader,
  type TournamentSectionTab,
} from "@/components/scoring/tournament-fan-header";
import { TournamentBracketTree } from "@/components/scoring/tournament-bracket-tree";
import {
  competitionGroupTitle,
  isMultiDrawCompetition,
  rowsForCompetitionSelection,
} from "@workspace/scoring-core/cricket";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import {
  cricketCardClass,
  cricketEyebrowClass,
  cricketSectionTitleClass,
  CricketFilterPill,
} from "@/components/scoring/cricket-page-chrome";
import {
  cricketFanMatchesPath,
  cricketFanStandingsPath,
  cricketFanStatisticsPath,
  cricketFanMatchPath,
  cricketPublicPath,
} from "@/lib/tournament-navigation";
import type { PublicSchedulePayload, PublicTeam } from "@/lib/public-tournament-types";
import {
  currentStageFromDraws,
  formatDateRange,
  partitionMatches,
  tournamentStageLabel,
  venueLabel,
} from "@/lib/public-tournament-utils";
import { cn } from "@/lib/utils";
import type { LeaderboardCategory, CricketScoreboardState } from "@workspace/scoring-core";

const LEADERBOARD_TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "strike_rate", label: "SR", valueLabel: "SR" },
  { key: "economy", label: "Econ", valueLabel: "Econ" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

export default function ScoringPublicPage() {
  const [, paramsShort1] = useRoute("/:code/fanpage");
  const [, paramsFanId] = useRoute("/fan/:id");
  const [, paramsFanpageId] = useRoute("/fanpage/:id");
  const [, paramsTournFan] = useRoute("/tournament/:id/fan");
  const [, paramsTournCricket] = useRoute("/tournament/:id/cricket");

  const rawParam =
    paramsShort1?.code ||
    paramsFanId?.id ||
    paramsFanpageId?.id ||
    paramsTournFan?.id ||
    paramsTournCricket?.id ||
    "0";

  const isNumeric = /^\d+$/.test(rawParam);
  const numericId = isNumeric ? parseInt(rawParam, 10) : 0;

  const { data: codeContext } = useQuery({
    queryKey: ["tournament-code-context", rawParam],
    queryFn: async () => {
      const res = await fetch(`/api/register/${encodeURIComponent(rawParam)}/context`);
      if (!res.ok) return null;
      return (await res.json()) as { tournament: { id: number; name: string } };
    },
    enabled: !isNumeric && !!rawParam && rawParam !== "0",
  });

  const tournamentId = numericId || codeContext?.tournament?.id || 0;
  const { data: playersData } = useListPlayers(tournamentId);

  const [lbTab, setLbTab] = useState<LeaderboardCategory>("runs");
  const [standingsView, setStandingsView] = useState<"table" | "bracket">("table");
  const [activeSection, setActiveSection] = useState<TournamentSectionTab>("live");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (query) => {
      const matches = query.state.data?.matches ?? [];
      const hasLive = matches.some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, lbTab],
    queryFn: () => getScoringLeaderboard(tournamentId, lbTab, 8),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: awards } = useQuery({
    queryKey: ["scoring-awards", tournamentId],
    queryFn: () => listScoringAwards(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 60000,
  });

  const liveMatches = (data?.matches ?? []).filter((m) => m.status === "live");
  const primaryLiveId = liveMatches[0]?.id ?? null;

  const { data: liveDisplay } = useQuery({
    queryKey: ["scoring-live", tournamentId],
    queryFn: () => getScoringLive(tournamentId),
    enabled: !!tournamentId && primaryLiveId != null,
    refetchInterval: 8000,
  });

  const { data: liveScorecard } = useQuery({
    queryKey: ["scoring-scorecard-live", tournamentId, primaryLiveId],
    queryFn: () => getPublicMatchScorecard(tournamentId, primaryLiveId!),
    enabled: !!tournamentId && primaryLiveId != null,
    refetchInterval: 10000,
  });

  const teamMap = useMemo(
    () => new Map(((data?.teams ?? []) as PublicTeam[]).map((t) => [t.id, t])),
    [data?.teams],
  );

  const { live, upcoming, completed, today } = partitionMatches(data?.matches ?? []);
  const sponsors = parseTournamentSponsors(data?.tournament?.sponsorLogos);
  const stage =
    currentStageFromDraws(data?.draws ?? [], live[0]?.roundName) ??
    tournamentStageLabel(data?.tournament ?? { id: 0, name: "", sport: "cricket", scoringEnabled: true });
  const dates = formatDateRange(data?.tournament?.matchDates);
  const venue = data?.tournament ? venueLabel(data.tournament) : null;
  const standingsGroups = standings?.groups ?? [];
  const standingsRows = standings ?? [];
  const multiDraw = isMultiDrawCompetition(standingsGroups, standingsRows);
  const hasGroupStandings = standingsGroups.length > 0;
  const legacyBand = rowsForCompetitionSelection(standingsGroups, standingsRows, { kind: "all" });
  const top4 = legacyBand.qualifiers > 0 ? legacyBand.rows.slice(0, legacyBand.qualifiers) : [];
  const activeLb = LEADERBOARD_TABS.find((t) => t.key === lbTab);

  // Live streaming destination URL — NEVER fallback to OBS; only direct link if provided by organizer
  const streamUrl = useMemo(() => {
    const direct =
      live[0]?.streamUrl ||
      data?.tournament?.streamUrl ||
      data?.tournament?.liveStreamUrl;
    return direct && typeof direct === "string" && direct.trim().length > 0
      ? direct.trim()
      : null;
  }, [live, data?.tournament]);

  // Active teams for Fan Battle Heat Meter
  const activeMatchTeams = useMemo(() => {
    if (!live[0]) return null;
    return {
      homeTeamId: live[0].homeTeamId,
      awayTeamId: live[0].awayTeamId,
    };
  }, [live]);

  // Shared Fan Cheer State (Overlay on all sections + Fan Arena view)
  const cheerState = useFanCheerState(tournamentId, data?.teams ?? [], activeMatchTeams);

  const liveScoreline = (() => {
    if (!liveDisplay?.state || !primaryLiveId) return null;
    const state = liveDisplay.state as Record<string, unknown>;
    const runs = state.runs ?? state.totalRuns;
    const wickets = state.wickets ?? state.totalWickets;
    const overs = state.overs ?? state.oversBowled;
    if (runs == null) return null;
    const wk = wickets != null ? `/${wickets}` : "";
    const ov = overs != null ? ` (${overs})` : "";
    return `${runs}${wk}${ov}`;
  })();

  const announcements = useMemo(() => {
    const items: Array<{ title: string; detail: string; href?: string }> = [];
    if (live[0]) {
      const home = teamMap.get(live[0].homeTeamId)?.name ?? "Home";
      const away = teamMap.get(live[0].awayTeamId)?.name ?? "Away";
      items.push({
        title: "Live now",
        detail: `${home} vs ${away}`,
        href: cricketFanMatchPath(tournamentId, live[0].id),
      });
    }
    if (stage) {
      items.push({ title: "Current stage", detail: stage });
    }
    for (const award of (awards ?? []).slice(0, 3)) {
      items.push({
        title: award.awardType === "man_of_the_match" ? "Man of the Match" : award.awardType,
        detail: `${award.playerName} · ${award.teamName}${award.reason ? ` — ${award.reason}` : ""}`,
        href: cricketFanMatchPath(tournamentId, award.matchId),
      });
    }
    return items;
  }, [live, stage, awards, teamMap, tournamentId]);

  const pageUrl =
    typeof window !== "undefined" ? `${window.location.origin}${cricketPublicPath(tournamentId)}` : "";
  const shareTitle = data?.tournament?.name ?? "Cricket tournament";

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Tournament scoring not available." />;
  }

  const t = data.tournament;
  const showBanner = Boolean(t.mainBannerEnabled && t.mainBannerUrl);

  return (
    <CricketFanExperienceShell
      tournamentId={tournamentId}
      liveMatchId={primaryLiveId}
      streamUrl={streamUrl}
      hideNav={true}
    >
      {/* ── Permanent BidWar Header + Event Animations + 4 Top Sections ─ */}
      <TournamentFanHeader
        tournament={t}
        tournamentCode={!isNumeric ? rawParam : undefined}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        liveMatch={live[0]}
        liveState={(liveDisplay?.state as CricketScoreboardState | null) ?? null}
        teamMap={teamMap}
        liveCount={live.length}
        upcomingCount={upcoming.length}
        completedCount={completed.length}
        soundEnabled={cheerState.soundEnabled}
        onToggleSound={cheerState.toggleSound}
      />

      {/* ── Persistent Floating Cheer & Reaction Overlay (Common across ALL tabs) ─ */}
      <FanCheerFloatingWidget cheerState={cheerState} teams={data.teams} />

      <main className="space-y-8">
        {/* ============================================================== */}
        {/* SECTION 1: LIVE MATCH                                          */}
        {/* ============================================================== */}
        {activeSection === "live" && (
          <div className="space-y-6 animate-fade-in">
            {live[0] ? (
              <LiveMiniScoreboard
                tournamentId={tournamentId}
                match={live[0]}
                liveDisplay={liveDisplay}
                teamMap={teamMap}
                scorecardData={liveScorecard}
                streamUrl={streamUrl}
                tournamentPlayers={playersData}
              />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-white/70">
                <Calendar className="h-10 w-10 mx-auto text-emerald-400 mb-3 opacity-80" />
                <p className="font-bold text-base text-white">No match live right now</p>
                <p className="text-xs text-white/60 mt-1 max-w-md mx-auto">
                  There is no match currently in progress. Head over to Upcoming Matches & Stats to view full schedules and standings.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection("matches_stats")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  View Upcoming Matches & Stats <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 2: UPCOMING MATCH & STATS                              */}
        {/* ============================================================== */}
        {activeSection === "matches_stats" && (
          <div className="space-y-10 animate-fade-in">
            {/* Matches List */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className={cricketSectionTitleClass}>Today&apos;s & Upcoming Matches</h2>
                <Link
                  href={cricketFanMatchesPath(tournamentId)}
                  className="text-xs text-primary hover:underline"
                >
                  All fixtures
                </Link>
              </div>
              {today.length === 0 && upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming matches scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {(today.length > 0 ? today : upcoming.slice(0, 5)).map((m) => (
                    <li key={m.id}>
                      <PublicMatchCard
                        tournamentId={tournamentId}
                        match={m}
                        teamMap={teamMap}
                        liveScoreline={m.id === primaryLiveId ? liveScoreline : null}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Standings & Playoff Bracket Tree Switcher */}
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className={cricketSectionTitleClass}>Standings & Tournament Ladder</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Qualification race, NRR & championship playoff bracket
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={() => setStandingsView("table")}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                        standingsView === "table"
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Points Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setStandingsView("bracket")}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5",
                        standingsView === "bracket"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Trophy className="h-3 w-3" />
                      Playoff Bracket
                    </button>
                  </div>

                  <Link
                    href={cricketFanStandingsPath(tournamentId)}
                    className="text-xs text-primary hover:underline ml-2"
                  >
                    Full table
                  </Link>
                </div>
              </div>

              {standingsView === "table" ? (
                <>
                  {hasGroupStandings && standings?.groups ? (
                    <div className="space-y-4">
                      {standingsGroups.map((group) => (
                        <div key={group.id} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {competitionGroupTitle(group)} · top {group.qualifiersPerGroup ?? 2} qualify
                          </p>
                          <StandingsTable rows={group.rows} compact highlightTop={group.qualifiersPerGroup ?? 2} />
                        </div>
                      ))}
                    </div>
                  ) : top4.length > 0 ? (
                    <>
                      <StandingsTable rows={top4} compact highlightTop={4} />
                      {(standings?.length ?? 0) > 4 ? (
                        <p className="text-xs text-muted-foreground mt-2">
                          Positions 1–4 highlighted as the current qualification band.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No standings recorded yet.</p>
                  )}
                </>
              ) : (
                <TournamentBracketTree
                  tournamentId={tournamentId}
                  fixtures={data.fixtures}
                  matches={data.matches}
                  draws={data.draws}
                  teamMap={teamMap}
                  tournamentName={data.tournament.name}
                />
              )}
            </section>

            {/* Top Players Leaderboards */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className={cricketSectionTitleClass}>Tournament Leaderboards</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {multiDraw
                    ? "Tournament-wide runs, wickets, and sixes. Not a competition points table."
                    : "Tournament-wide batting and bowling totals."}
                </p>
                <Link
                  href={cricketFanStatisticsPath(tournamentId)}
                  className="text-xs text-primary hover:underline"
                >
                  Full stats
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {LEADERBOARD_TABS.map((tab) => (
                  <CricketFilterPill key={tab.key} active={lbTab === tab.key} onClick={() => setLbTab(tab.key)}>
                    {tab.label}
                  </CricketFilterPill>
                ))}
              </div>
              <LeaderboardTable
                rows={leaderboard ?? []}
                valueLabel={activeLb?.valueLabel}
                tournamentId={tournamentId}
              />
            </section>

            {/* Recent Completed Results */}
            {completed.length > 0 ? (
              <section>
                <div className="flex items-end justify-between gap-3 mb-3">
                  <h2 className={cricketSectionTitleClass}>Recent Results</h2>
                  <Link
                    href={`${cricketFanMatchesPath(tournamentId)}?filter=completed`}
                    className="text-xs text-primary hover:underline"
                  >
                    All results
                  </Link>
                </div>
                <ul className="space-y-2">
                  {completed.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      <PublicMatchCard tournamentId={tournamentId} match={m} teamMap={teamMap} compact />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Announcements */}
            {announcements.length > 0 ? (
              <section>
                <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Announcements</h2>
                <ul className="space-y-2">
                  {announcements.map((item, idx) => {
                    const content = (
                      <div className={cn(cricketCardClass, "px-4 py-3 bg-card/60")}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                          {item.title}
                        </p>
                        <p className="text-sm text-foreground mt-1">{item.detail}</p>
                      </div>
                    );
                    return (
                      <li key={`${item.title}-${idx}`}>
                        {item.href ? (
                          <Link href={item.href} className="block hover:opacity-95 transition-opacity">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 3: SPONSORS                                            */}
        {/* ============================================================== */}
        {activeSection === "sponsors" && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#121f17] to-[#0c1620] p-6 sm:p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Official Tournament Partners & Sponsors
                  </h3>
                  <p className="text-xs text-white/60">
                    Recognizing the organizations making this competition possible.
                  </p>
                </div>
              </div>

              {sponsors.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                  {sponsors.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/30 p-4 hover:border-amber-400/40 transition-colors"
                    >
                      {s.url ? (
                        <img
                          src={s.url}
                          alt={s.name || "Sponsor"}
                          className="h-14 max-w-full object-contain mb-2"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs text-white/60 mb-2">
                          {s.name?.slice(0, 2).toUpperCase() || "SP"}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-white/90 text-center truncate max-w-full">
                        {s.name || "Official Partner"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50 text-center py-8">
                  No sponsors configured for this tournament.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 4: FAN ARENA                                           */}
        {/* ============================================================== */}
        {activeSection === "fan_arena" && (
          <div className="animate-fade-in">
            <FanArenaSection cheerState={cheerState} teams={data.teams} />
          </div>
        )}
      </main>
    </CricketFanExperienceShell>
  );
}
