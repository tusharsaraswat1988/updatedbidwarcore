import React, { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Trophy, Calendar, ListOrdered } from "lucide-react";
import { useFanScoringEvents, type FanScoringConnection } from "@/lib/api/use-fan-scoring-events";

type Team = { id: number; name: string; shortCode?: string };
type PublicMatch = {
  id: number;
  status?: string;
  homeTeamId?: number;
  awayTeamId?: number;
  scheduledAt?: string | null;
  resultSummary?: string | null;
  roundName?: string | null;
  tournamentMatchNumber?: number | null;
};
type Schedule = { teams?: Team[]; matches?: PublicMatch[] };
type StandingRow = {
  teamId?: number;
  teamName?: string;
  played?: number;
  won?: number;
  lost?: number;
  tied?: number;
  noResult?: number;
  points?: number;
  netRunRate?: number | string;
};
type LeaderRow = { rank?: number; playerName?: string; teamName?: string; value?: number };
type BattingRow = {
  playerId: number;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  notOut?: boolean;
  dismissalType?: string | null;
};
type BowlingRow = {
  playerId: number;
  overs?: string;
  maidens?: number;
  runs?: number;
  wickets?: number;
  economy?: number;
};
type ScorecardPayload = {
  match?: {
    id?: number;
    status?: string;
    resultSummary?: string | null;
    homeTeam?: { name?: string } | null;
    awayTeam?: { name?: string } | null;
  };
  scorecard?: {
    innings?: Array<{
      innings: number;
      battingTeamId?: number;
      runs?: number;
      wickets?: number;
      totalRuns?: number;
      totalWickets?: number;
      overs?: string;
      extras?: { total?: number; byes?: number; legByes?: number; wides?: number; noBalls?: number };
      batting?: BattingRow[];
      bowling?: BowlingRow[];
    }>;
  };
  players?: Record<string, string>;
  manOfTheMatch?: { playerName?: string; reason?: string | null } | null;
};

const LIVE_STATUSES = new Set(["live", "in_progress"]);
const NO_MATCHES: PublicMatch[] = [];

function isLiveStatus(status: string | null | undefined) {
  return LIVE_STATUSES.has((status || "").toLowerCase());
}

function statusLabel(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (isLiveStatus(value)) return "Live";
  if (value === "completed") return "Completed";
  if (value === "scheduled" || value === "ready" || value === "draft") return "Upcoming";
  if (!value) return "Scheduled";
  return value;
}

function asRows(payload: unknown): StandingRow[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { standings?: unknown };
  return Array.isArray(record.standings) ? record.standings as StandingRow[] : [];
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatRate(value: number | string | undefined) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed)) return trimmed || "—";
    return parsed > 0 && !trimmed.startsWith("+") ? `+${trimmed}` : trimmed;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1000) / 1000;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function connectionCopy(connection: FanScoringConnection) {
  if (connection === "connected") return "Live updates connected";
  if (connection === "reconnecting") return "Reconnecting to live scores";
  if (connection === "disconnected") return "Live updates disconnected";
  return "Connecting to live scores";
}

export function CricketFanExperience({ tournamentId }: { tournamentId: number }) {
  const { display, connection } = useFanScoringEvents(tournamentId, tournamentId > 0);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardPayload | null>(null);
  const [scorecardError, setScorecardError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const sequence = display?.sequence ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/scoring/public/schedule`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Schedule | null) => { if (!cancelled) setSchedule(body); })
      .catch(() => { if (!cancelled) setSchedule(null); })
      .finally(() => { if (!cancelled) setScheduleReady(true); });
    return () => { cancelled = true; };
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/tournaments/${tournamentId}/scoring/standings`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => { if (!cancelled) setStandings(asRows(body)); })
        .catch(() => { if (!cancelled) setStandings([]); });
      fetch(`/api/tournaments/${tournamentId}/scoring/leaderboards/runs?limit=10`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { rows?: LeaderRow[] } | null) => { if (!cancelled) setLeaders(body?.rows ?? []); })
        .catch(() => { if (!cancelled) setLeaders([]); });
    };
    load();
    return () => { cancelled = true; };
  }, [tournamentId, sequence]);

  const teams = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of schedule?.teams ?? []) {
      if (team.id != null && team.name) map.set(team.id, team.name);
    }
    for (const row of standings) {
      if (row.teamId != null && row.teamName) map.set(row.teamId, row.teamName);
    }
    return map;
  }, [schedule, standings]);

  const matches = schedule?.matches ?? NO_MATCHES;
  const knownMatchIds = useMemo(() => new Set(matches.map((match) => match.id)), [matches]);
  const state = display?.state;
  const summary = display?.summary;
  const match = display?.match;
  const matchStatus = stringOf(state?.matchStatus) || stringOf(match?.status);
  const live = isLiveStatus(matchStatus);
  const currentInnings = numberOf(state?.currentInnings);
  const innings = Array.isArray(summary?.innings) ? summary.innings as Array<Record<string, unknown>> : [];
  const currentLine = innings.find((row) => numberOf(row.innings) === currentInnings) ?? innings[innings.length - 1];
  const battingTeamId = numberOf(currentLine?.battingTeamId);
  const bowlingTeamId = numberOf(currentLine?.bowlingTeamId);
  const liveMatchId = numberOf(match?.id);

  useEffect(() => {
    if (!liveMatchId || !knownMatchIds.has(liveMatchId)) return;
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/scoring/matches/${liveMatchId}/scorecard`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: ScorecardPayload | null) => {
        if (cancelled || !body?.players) return;
        setNames((current) => ({ ...current, ...body.players }));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [tournamentId, liveMatchId, knownMatchIds]);

  const strikerId = numberOf(state?.strikerId);
  const nonStrikerId = numberOf(state?.nonStrikerId);
  const bowlerId = numberOf(state?.bowlerId);
  const lookedUp = useRef(new Set<number>());

  useEffect(() => {
    const missing = [strikerId, nonStrikerId, bowlerId].filter(
      (id): id is number => id != null && !names[String(id)] && !lookedUp.current.has(id),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    for (const id of missing) {
      lookedUp.current.add(id);
      fetch(`/api/tournaments/${tournamentId}/scoring/public/players/${id}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { player?: { name?: string } } | null) => {
          const name = body?.player?.name;
          if (!cancelled && name) setNames((current) => ({ ...current, [String(id)]: name }));
        })
        .catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [tournamentId, strikerId, nonStrikerId, bowlerId, names]);

  useEffect(() => {
    if (selectedId == null) {
      setScorecard(null);
      return;
    }
    if (!scheduleReady) return;
    if (!knownMatchIds.has(selectedId)) {
      setScorecard(null);
      setScorecardError("That match is not part of this tournament.");
      return;
    }
    let cancelled = false;
    setScorecardError(null);
    fetch(`/api/tournaments/${tournamentId}/scoring/matches/${selectedId}/scorecard`)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<ScorecardPayload>;
      })
      .then((body) => { if (!cancelled) setScorecard(body); })
      .catch(() => { if (!cancelled) setScorecardError("Scorecard is not available for this match."); });
    return () => { cancelled = true; };
  }, [tournamentId, selectedId, knownMatchIds, scheduleReady]);

  const battingName = battingTeamId != null ? teams.get(battingTeamId) : undefined;
  const bowlingName = bowlingTeamId != null ? teams.get(bowlingTeamId) : undefined;
  const tossWinnerId = numberOf(state?.tossWinnerTeamId);
  const tossWinner = tossWinnerId != null ? teams.get(tossWinnerId) : undefined;
  const elected = stringOf(state?.electedTo);
  const result = stringOf(summary?.resultText) || stringOf(match?.resultSummary);
  const runs = numberOf(currentLine?.runs);
  const wickets = numberOf(currentLine?.wickets);
  const overs = stringOf(currentLine?.overs);
  const scoreText = runs != null && wickets != null
    ? `${runs}/${wickets}${overs ? ` (${overs})` : ""}`
    : null;

  const grouped = {
    live: matches.filter((item) => isLiveStatus(item.status)),
    upcoming: matches.filter((item) => !isLiveStatus(item.status) && (item.status || "").toLowerCase() !== "completed"),
    completed: matches.filter((item) => (item.status || "").toLowerCase() === "completed"),
  };

  return (
    <div className="flex flex-col gap-4" data-testid="cricket-fan-experience" data-connection={connection} data-sequence={sequence ?? ""}>
      <p className="text-xs text-slate-500">{connectionCopy(connection)}</p>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E] sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
            <Radio className="h-3.5 w-3.5" />
            Cricket
          </div>
          <StatusPill status={matchStatus} />
        </div>
        {(stringOf(match?.roundName) || stringOf(match?.venue)) && (
          <p className="mb-3 text-sm text-slate-500">
            {[stringOf(match?.roundName), stringOf(match?.venue)].filter(Boolean).join(" · ")}
          </p>
        )}

        {live ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {currentInnings ? `Innings ${currentInnings}` : "Current innings"}
              {bowlingName ? ` · bowling ${bowlingName}` : ""}
            </p>
            <h2 className="mt-1 font-display text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {battingName || "Live innings"}
            </h2>
            <p className="mt-2 font-display text-4xl font-black text-amber-600 dark:text-amber-400">{scoreText || "—"}</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {matchStatus ? statusLabel(matchStatus) : "No match is in progress"}
            </h2>
            {result && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result}</p>}
          </>
        )}

        <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <PlayerLine label="Striker" name={nameOf(names, strikerId)} />
          <PlayerLine label="Non-striker" name={nameOf(names, nonStrikerId)} />
          <PlayerLine label="Bowler" name={nameOf(names, bowlerId)} />
        </div>
        {tossWinner && elected && (
          <p className="mt-3 text-xs text-slate-500">{tossWinner} elected to {elected}</p>
        )}
        {result && live && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result}</p>}
      </section>

      <FixtureGroups
        groups={grouped}
        teams={teams}
        scheduleReady={scheduleReady}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selectedId != null && (
        <ScorecardView
          card={scorecard}
          error={scorecardError}
          teams={teams}
          onClose={() => setSelectedId(null)}
        />
      )}

      {standings.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#131B2E]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  {["Team", "P", "W", "L", "T", "NR", "Pts", "NRR"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-semibold first:px-5">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr key={row.teamId ?? index} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{row.teamName || "—"}</td>
                    <td className="px-3 py-3">{row.played ?? 0}</td>
                    <td className="px-3 py-3">{row.won ?? 0}</td>
                    <td className="px-3 py-3">{row.lost ?? 0}</td>
                    <td className="px-3 py-3">{row.tied ?? 0}</td>
                    <td className="px-3 py-3">{row.noResult ?? 0}</td>
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{row.points ?? 0}</td>
                    <td className="px-3 py-3">{formatRate(row.netRunRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#131B2E]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <ListOrdered className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Most runs</h3>
        </div>
        {leaders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No batting figures have been published yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-white/5">
            {leaders.map((row, index) => (
              <li key={`${row.playerName}-${index}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.playerName || "—"}</p>
                  <p className="text-xs text-slate-500">{row.teamName || ""}</p>
                </div>
                <p className="font-display text-xl font-black text-amber-600 dark:text-amber-400">{row.value ?? "—"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const live = isLiveStatus(status);
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
      live
        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
    }`}>
      {statusLabel(status)}
    </span>
  );
}

function PlayerLine({ label, name }: { label: string; name: string | null }) {
  if (!name) return null;
  return (
    <p>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {name}
    </p>
  );
}

function FixtureGroups({
  groups,
  teams,
  scheduleReady,
  selectedId,
  onSelect,
}: {
  groups: { live: PublicMatch[]; upcoming: PublicMatch[]; completed: PublicMatch[] };
  teams: Map<number, string>;
  scheduleReady: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const sections = [
    ["Live", groups.live],
    ["Upcoming", groups.upcoming],
    ["Completed", groups.completed],
  ] as const;
  if (!scheduleReady) {
    return <p className="text-sm text-slate-500">Loading fixtures…</p>;
  }
  if (sections.every(([, rows]) => rows.length === 0)) {
    return <p className="text-sm text-slate-500">Fixtures have not been published.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {sections.map(([title, rows]) => rows.length > 0 && (
        <section key={title}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Calendar className="h-4 w-4 text-amber-500" />
            {title}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((match) => {
              const home = match.homeTeamId != null ? teams.get(match.homeTeamId) : undefined;
              const away = match.awayTeamId != null ? teams.get(match.awayTeamId) : undefined;
              const when = formatWhen(match.scheduledAt);
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => onSelect(match.id)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    selectedId === match.id
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#131B2E]"
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {match.tournamentMatchNumber ? `Match ${match.tournamentMatchNumber}` : "Fixture"}
                    {match.roundName ? ` · ${match.roundName}` : ""}
                    {" · "}
                    {statusLabel(match.status)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {home && away ? `${home} vs ${away}` : "Teams to be announced"}
                  </p>
                  {when && <p className="mt-1 text-xs text-slate-500">{when}</p>}
                  {match.resultSummary && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{match.resultSummary}</p>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ScorecardView({
  card,
  error,
  teams,
  onClose,
}: {
  card: ScorecardPayload | null;
  error: string | null;
  teams: Map<number, string>;
  onClose: () => void;
}) {
  const players = card?.players ?? {};
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#131B2E]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scorecard</h3>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">Close</button>
      </div>
      {error && <p className="text-sm text-slate-500">{error}</p>}
      {!error && !card && <p className="text-sm text-slate-500">Loading scorecard…</p>}
      {card?.match?.resultSummary && <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{card.match.resultSummary}</p>}
      {card?.manOfTheMatch?.playerName && !/^Player \d+$/.test(card.manOfTheMatch.playerName) && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Player of the match: {card.manOfTheMatch.playerName}
          {card.manOfTheMatch.reason ? ` · ${card.manOfTheMatch.reason}` : ""}
        </p>
      )}
      {card?.match?.homeTeam?.name && card.match.awayTeam?.name && (
        <p className="mb-3 text-xs text-slate-500">{card.match.homeTeam.name} vs {card.match.awayTeam.name}</p>
      )}
      {(card?.scorecard?.innings ?? []).map((innings) => (
        <div key={innings.innings} className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Innings {innings.innings}
            {innings.battingTeamId != null && teams.get(innings.battingTeamId) ? ` · ${teams.get(innings.battingTeamId)}` : ""}
          </p>
          {(innings.batting ?? []).length === 0 && (innings.bowling ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No batting or bowling card has been published for this innings.</p>
          )}
          {innings.extras && typeof innings.extras.total === "number" && (
            <p className="mb-2 text-xs text-slate-500">
              Extras {innings.extras.total}
              {` (b ${innings.extras.byes ?? 0}, lb ${innings.extras.legByes ?? 0}, w ${innings.extras.wides ?? 0}, nb ${innings.extras.noBalls ?? 0})`}
            </p>
          )}
          {(innings.totalRuns != null || innings.overs) && (
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              {innings.totalRuns ?? 0}/{innings.totalWickets ?? 0}{innings.overs ? ` (${innings.overs})` : ""}
            </p>
          )}
          {(innings.batting ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Batter</th>
                    <th>R</th><th>B</th><th>4s</th><th>6s</th>
                  </tr>
                </thead>
                <tbody>
                  {innings.batting?.map((row) => (
                    <tr key={row.playerId} className="border-t border-slate-100 dark:border-white/5">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">
                        {players[String(row.playerId)] || "—"}
                        {row.notOut ? " *" : ""}
                        {row.dismissalType ? <span className="ml-2 text-xs font-normal text-slate-500">{row.dismissalType}</span> : null}
                      </td>
                      <td>{row.runs ?? 0}</td>
                      <td>{row.balls ?? 0}</td>
                      <td>{row.fours ?? 0}</td>
                      <td>{row.sixes ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(innings.bowling ?? []).length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Bowler</th>
                    <th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {innings.bowling?.map((row) => (
                    <tr key={row.playerId} className="border-t border-slate-100 dark:border-white/5">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">{players[String(row.playerId)] || "—"}</td>
                      <td>{row.overs ?? "—"}</td>
                      <td>{row.maidens ?? 0}</td>
                      <td>{row.runs ?? 0}</td>
                      <td>{row.wickets ?? 0}</td>
                      <td>{row.economy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function stringOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nameOf(names: Record<string, string>, id: number | null) {
  if (id == null) return null;
  return names[String(id)] || null;
}
