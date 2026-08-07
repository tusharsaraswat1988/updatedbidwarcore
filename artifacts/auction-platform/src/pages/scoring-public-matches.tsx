import { useMemo, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringLive } from "@/lib/scoring-api";
import { PublicMatchCard } from "@/components/scoring/public-match-card";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import { CricketFilterPill, cricketSectionTitleClass } from "@/components/scoring/cricket-page-chrome";
import type { PublicSchedulePayload, PublicTeam } from "@/lib/public-tournament-types";
import { partitionMatches } from "@/lib/public-tournament-utils";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "live" | "today" | "upcoming" | "completed";

export default function ScoringPublicMatchesPage() {
  const [, params] = useRoute("/tournament/:id/cricket/matches");
  const tournamentId = parseInt(params?.id || "0");
  const searchString = useSearch();
  const initialFilter = (() => {
    const f = new URLSearchParams(searchString).get("filter");
    if (f === "live" || f === "today" || f === "upcoming" || f === "completed") return f;
    return "all" as FilterKey;
  })();
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (q) => {
      const hasLive = (q.state.data?.matches ?? []).some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { live, upcoming, completed, today } = partitionMatches(data?.matches ?? []);
  const primaryLiveId = live[0]?.id ?? null;

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

  const liveScoreline = (() => {
    if (!liveDisplay?.state) return null;
    const state = liveDisplay.state as Record<string, unknown>;
    const runs = state.runs ?? state.totalRuns;
    const wickets = state.wickets ?? state.totalWickets;
    const overs = state.overs ?? state.oversBowled;
    if (runs == null) return null;
    const wk = wickets != null ? `/${wickets}` : "";
    const ov = overs != null ? ` (${overs})` : "";
    return `${runs}${wk}${ov}`;
  })();

  const filtered = useMemo(() => {
    let list = data?.matches ?? [];
    if (filter === "live") list = live;
    else if (filter === "today") list = today;
    else if (filter === "upcoming") list = upcoming;
    else if (filter === "completed") list = completed;

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      const home = teamMap.get(m.homeTeamId);
      const away = teamMap.get(m.awayTeamId);
      const hay = [
        home?.name,
        home?.shortCode,
        away?.name,
        away?.shortCode,
        m.roundName,
        m.venue,
        m.resultSummary,
        m.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.matches, filter, query, live, today, upcoming, completed, teamMap]);

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Matches not available." />;
  }

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: data.matches.length },
    { key: "live", label: "Live", count: live.length },
    { key: "today", label: "Today", count: today.length },
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={primaryLiveId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Match browser</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{data.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">Live, upcoming, and completed fixtures.</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <CricketFilterPill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
            <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
          </CricketFilterPill>
        ))}
      </div>

      <label className="relative block mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams, rounds, venues…"
          className="w-full rounded-xl border border-border bg-card/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
        />
      </label>

      {live.length > 0 && filter !== "live" ? (
        <section className="mb-8">
          <h2 className={cn(cricketSectionTitleClass, "mb-3 text-emerald-400")}>Live now</h2>
          <ul className="space-y-2">
            {live.map((m) => (
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
        </section>
      ) : null}

      <section>
        <h2 className={cn(cricketSectionTitleClass, "mb-3")}>
          {filter === "all" ? "All matches" : filters.find((f) => f.key === filter)?.label}
        </h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches match this filter.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((m) => (
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
    </CricketFanExperienceShell>
  );
}
