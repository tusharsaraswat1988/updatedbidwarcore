/**
 * Badminton Scorer Home
 * Route: /badminton/scorer?tid={tournamentId}
 *
 * Mobile + personal PIN login → JWT → all scoreable matches for the tournament.
 */

import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { MatchPointsSummary } from "@/components/badminton/match-points-summary";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonLeaderboardBoards } from "@/hooks/use-badminton-leaderboard-boards";
import {
  fetchBadmintonMatches,
  fetchBadmintonScorerSession,
  type ScorerHomeCourtCard,
  type ScorerHomeMatchCard,
  type ScorerHomeSessionPayload,
  type ScorerHomeUiStatus,
} from "@/lib/badminton-api";
import type { ResultsMatch } from "@/lib/badminton-results";
import {
  clearScorerAuthSession,
  getScorerAuthSession,
  patchScorerAuthCanScore,
  setScorerAuthSession,
} from "@/lib/badminton-scorer-session";
import { loginScorer, logoutScorer } from "@/lib/scorer-api";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";
import {
  badmintonScorerHomePath,
  badmintonScorerMatchPath,
} from "@/lib/badminton-routes";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { identityFromCombinedLabel } from "@/lib/team-player-identity";
import { cn } from "@/lib/utils";

function formatScheduledTime(iso: string | null): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchTeamNames(match: ScorerHomeMatchCard): string[] {
  const names: string[] = [];
  const a =
    match.teamA?.trim() || identityFromCombinedLabel(match.playerA).teamName?.trim() || "";
  const b =
    match.teamB?.trim() || identityFromCombinedLabel(match.playerB).teamName?.trim() || "";
  if (a) names.push(a);
  if (b) names.push(b);
  return names;
}

function matchInvolvesTeam(match: ScorerHomeMatchCard, team: string): boolean {
  const needle = team.trim().toLowerCase();
  if (!needle) return true;
  return matchTeamNames(match).some((name) => name.toLowerCase() === needle);
}

function collectTeamNames(matches: ScorerHomeMatchCard[]): string[] {
  const set = new Set<string>();
  for (const match of matches) {
    for (const name of matchTeamNames(match)) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function filterCourtByTeam(court: ScorerHomeCourtCard, team: string | null): ScorerHomeCourtCard {
  if (!team) return court;
  const matches = court.matches.filter((m) => matchInvolvesTeam(m, team));
  const live =
    matches.find((m) => m.status === "LIVE" || m.status === "PAUSED") ?? null;
  const ready = matches.filter((m) => m.status === "READY");
  return {
    ...court,
    matches,
    currentMatch: live,
    nextMatch: live ? (ready.find((m) => m.id !== live.id) ?? ready[0] ?? null) : ready[0] ?? null,
  };
}

function statusStyles(status: ScorerHomeUiStatus): string {
  switch (status) {
    case "LIVE":
      return "bg-red-500/20 text-red-200 border-red-500/40";
    case "PAUSED":
      return "bg-amber-500/20 text-amber-100 border-amber-500/40";
    case "COMPLETED":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
    case "READY":
    default:
      return "bg-sky-500/15 text-sky-100 border-sky-500/35";
  }
}

function primaryActionLabel(match: ScorerHomeMatchCard | null, viewOnly = false): string {
  if (!match) return "No match ready — assign court & time in Matches";
  if (viewOnly) {
    if (match.status === "LIVE" || match.status === "PAUSED") return "View Live Match";
    if (match.readOnly) return "View Result";
    return "View Schedule";
  }
  if (match.status === "LIVE" || match.status === "PAUSED") return "Resume Live Match";
  if (match.readOnly) return "Read Only";
  return "Start Scoring";
}

/** Short vs line so the primary button names the match it opens. */
function matchActionSubtitle(match: ScorerHomeMatchCard): string {
  const left = identityFromCombinedLabel(match.playerA);
  const right = identityFromCombinedLabel(match.playerB);
  const leftName = left.playerName || left.teamName || "TBD";
  const rightName = right.playerName || right.teamName || "TBD";
  return `${leftName} vs ${rightName}`;
}

function MatchSummary({
  label,
  match,
  emptyHint,
  emphasized,
}: {
  label: string;
  match: ScorerHomeMatchCard | null;
  emptyHint?: string;
  /** Stronger border when this is the match the primary button opens. */
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 min-w-0 overflow-hidden",
        emphasized
          ? "border-red-500/45 bg-red-500/[0.07] ring-1 ring-red-500/20"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">{label}</p>
      {match ? (
        <>
          <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
            <p className="text-white/55 text-xs font-semibold truncate min-w-0">
              {match.category ?? "Match"}
            </p>
            <span
              className={cn(
                "shrink-0 inline-flex items-center min-h-7 px-2 rounded-md border text-[10px] font-bold uppercase",
                statusStyles(match.status),
              )}
            >
              {match.status === "LIVE" ? "LIVE" : match.status}
            </span>
          </div>
          <div className="min-w-0 overflow-hidden">
            <TeamPlayerVs
              left={identityFromCombinedLabel(match.playerA)}
              right={identityFromCombinedLabel(match.playerB)}
              size="sm"
              layout="stack"
              tone="led"
            />
          </div>
          <p className="text-white/40 text-xs mt-2">{formatScheduledTime(match.scheduledAt)}</p>
        </>
      ) : (
        <div className="space-y-1">
          <p className="text-white/35 text-sm">{emptyHint ?? "None queued"}</p>
          {!emptyHint ? (
            <p className="text-white/25 text-xs">
              Matches need a court + time assigned in Operations → Matches before they appear here.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PrimaryMatchAction({
  match,
  canOpen,
  onOpen,
  viewOnly = false,
}: {
  match: ScorerHomeMatchCard | null;
  canOpen: boolean;
  onOpen: () => void;
  viewOnly?: boolean;
}) {
  const label = primaryActionLabel(match, viewOnly);
  const isLive = match?.status === "LIVE" || match?.status === "PAUSED";

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={onOpen}
      className={cn(
        "w-full min-h-16 rounded-xl font-display font-bold px-4 py-3 text-left",
        canOpen
          ? isLive
            ? "bg-red-500 text-white"
            : viewOnly
              ? "bg-white/12 text-white border border-white/20"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          : "bg-white/10 text-white/40",
      )}
    >
      <span className="block text-lg leading-tight">{label}</span>
      {match && canOpen ? (
        <span
          className={cn(
            "block mt-1 text-xs font-semibold truncate",
            isLive ? "text-white/85" : viewOnly ? "text-white/65" : "text-primary-foreground/80",
          )}
        >
          {matchActionSubtitle(match)}
        </span>
      ) : null}
    </button>
  );
}

function TeamFilterChips({
  teams,
  value,
  onChange,
}: {
  teams: string[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  if (teams.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-none"
      role="tablist"
      aria-label="Filter matches by team"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "shrink-0 inline-flex items-center min-h-9 px-3 rounded-full border text-xs font-bold uppercase tracking-wide",
          value === null
            ? "bg-white/15 text-white border-white/25"
            : "bg-white/[0.04] text-white/55 border-white/10",
        )}
      >
        All teams
      </button>
      {teams.map((team) => {
        const selected = value === team;
        return (
          <button
            key={team}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(team)}
            className={cn(
              "shrink-0 inline-flex items-center min-h-9 px-3 rounded-full border text-xs font-bold tracking-wide max-w-[12rem] truncate",
              selected
                ? "bg-amber-500/20 text-amber-100 border-amber-500/45"
                : "bg-white/[0.04] text-white/55 border-white/10",
            )}
            title={team}
          >
            {team}
          </button>
        );
      })}
    </div>
  );
}

type CourtMatchListFilter = "all" | "live" | "ready" | "completed";

function matchPassesListFilter(
  match: ScorerHomeMatchCard,
  filter: CourtMatchListFilter,
): boolean {
  switch (filter) {
    case "live":
      return match.status === "LIVE" || match.status === "PAUSED";
    case "ready":
      return match.status === "READY";
    case "completed":
      return match.status === "COMPLETED";
    case "all":
    default:
      return true;
  }
}

function CourtMatchListFilterChips({
  matches,
  value,
  onChange,
}: {
  matches: ScorerHomeMatchCard[];
  value: CourtMatchListFilter;
  onChange: (next: CourtMatchListFilter) => void;
}) {
  let live = 0;
  let ready = 0;
  let completed = 0;
  for (const m of matches) {
    if (m.status === "LIVE" || m.status === "PAUSED") live += 1;
    else if (m.status === "READY") ready += 1;
    else if (m.status === "COMPLETED") completed += 1;
  }

  const chips: { id: CourtMatchListFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: matches.length },
    { id: "live", label: "Live", count: live },
    { id: "ready", label: "Ready", count: ready },
    { id: "completed", label: "Completed", count: completed },
  ];

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-none"
      role="tablist"
      aria-label="Filter court matches by status"
    >
      {chips.map((chip) => {
        if (chip.id !== "all" && chip.count === 0) return null;
        const selected = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(chip.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-xs font-bold uppercase tracking-wide transition-colors",
              selected
                ? chip.id === "live"
                  ? "bg-red-500/25 text-red-100 border-red-500/50"
                  : chip.id === "ready"
                    ? "bg-sky-500/20 text-sky-100 border-sky-500/45"
                    : chip.id === "completed"
                      ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/40"
                      : "bg-white/15 text-white border-white/25"
                : "bg-white/[0.04] text-white/55 border-white/10",
            )}
          >
            {chip.label}
            <span
              className={cn(
                "min-w-5 px-1 rounded-md text-[10px] font-black tabular-nums",
                selected ? "bg-black/25 text-inherit" : "bg-white/10 text-white/45",
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MatchListCard({
  match,
  onOpen,
  viewOnly = false,
}: {
  match: ScorerHomeMatchCard;
  onOpen: () => void;
  viewOnly?: boolean;
}) {
  const actionLabel = viewOnly
    ? primaryActionLabel(match, true)
    : match.status === "LIVE" || match.status === "PAUSED"
      ? "Resume Live Match"
      : match.actionLabel;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-white/45 text-xs font-semibold uppercase tracking-wide truncate">
            {match.category ?? "Match"}
          </p>
          <p className="text-white/55 text-sm mt-1 font-medium">
            {match.court ? `Court ${match.court}` : "Court TBD"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center min-h-8 px-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide",
            statusStyles(match.status),
          )}
        >
          {match.status === "LIVE"
            ? viewOnly
              ? "LIVE"
              : "LIVE (Resume)"
            : match.status}
        </span>
      </div>
      <div className="text-center py-3 min-w-0 overflow-hidden px-1">
        <TeamPlayerVs
          left={identityFromCombinedLabel(match.playerA)}
          right={identityFromCombinedLabel(match.playerB)}
          size="md"
          layout="stack"
          tone="led"
        />
      </div>
      <p className="text-white/40 text-sm text-center mb-4">{formatScheduledTime(match.scheduledAt)}</p>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full min-h-14 rounded-xl font-display font-bold text-base",
          match.readOnly || viewOnly
            ? "bg-white/10 text-white/85 border border-white/15"
            : match.status === "LIVE" || match.status === "PAUSED"
              ? "bg-red-500 text-white"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
        )}
      >
        <span className="block">{actionLabel}</span>
        <span className="block mt-0.5 text-xs font-semibold opacity-85 truncate px-1">
          {matchActionSubtitle(match)}
        </span>
      </button>
    </article>
  );
}

function CourtFocusView({
  court,
  onOpenMatch,
  viewOnly = false,
}: {
  court: ScorerHomeCourtCard;
  onOpenMatch: (match: ScorerHomeMatchCard) => void;
  viewOnly?: boolean;
}) {
  const [listFilter, setListFilter] = useState<CourtMatchListFilter>("all");
  const hasLiveMatch = Boolean(
    court.currentMatch?.status === "LIVE" || court.currentMatch?.status === "PAUSED",
  );
  const focus = hasLiveMatch ? court.currentMatch : court.nextMatch;
  // View-only users can open any match (including completed / upcoming).
  const canOpen = Boolean(focus && (viewOnly || !focus.readOnly));
  const filteredMatches =
    listFilter === "all"
      ? court.matches
      : court.matches.filter((m) => matchPassesListFilter(m, listFilter));

  // If the selected filter no longer has matches (e.g. after refresh), fall back to All.
  useEffect(() => {
    if (listFilter === "all") return;
    const stillHasMatches = court.matches.some((m) => matchPassesListFilter(m, listFilter));
    if (!stillHasMatches) setListFilter("all");
  }, [court.matches, listFilter]);

  return (
    <div className="space-y-4">
      {hasLiveMatch ? (
        <>
          <MatchSummary label="Current Match" match={court.currentMatch} emphasized />
          {/* Action sits under the live match — not under Next — so resume target is obvious. */}
          <PrimaryMatchAction
            match={focus}
            canOpen={canOpen}
            viewOnly={viewOnly}
            onOpen={() => focus && onOpenMatch(focus)}
          />
          <MatchSummary label="Next Match" match={court.nextMatch} />
        </>
      ) : (
        <>
          <MatchSummary label="In Progress" match={null} emptyHint="No match in progress" />
          <MatchSummary label="Up Next" match={court.nextMatch} emphasized={Boolean(focus)} />
          <PrimaryMatchAction
            match={focus}
            canOpen={canOpen}
            viewOnly={viewOnly}
            onOpen={() => focus && onOpenMatch(focus)}
          />
        </>
      )}

      {court.matches.length > 1 ? (
        <div className="pt-2 space-y-3">
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider">All court matches</p>
          <CourtMatchListFilterChips
            matches={court.matches}
            value={listFilter}
            onChange={setListFilter}
          />
          {filteredMatches.length === 0 ? (
            <p className="text-white/35 text-sm py-2">No matches in this status</p>
          ) : (
            filteredMatches.map((m) => (
              <MatchListCard
                key={m.id}
                match={m}
                viewOnly={viewOnly}
                onOpen={() => onOpenMatch(m)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function BadmintonScorerHomePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);
  const tidFromQuery = parseInt(searchParams.get("tid") ?? "0", 10);

  const [tournamentIdInput, setTournamentIdInput] = useState(
    tidFromQuery > 0 ? String(tidFromQuery) : "",
  );
  const tournamentId = tidFromQuery > 0 ? tidFromQuery : parseInt(tournamentIdInput || "0", 10) || 0;

  const [mobileInput, setMobileInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authAccepted, setAuthAccepted] = useState(false);
  const [authError, setAuthError] = useState("");
  // Never seed verifying=true from session — that skipped the restore effect forever
  // ("Restoring your session…" stuck, no login / no home).
  const [verifying, setVerifying] = useState(false);
  const [session, setSession] = useState<ScorerHomeSessionPayload | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<"matches" | "points">("matches");
  const [canScore, setCanScore] = useState(() => getScorerAuthSession()?.canScore !== false);
  const [refreshing, setRefreshing] = useState(false);
  const [scorerName, setScorerName] = useState(() => getScorerAuthSession()?.scorer.name ?? "");
  const sessionRestoreAttemptedRef = useRef(false);

  const { data: branding } = useBadmintonBranding(authAccepted ? tournamentId : 0);
  const pointsEnabled = authAccepted && homeTab === "points" && tournamentId > 0;
  const leaderboards = useBadmintonLeaderboardBoards(tournamentId, pointsEnabled);
  const { data: pointsMatches = [], isLoading: pointsMatchesLoading } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: pointsEnabled,
    staleTime: 15_000,
  });
  const tournamentName =
    branding?.displayName ?? (tournamentId ? `Tournament #${tournamentId}` : "Badminton");
  const viewOnly = !canScore;

  function applySession(next: ScorerHomeSessionPayload) {
    setSession(next);
    if (typeof next.canScore === "boolean") {
      setCanScore(next.canScore);
      patchScorerAuthCanScore(next.canScore);
    }
    if (next.scorer?.name) setScorerName(next.scorer.name);
    if (next.view === "court" && next.courts[0]) {
      setSelectedCourtId(next.courts[0].id);
    } else if (next.view === "courts") {
      setSelectedCourtId((prev) =>
        prev && next.courts.some((c) => c.id === prev) ? prev : null,
      );
    } else {
      setSelectedCourtId(null);
    }
  }

  async function loadHomeSession(tid: number) {
    const result = await fetchBadmintonScorerSession(tid);
    applySession(result);
    setAuthAccepted(true);
    if (tidFromQuery !== tid) {
      navigate(badmintonScorerHomePath(tid));
    }
  }

  async function unlockWithCredentials(mobile: string, pin: string, tid: number) {
    if (!tid) {
      setAuthError("Enter the tournament ID from your scorer link");
      return;
    }
    if (mobile.replace(/\D/g, "").length < 10) {
      setAuthError("Enter a valid 10-digit mobile number");
      return;
    }
    if (pin.trim().length < 4) {
      setAuthError("PIN must be at least 4 digits");
      return;
    }
    setVerifying(true);
    setAuthError("");
    try {
      const existing = getScorerAuthSession();
      if (!existing) {
        const login = await loginScorer(mobile.trim(), pin.trim());
        const loginCanScore = login.canScore ?? login.scorer.isActive !== false;
        setScorerAuthSession({
          token: login.token,
          scorer: { ...login.scorer, isActive: loginCanScore },
          canScore: loginCanScore,
          expiresAt: login.expiresAt,
        });
        setScorerName(login.scorer.name);
        setCanScore(loginCanScore);
      } else {
        setScorerName(existing.scorer.name);
        setCanScore(existing.canScore !== false);
      }
      await loadHomeSession(tid);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!tournamentId || authAccepted) return;
    const existing = getScorerAuthSession();
    if (!existing) return;
    if (sessionRestoreAttemptedRef.current) return;
    sessionRestoreAttemptedRef.current = true;
    setScorerName(existing.scorer.name);
    setVerifying(true);
    void loadHomeSession(tournamentId)
      .catch((err) => {
        clearScorerAuthSession();
        setAuthError(err instanceof Error ? err.message : "Session expired. Sign in again.");
      })
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, authAccepted]);

  async function refreshSession() {
    if (!tournamentId || !getScorerAuthSession()) return;
    setRefreshing(true);
    try {
      const next = await fetchBadmintonScorerSession(tournamentId);
      applySession(next);
    } catch {
      clearScorerAuthSession();
      setAuthAccepted(false);
      setSession(null);
      setAuthError("Session expired. Sign in again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    const existing = getScorerAuthSession();
    if (existing?.token) await logoutScorer(existing.token);
    clearScorerAuthSession();
    setAuthAccepted(false);
    setSession(null);
    setSelectedCourtId(null);
    setTeamFilter(null);
    setCanScore(true);
    setPinInput("");
    setAuthError("");
  }

  function openMatch(match: ScorerHomeMatchCard) {
    navigate(badmintonScorerMatchPath(match.id, tournamentId));
  }

  const teamNames = session ? collectTeamNames(session.matches) : [];
  const filteredCourts = session
    ? session.courts
        .map((court) => filterCourtByTeam(court, teamFilter))
        .filter((court) => !teamFilter || court.matches.length > 0)
    : [];
  const filteredMatches = session
    ? teamFilter
      ? session.matches.filter((m) => matchInvolvesTeam(m, teamFilter))
      : session.matches
    : [];

  useEffect(() => {
    if (!teamFilter || !session) return;
    const names = collectTeamNames(session.matches);
    if (!names.includes(teamFilter)) setTeamFilter(null);
  }, [teamFilter, session]);

  const selectedCourt =
    filteredCourts.find((c) => c.id === selectedCourtId) ??
    (session?.view === "court" ? filteredCourts[0] : null);

  if (!authAccepted) {
    if (verifying) {
      return (
        <FullscreenLayout className="lovable-theme">
          <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 gap-4">
            <BadmintonPublicBrandMark variant="scorer-bar" />
            <p className="text-white/50 text-sm mt-2">Restoring your session…</p>
            <button
              type="button"
              onClick={() => {
                sessionRestoreAttemptedRef.current = false;
                setVerifying(false);
                clearScorerAuthSession();
                setAuthError("Sign in again to continue.");
              }}
              className="text-white/45 text-sm hover:text-white/70 underline-offset-2 hover:underline"
            >
              Cancel · Sign in again
            </button>
          </div>
        </FullscreenLayout>
      );
    }

    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-[100dvh] bg-background flex flex-col">
          <div className="flex-1 flex items-center justify-center p-5 sm:p-6">
            <div className="w-full max-w-sm">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <BadmintonPublicBrandMark variant="scorer-bar" />
                </div>
                <h1 className="text-white text-2xl font-black tracking-tight">Scorer Login</h1>
                <p className="text-white/45 text-sm mt-2 leading-relaxed">
                  Enter your mobile number and personal PIN to open scoring.
                </p>
              </div>

              <div className="space-y-4">
                {tidFromQuery <= 0 ? (
                  <div>
                    <label className="block text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">
                      Tournament ID
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={tournamentIdInput}
                      onChange={(e) => setTournamentIdInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="From your scorer link"
                      className="w-full min-h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-xl font-bold tracking-wide placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="block text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">
                    Mobile number
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
                    placeholder="10-digit mobile"
                    className="w-full min-h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-xl font-bold tracking-wide placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">
                    Personal PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void unlockWithCredentials(mobileInput, pinInput, tournamentId);
                    }}
                    placeholder="PIN"
                    className="w-full min-h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-3xl font-black tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    maxLength={8}
                  />
                </div>

                {authError ? (
                  <p className="text-red-400 text-sm text-center" role="alert">
                    {authError}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => void unlockWithCredentials(mobileInput, pinInput, tournamentId)}
                  className="w-full min-h-16 rounded-xl bg-primary text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)] disabled:opacity-50"
                >
                  {verifying ? "Signing in…" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout className="lovable-theme">
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-background/95 backdrop-blur-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="max-w-lg mx-auto flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BadmintonPublicBrandMark variant="scorer-bar" />
              </div>
              <h1 className="text-white text-lg font-black truncate">{tournamentName}</h1>
              <p className="text-white/40 text-xs mt-0.5 truncate">
                {viewOnly ? (
                  <>
                    {scorerName ? `${scorerName} · ` : ""}
                    View only
                  </>
                ) : selectedCourt ? (
                  <>
                    <span className="text-sky-200/90 font-semibold">{selectedCourt.name}</span>
                    {scorerName ? ` · ${scorerName}` : ""}
                  </>
                ) : (
                  <>
                    {scorerName ? `${scorerName} · ` : ""}
                    {session?.view === "matches" ? "All matches" : "Court scoring"}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshSession()}
              disabled={refreshing}
              className="min-h-11 px-3 rounded-xl bg-white/8 border border-white/10 text-white/70 text-xs font-semibold disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="max-w-lg mx-auto mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex-1 min-h-12 rounded-xl bg-white/5 border border-white/10 text-white/75 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto space-y-3">
            {viewOnly ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
                <p className="text-amber-100 text-sm font-semibold">View-only access</p>
                <p className="text-amber-100/70 text-xs mt-1 leading-relaxed">
                  Scoring is disabled. You can browse schedules and match results.
                </p>
              </div>
            ) : null}

            <div
              role="tablist"
              aria-label="Scorer home"
              className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1"
            >
              {(
                [
                  { id: "matches", label: "Matches" },
                  { id: "points", label: "Points" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={homeTab === tab.id}
                  onClick={() => setHomeTab(tab.id)}
                  className={cn(
                    "min-h-11 rounded-lg text-sm font-semibold transition-colors",
                    homeTab === tab.id
                      ? "bg-white/12 text-white"
                      : "text-white/50 hover:text-white/75",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {homeTab === "points" ? (
              <MatchPointsSummary
                boards={leaderboards.boards}
                matches={pointsMatches}
                loading={leaderboards.loading || pointsMatchesLoading}
                emptyStandingsHint={
                  leaderboards.leagueCategoryCount === 0
                    ? "No league / group events yet. Knockout-only categories do not show a points table here."
                    : undefined
                }
              />
            ) : (
              <>
                {teamNames.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">
                      Team filter
                    </p>
                    <TeamFilterChips
                      teams={teamNames}
                      value={teamFilter}
                      onChange={setTeamFilter}
                    />
                  </div>
                ) : null}

                {session?.view === "courts" && !selectedCourt ? (
                  <>
                    <p className="text-white/50 text-sm">Select your court</p>
                    {filteredCourts.length === 0 ? (
                      <p className="text-white/35 text-sm py-2">No matches for this team</p>
                    ) : (
                      filteredCourts.map((court) => (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => setSelectedCourtId(court.id)}
                          className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] p-5 min-h-20"
                        >
                          <p className="text-white text-xl font-black">{court.name}</p>
                          <p className="text-white/35 text-xs mt-2">
                            {court.currentMatch
                              ? `Live: ${court.currentMatch.playerA} vs ${court.currentMatch.playerB}`
                              : court.nextMatch
                                ? `Up next: ${court.nextMatch.playerA} vs ${court.nextMatch.playerB}`
                                : "No matches queued"}
                          </p>
                        </button>
                      ))
                    )}
                  </>
                ) : null}

                {selectedCourt ? (
                  <>
                    {session?.view === "courts" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCourtId(null)}
                        className="text-white/50 text-sm font-semibold min-h-10"
                      >
                        ← All courts
                      </button>
                    ) : null}
                    <CourtFocusView
                      court={selectedCourt}
                      viewOnly={viewOnly}
                      onOpenMatch={openMatch}
                    />
                  </>
                ) : null}

                {session?.view === "matches" ? (
                  filteredMatches.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                      <p className="text-white/70 font-semibold">
                        {teamFilter ? "No matches for this team" : "No matches assigned"}
                      </p>
                      <p className="text-white/40 text-sm mt-2">
                        {teamFilter
                          ? "Try another team or clear the filter."
                          : "Ask the organizer to assign you to this tournament under Officials."}
                      </p>
                    </div>
                  ) : (
                    filteredMatches.map((match) => (
                      <MatchListCard
                        key={match.id}
                        match={match}
                        viewOnly={viewOnly}
                        onOpen={() => openMatch(match)}
                      />
                    ))
                  )
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </FullscreenLayout>
  );
}
