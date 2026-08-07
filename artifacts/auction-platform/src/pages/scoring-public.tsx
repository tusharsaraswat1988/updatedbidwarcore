import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CircleDot, MapPin, CalendarDays, Layers } from "lucide-react";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import {
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
  cricketFanTeamsPath,
  cricketFanPlayersPath,
  cricketFanSponsorsPath,
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
import type { LeaderboardCategory } from "@workspace/scoring-core";

const LEADERBOARD_TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "strike_rate", label: "SR", valueLabel: "SR" },
  { key: "economy", label: "Econ", valueLabel: "Econ" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

export default function ScoringPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket");
  const tournamentId = parseInt(params?.id || "0");
  const [lbTab, setLbTab] = useState<LeaderboardCategory>("runs");

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
  const top4 = (standings ?? []).slice(0, 4);
  const activeLb = LEADERBOARD_TABS.find((t) => t.key === lbTab);

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
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={primaryLiveId}>
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-[#0b1f17] via-[#10261c] to-[#0a1620]">
        {showBanner ? (
          <div className="absolute inset-0">
            <img
              src={t.mainBannerUrl!}
              alt=""
              className="h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a1620] via-[#0a1620]/70 to-transparent" />
          </div>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.25), transparent 50%), radial-gradient(ellipse at 90% 30%, rgba(234,179,8,0.12), transparent 40%)",
            }}
          />
        )}

        <div className="relative z-10 space-y-5 p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {t.logoUrl ? (
                <img
                  src={t.logoUrl}
                  alt=""
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-white/10 bg-black/30 shrink-0"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border border-emerald-400/20 bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-display font-bold text-emerald-300">
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <p className={cn(cricketEyebrowClass, "text-emerald-300/90")}>Corporate Box Cricket</p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white truncate">
                  {t.name}
                </h1>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 font-semibold uppercase tracking-wide text-emerald-300">
                    {tournamentStageLabel(t)}
                  </span>
                  {stage ? (
                    <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {stage}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {pageUrl ? (
              <ShareButtons
                url={pageUrl}
                shareText={`${shareTitle} — live scores, standings & stats`}
                compact
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/75">
            {venue ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-300" />
                {venue}
              </span>
            ) : null}
            {dates ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-emerald-300" />
                {dates}
              </span>
            ) : null}
          </div>

          {sponsors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/10">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Sponsored by</span>
              {sponsors.slice(0, 6).map((s, i) =>
                s.url ? (
                  <img
                    key={`${s.url}-${i}`}
                    src={s.url}
                    alt={s.name || "Sponsor"}
                    className="h-8 max-w-[100px] object-contain opacity-90"
                  />
                ) : null,
              )}
            </div>
          ) : null}

          {live[0] ? (
            <Link
              href={cricketFanMatchPath(tournamentId, live[0].id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 hover:bg-emerald-500/25 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                  Live match
                </p>
                <p className="text-white font-semibold truncate mt-0.5">
                  {teamMap.get(live[0].homeTeamId)?.name ?? "Home"} vs{" "}
                  {teamMap.get(live[0].awayTeamId)?.name ?? "Away"}
                </p>
                {liveScoreline ? (
                  <p className="text-emerald-200 text-sm tabular-nums mt-0.5">{liveScoreline}</p>
                ) : null}
              </div>
              <span className="text-xs font-semibold text-emerald-300 shrink-0">Open →</span>
            </Link>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: "Matches", href: cricketFanMatchesPath(tournamentId) },
              { label: "Standings", href: cricketFanStandingsPath(tournamentId) },
              { label: "Teams", href: cricketFanTeamsPath(tournamentId) },
              { label: "Players", href: cricketFanPlayersPath(tournamentId) },
              { label: "Statistics", href: cricketFanStatisticsPath(tournamentId) },
              { label: "Sponsors", href: cricketFanSponsorsPath(tournamentId) },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="space-y-10">
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 className={cricketSectionTitleClass}>Today&apos;s matches</h2>
            <Link
              href={cricketFanMatchesPath(tournamentId)}
              className="text-xs text-primary hover:underline"
            >
              All matches
            </Link>
          </div>
          {today.length === 0 && live.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches scheduled for today.</p>
          ) : (
            <ul className="space-y-2">
              {(today.length > 0 ? today : [...live, ...upcoming.slice(0, 4)]).map((m) => (
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
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              <span className="text-emerald-400 font-semibold">{live.length}</span> live
            </span>
            <span>
              <span className="text-sky-300 font-semibold">{upcoming.length}</span> upcoming
            </span>
            <span>
              <span className="font-semibold text-foreground/80">{completed.length}</span> completed
            </span>
          </div>
        </section>

        {top4.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className={cricketSectionTitleClass}>Standings</h2>
                <p className="text-xs text-muted-foreground mt-1">Top 4 · qualification race · NRR</p>
              </div>
              <Link
                href={cricketFanStandingsPath(tournamentId)}
                className="text-xs text-primary hover:underline"
              >
                Full table
              </Link>
            </div>
            <StandingsTable rows={top4} compact highlightTop={4} />
            {(standings?.length ?? 0) > 4 ? (
              <p className="text-xs text-muted-foreground mt-2">
                Positions 1–4 highlighted as the current qualification band.
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 className={cricketSectionTitleClass}>Top players</h2>
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

        {completed.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <h2 className={cricketSectionTitleClass}>Recent results</h2>
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

        <PublicSponsorsStrip sponsors={sponsors} title="Sponsors" />
      </main>
    </CricketFanExperienceShell>
  );
}
