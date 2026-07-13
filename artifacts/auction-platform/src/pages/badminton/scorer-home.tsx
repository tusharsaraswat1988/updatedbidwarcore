/**
 * Badminton Scorer Home
 * Route: /badminton/scorer?tid={tournamentId}
 *
 * Mobile-first entry for umpires: enter PIN once → pick an assigned match →
 * open the existing Live Scoring screen. Does not change the scoring engine.
 */

import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { FullscreenLayout } from "@/components/layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  fetchBadmintonScorerMatches,
  openBadmintonScorerSession,
  type ScorerHomeMatchCard,
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

function statusCaption(status: ScorerHomeUiStatus): string {
  if (status === "LIVE") return "LIVE (Resume)";
  return status;
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
  const [matches, setMatches] = useState<ScorerHomeMatchCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionPin, setSessionPin] = useState("");

  const { data: branding } = useBadmintonBranding(pinAccepted ? tournamentId : 0);
  const tournamentName =
    branding?.displayName ?? (tournamentId ? `Tournament #${tournamentId}` : "Badminton");

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
      if (!result.ok || result.matches.length === 0) {
        setPinError("No matches found for this PIN");
        return;
      }
      setBadmintonScorerSession(tid, candidate.trim());
      setSessionPin(candidate.trim());
      setMatches(result.matches);
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

  // Restore session once on load when tid is known.
  useEffect(() => {
    if (!tournamentId || pinAccepted || verifying) return;
    const session = getBadmintonScorerSession(tournamentId);
    if (!session) return;
    setPinInput(session.pin);
    void unlockWithPin(session.pin, tournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function refreshMatches() {
    if (!tournamentId || !sessionPin) return;
    setRefreshing(true);
    try {
      const next = await fetchBadmintonScorerMatches(tournamentId, sessionPin);
      setMatches(next);
    } catch {
      // Session invalid — force re-auth
      clearBadmintonScorerSession(tournamentId);
      setPinAccepted(false);
      setSessionPin("");
      setMatches([]);
      setPinError("Session expired. Enter your PIN again.");
    } finally {
      setRefreshing(false);
    }
  }

  function changePin() {
    clearBadmintonScorerSession(tournamentId);
    setPinAccepted(false);
    setSessionPin("");
    setMatches([]);
    setPinInput("");
    setPinError("");
  }

  function logout() {
    changePin();
  }

  function openMatch(match: ScorerHomeMatchCard) {
    navigate(badmintonUmpireScorerPath(match.id, tournamentId));
  }

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
                  Enter your PIN to see the matches assigned to you.
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
                      if (e.key === "Enter") {
                        void unlockWithPin(pinInput, tournamentId);
                      }
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
                  className="w-full min-h-16 rounded-xl bg-primary text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)] hover-elevate transition-colors disabled:opacity-50 sticky bottom-4"
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
              <p className="text-white/40 text-xs mt-0.5">Your assigned matches</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void refreshMatches()}
                disabled={refreshing}
                className="min-h-11 px-3 rounded-xl bg-white/8 border border-white/10 text-white/70 text-xs font-semibold disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
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
              onClick={logout}
              className="flex-1 min-h-12 rounded-xl bg-white/5 border border-white/10 text-white/75 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto space-y-3">
            {matches.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-white/70 font-semibold">No matches for this PIN</p>
                <p className="text-white/40 text-sm mt-2">
                  Ask the organizer to assign this PIN to your court matches.
                </p>
              </div>
            ) : (
              matches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-white/45 text-xs font-semibold uppercase tracking-wide truncate">
                        {match.category ?? "Match"}
                      </p>
                      {match.court ? (
                        <p className="text-white/55 text-sm mt-1 font-medium">Court {match.court}</p>
                      ) : (
                        <p className="text-white/35 text-sm mt-1">Court TBD</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center min-h-8 px-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide",
                        statusStyles(match.status),
                      )}
                    >
                      {statusCaption(match.status)}
                    </span>
                  </div>

                  <div className="text-center py-3 space-y-1">
                    <p className="text-white text-xl sm:text-2xl font-black leading-tight break-words">
                      {match.playerA}
                    </p>
                    <p className="text-white/35 text-xs font-bold uppercase tracking-[0.2em]">vs</p>
                    <p className="text-white text-xl sm:text-2xl font-black leading-tight break-words">
                      {match.playerB}
                    </p>
                  </div>

                  <p className="text-white/40 text-sm text-center mb-4">
                    {formatScheduledTime(match.scheduledAt)}
                  </p>

                  <button
                    type="button"
                    onClick={() => openMatch(match)}
                    className={cn(
                      "w-full min-h-14 rounded-xl font-display font-bold text-base transition-colors",
                      match.readOnly
                        ? "bg-white/10 text-white/85 border border-white/15"
                        : match.status === "LIVE"
                          ? "bg-red-500 text-white"
                          : "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
                    )}
                  >
                    {match.actionLabel}
                  </button>
                </article>
              ))
            )}
          </div>
        </main>
      </div>
    </FullscreenLayout>
  );
}
