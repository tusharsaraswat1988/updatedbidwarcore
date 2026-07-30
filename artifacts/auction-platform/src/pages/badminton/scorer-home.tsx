/**
 * Badminton Scorer Home
 * Route: /badminton/scorer?tid={tournamentId}
 *
 * Mobile + personal PIN login → JWT → all scoreable matches for the tournament.
 */

import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  fetchBadmintonScorerSession,
  type ScorerHomeCourtCard,
  type ScorerHomeMatchCard,
  type ScorerHomeSessionPayload,
  type ScorerHomeUiStatus,
} from "@/lib/badminton-api";
import {
  clearScorerAuthSession,
  getScorerAuthSession,
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

function primaryActionLabel(match: ScorerHomeMatchCard | null): string {
  if (!match) return "No match ready — assign court & time in Matches";
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
}: {
  match: ScorerHomeMatchCard | null;
  canOpen: boolean;
  onOpen: () => void;
}) {
  const label = primaryActionLabel(match);
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
            : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          : "bg-white/10 text-white/40",
      )}
    >
      <span className="block text-lg leading-tight">{label}</span>
      {match && canOpen ? (
        <span
          className={cn(
            "block mt-1 text-xs font-semibold truncate",
            isLive ? "text-white/85" : "text-primary-foreground/80",
          )}
        >
          {matchActionSubtitle(match)}
        </span>
      ) : null}
    </button>
  );
}

function MatchListCard({
  match,
  onOpen,
}: {
  match: ScorerHomeMatchCard;
  onOpen: () => void;
}) {
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
          {match.status === "LIVE" ? "LIVE (Resume)" : match.status}
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
          match.readOnly
            ? "bg-white/10 text-white/85 border border-white/15"
            : match.status === "LIVE" || match.status === "PAUSED"
              ? "bg-red-500 text-white"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
        )}
      >
        <span className="block">
          {match.status === "LIVE" || match.status === "PAUSED"
            ? "Resume Live Match"
            : match.actionLabel}
        </span>
        <span className="block mt-0.5 text-xs font-semibold opacity-85 truncate px-1">
          {matchActionSubtitle(match)}
        </span>
      </button>
    </article>
  );
}

function CourtFocusView({
  court,
  scorerName,
  onOpenMatch,
}: {
  court: ScorerHomeCourtCard;
  scorerName: string;
  onOpenMatch: (match: ScorerHomeMatchCard) => void;
}) {
  const hasLiveMatch = Boolean(
    court.currentMatch?.status === "LIVE" || court.currentMatch?.status === "PAUSED",
  );
  const focus = hasLiveMatch ? court.currentMatch : court.nextMatch;
  const canOpen = Boolean(focus && !focus.readOnly);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5">
        <p className="text-sky-200/80 text-[10px] font-bold uppercase tracking-wider">Your court</p>
        <h2 className="text-white text-2xl font-black mt-1">{court.name}</h2>
        {scorerName ? (
          <p className="text-white/50 text-sm mt-1">Scorer · {scorerName}</p>
        ) : null}
      </div>

      {hasLiveMatch ? (
        <>
          <MatchSummary label="Current Match" match={court.currentMatch} emphasized />
          {/* Action sits under the live match — not under Next — so resume target is obvious. */}
          <PrimaryMatchAction
            match={focus}
            canOpen={canOpen}
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
            onOpen={() => focus && onOpenMatch(focus)}
          />
        </>
      )}

      {court.matches.length > 1 ? (
        <div className="pt-2 space-y-3">
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider">All court matches</p>
          {court.matches.map((m) => (
            <MatchListCard key={m.id} match={m} onOpen={() => onOpenMatch(m)} />
          ))}
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
  const [refreshing, setRefreshing] = useState(false);
  const [scorerName, setScorerName] = useState(() => getScorerAuthSession()?.scorer.name ?? "");
  const sessionRestoreAttemptedRef = useRef(false);

  const { data: branding } = useBadmintonBranding(authAccepted ? tournamentId : 0);
  const tournamentName =
    branding?.displayName ?? (tournamentId ? `Tournament #${tournamentId}` : "Badminton");

  function applySession(next: ScorerHomeSessionPayload) {
    setSession(next);
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
        setScorerAuthSession({
          token: login.token,
          scorer: login.scorer,
          expiresAt: login.expiresAt,
        });
        setScorerName(login.scorer.name);
      } else {
        setScorerName(existing.scorer.name);
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
    setPinInput("");
    setAuthError("");
  }

  function openMatch(match: ScorerHomeMatchCard) {
    navigate(badmintonScorerMatchPath(match.id, tournamentId));
  }

  const selectedCourt =
    session?.courts.find((c) => c.id === selectedCourtId) ??
    (session?.view === "court" ? session.courts[0] : null);

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
              <p className="text-white/40 text-xs mt-0.5">
                {scorerName ? `${scorerName} · ` : ""}
                {session?.view === "matches" ? "All matches" : "Court scoring"}
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
            {session?.view === "courts" && !selectedCourt ? (
              <>
                <p className="text-white/50 text-sm">Select your court</p>
                {session.courts.map((court) => (
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
                ))}
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
                <CourtFocusView court={selectedCourt} scorerName={scorerName} onOpenMatch={openMatch} />
              </>
            ) : null}

            {session?.view === "matches" ? (
              session.matches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                  <p className="text-white/70 font-semibold">No matches assigned</p>
                  <p className="text-white/40 text-sm mt-2">
                    Ask the organizer to assign you to this tournament under Officials.
                  </p>
                </div>
              ) : (
                session.matches.map((match) => (
                  <MatchListCard key={match.id} match={match} onOpen={() => openMatch(match)} />
                ))
              )
            ) : null}
          </div>
        </main>
      </div>
    </FullscreenLayout>
  );
}
