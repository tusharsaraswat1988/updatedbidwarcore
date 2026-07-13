/**
 * Badminton Scorer Home
 * Route: /badminton/scorer?tid={tournamentId}
 *
 * Court-oriented entry: PIN once → assigned court(s) → current/next match →
 * existing Live Scoring. Match PIN still supported for compatibility.
 */

import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { FullscreenLayout } from "@/components/layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  fetchBadmintonScorerSession,
  openBadmintonScorerSession,
  type ScorerHomeCourtCard,
  type ScorerHomeMatchCard,
  type ScorerHomeSessionPayload,
  type ScorerHomeUiStatus,
} from "@/lib/badminton-api";
import {
  clearBadmintonScorerSession,
  getBadmintonScorerSession,
  setBadmintonScorerSession,
} from "@/lib/badminton-scorer-session";
import {
  badmintonScorerHomePath,
  badmintonUmpireScorerPath,
} from "@/lib/badminton-routes";
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
  if (!match) return "No match ready";
  if (match.status === "LIVE" || match.status === "PAUSED") return "Resume Live Match";
  if (match.readOnly) return "Read Only";
  return "Start Scoring";
}

function MatchSummary({
  label,
  match,
}: {
  label: string;
  match: ScorerHomeMatchCard | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">{label}</p>
      {match ? (
        <>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-white/55 text-xs font-semibold truncate">
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
          <p className="text-white text-lg font-black leading-tight">{match.playerA}</p>
          <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.2em] my-1">vs</p>
          <p className="text-white text-lg font-black leading-tight">{match.playerB}</p>
          <p className="text-white/40 text-xs mt-2">{formatScheduledTime(match.scheduledAt)}</p>
        </>
      ) : (
        <p className="text-white/35 text-sm">None queued</p>
      )}
    </div>
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
      <div className="text-center py-3 space-y-1">
        <p className="text-white text-xl font-black leading-tight break-words">{match.playerA}</p>
        <p className="text-white/35 text-xs font-bold uppercase tracking-[0.2em]">vs</p>
        <p className="text-white text-xl font-black leading-tight break-words">{match.playerB}</p>
      </div>
      <p className="text-white/40 text-sm text-center mb-4">{formatScheduledTime(match.scheduledAt)}</p>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full min-h-14 rounded-xl font-display font-bold text-base",
          match.readOnly
            ? "bg-white/10 text-white/85 border border-white/15"
            : match.status === "LIVE"
              ? "bg-red-500 text-white"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
        )}
      >
        {match.status === "LIVE" || match.status === "PAUSED"
          ? "Resume Live Match"
          : match.actionLabel}
      </button>
    </article>
  );
}

function CourtFocusView({
  court,
  onOpenMatch,
}: {
  court: ScorerHomeCourtCard;
  onOpenMatch: (match: ScorerHomeMatchCard) => void;
}) {
  const focus = court.currentMatch;
  const canOpen = focus && !focus.readOnly;
  const primaryLabel = primaryActionLabel(focus);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5">
        <p className="text-sky-200/80 text-[10px] font-bold uppercase tracking-wider">Your court</p>
        <h2 className="text-white text-2xl font-black mt-1">{court.name}</h2>
        {court.scorerName ? (
          <p className="text-white/50 text-sm mt-1">Scorer · {court.scorerName}</p>
        ) : null}
      </div>

      <MatchSummary label="Current Match" match={court.currentMatch} />
      <MatchSummary label="Next Match" match={court.nextMatch} />

      <button
        type="button"
        disabled={!canOpen}
        onClick={() => focus && onOpenMatch(focus)}
        className={cn(
          "w-full min-h-16 rounded-xl font-display font-bold text-lg sticky bottom-4",
          canOpen
            ? focus?.status === "LIVE" || focus?.status === "PAUSED"
              ? "bg-red-500 text-white"
              : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
            : "bg-white/10 text-white/40",
        )}
      >
        {primaryLabel}
      </button>

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

  const [pinInput, setPinInput] = useState("");
  const [pinAccepted, setPinAccepted] = useState(false);
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [session, setSession] = useState<ScorerHomeSessionPayload | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionPin, setSessionPin] = useState("");

  const { data: branding } = useBadmintonBranding(pinAccepted ? tournamentId : 0);
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

  async function unlockWithPin(candidate: string, tid: number) {
    if (candidate.trim().length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    if (!tid) {
      setPinError("Enter the tournament ID from your scorer link");
      return;
    }
    setVerifying(true);
    setPinError("");
    try {
      const result = await openBadmintonScorerSession(tid, candidate.trim());
      if (!result.ok) {
        setPinError("No courts or matches found for this PIN");
        return;
      }
      setBadmintonScorerSession(tid, candidate.trim());
      setSessionPin(candidate.trim());
      applySession(result);
      setPinAccepted(true);
      if (tidFromQuery !== tid) {
        navigate(badmintonScorerHomePath(tid));
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Could not verify PIN");
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!tournamentId || pinAccepted || verifying) return;
    const existing = getBadmintonScorerSession(tournamentId);
    if (!existing) return;
    setPinInput(existing.pin);
    void unlockWithPin(existing.pin, tournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function refreshSession() {
    if (!tournamentId || !sessionPin) return;
    setRefreshing(true);
    try {
      const next = await fetchBadmintonScorerSession(tournamentId, sessionPin);
      applySession(next);
    } catch {
      clearBadmintonScorerSession(tournamentId);
      setPinAccepted(false);
      setSessionPin("");
      setSession(null);
      setPinError("Session expired. Enter your PIN again.");
    } finally {
      setRefreshing(false);
    }
  }

  function changePin() {
    clearBadmintonScorerSession(tournamentId);
    setPinAccepted(false);
    setSessionPin("");
    setSession(null);
    setSelectedCourtId(null);
    setPinInput("");
    setPinError("");
  }

  function openMatch(match: ScorerHomeMatchCard) {
    navigate(badmintonUmpireScorerPath(match.id, tournamentId));
  }

  const selectedCourt =
    session?.courts.find((c) => c.id === selectedCourtId) ??
    (session?.view === "court" ? session.courts[0] : null);

  if (!pinAccepted) {
    return (
      <FullscreenLayout>
        <div className="min-h-[100dvh] bg-background flex flex-col">
          <div className="flex-1 flex items-center justify-center p-5 sm:p-6">
            <div className="w-full max-w-sm">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <BadmintonPublicBrandMark variant="scorer-bar" />
                </div>
                <h1 className="text-white text-2xl font-black tracking-tight">Scorer Home</h1>
                <p className="text-white/45 text-sm mt-2 leading-relaxed">
                  Enter your court PIN to open current and upcoming matches.
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
                    Scorer PIN
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void unlockWithPin(pinInput, tournamentId);
                    }}
                    placeholder="Enter PIN"
                    className="w-full min-h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-3xl font-black tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    maxLength={8}
                  />
                </div>

                {pinError ? (
                  <p className="text-red-400 text-sm text-center" role="alert">
                    {pinError}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => void unlockWithPin(pinInput, tournamentId)}
                  className="w-full min-h-16 rounded-xl bg-primary text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)] disabled:opacity-50"
                >
                  {verifying ? "Checking PIN…" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-background/95 backdrop-blur-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="max-w-lg mx-auto flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BadmintonPublicBrandMark variant="scorer-bar" />
              </div>
              <h1 className="text-white text-lg font-black truncate">{tournamentName}</h1>
              <p className="text-white/40 text-xs mt-0.5">
                {session?.view === "matches" ? "Your assigned matches" : "Court scoring"}
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
              onClick={changePin}
              className="flex-1 min-h-12 rounded-xl bg-white/5 border border-white/10 text-white/75 text-sm font-semibold"
            >
              Change PIN
            </button>
            <button
              type="button"
              onClick={changePin}
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
                    {court.scorerName ? (
                      <p className="text-white/45 text-sm mt-1">{court.scorerName}</p>
                    ) : null}
                    <p className="text-white/35 text-xs mt-2">
                      {court.currentMatch
                        ? `Current: ${court.currentMatch.playerA} vs ${court.currentMatch.playerB}`
                        : "No current match"}
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
                <CourtFocusView court={selectedCourt} onOpenMatch={openMatch} />
              </>
            ) : null}

            {session?.view === "matches" ? (
              session.matches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                  <p className="text-white/70 font-semibold">No matches for this PIN</p>
                  <p className="text-white/40 text-sm mt-2">
                    Ask the organizer to assign a court PIN or match PIN.
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
