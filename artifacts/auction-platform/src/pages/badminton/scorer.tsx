/**
 * Badminton Scorer Page
 * Routes:
 *   /badminton/:matchId/score?tid=YYY
 *   /badminton/:matchId/umpire?tid=YYY  (S4-05 — same console, umpire chrome)
 *   /badminton/:matchId/score?tid=YYY&role=umpire  (alias)
 *
 * Requires Scorer JWT (mobile + personal PIN login). Acquires match lock
 * before entering the console; heartbeats while open; unlocks on exit/finish.
 *
 * Native mobile badminton (dedicated umpire app) is future work — this MVP
 * reuses the web scorer console with umpire-oriented labels only. Scorer
 * accounts have no separate role field; "umpire" is UX labeling.
 */

import { useState, useEffect, useRef } from "react";
import { useSearch, useRoute, Link, useLocation } from "wouter";
import { ScorerPanel } from "@/components/badminton/scorer-panel";
import { ScorerAssistanceShell } from "@/components/badminton/scorer-assistance-shell";
import { ScorerStartMatchPanel } from "@/components/badminton/scorer-start-match";
import { useBadmintonMatch, useBadmintonDirector, useBadmintonScorer } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  clearScorerAuthSession,
  getScorerAuthSession,
  setScorerAuthSession,
} from "@/lib/badminton-scorer-session";
import {
  acquireScorerMatchLock,
  heartbeatScorerMatchLock,
  loginScorer,
  logoutScorer,
  releaseScorerMatchLock,
} from "@/lib/scorer-api";
import { badmintonScorerHomePath } from "@/lib/badminton-routes";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";

const HEARTBEAT_MS = 20_000;

const TERMINAL_STATUSES = new Set([
  "completed",
  "walkover",
  "retired",
  "disqualified",
  "abandoned",
]);

function terminalStatusLabel(status: string): string {
  switch (status) {
    case "walkover":
      return "Walkover";
    case "retired":
      return "Retired";
    case "disqualified":
      return "Disqualified";
    case "abandoned":
      return "Abandoned";
    default:
      return "Match complete";
  }
}

export default function BadmintonScorerPage() {
  const [, scoreParams] = useRoute("/badminton/:matchId/score");
  const [, umpireParams] = useRoute("/badminton/:matchId/umpire");
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);

  const params = scoreParams ?? umpireParams;
  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const isUmpire =
    Boolean(umpireParams) || searchParams.get("role") === "umpire";
  const accessTitle = isUmpire ? "Umpire Access" : "Scorer Access";
  const accessButton = isUmpire ? "Access Umpire Console" : "Access Scorer";
  const consoleTitle = isUmpire ? "Umpire Console" : "Scorer";

  const [mobileInput, setMobileInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authAccepted, setAuthAccepted] = useState(false);
  const [lockAccepted, setLockAccepted] = useState(false);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewingComplete, setViewingComplete] = useState(false);
  const lockHeldRef = useRef(false);
  const releasedOnCompleteRef = useRef(false);

  async function ensureAuthAndLock(mobile?: string, pin?: string) {
    if (!tournamentId || !matchId) {
      setAuthError("Invalid match link");
      return;
    }
    setBusy(true);
    setAuthError("");
    try {
      let session = getScorerAuthSession();
      if (!session) {
        if (!mobile || !pin) {
          setAuthError("Sign in with mobile and PIN");
          return;
        }
        const login = await loginScorer(mobile.trim(), pin.trim());
        setScorerAuthSession({
          token: login.token,
          scorer: login.scorer,
          expiresAt: login.expiresAt,
        });
        session = getScorerAuthSession();
      }
      if (!session?.token) {
        setAuthError("Sign in required");
        return;
      }

      setAuthAccepted(true);
      const lock = await acquireScorerMatchLock(matchId, session.token, {
        tournamentId,
        sport: "badminton",
      });
      if (!lock.ok) {
        setLockAccepted(false);
        lockHeldRef.current = false;
        setAuthError(lock.message);
        return;
      }
      lockHeldRef.current = true;
      setLockAccepted(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Could not open scorer");
      setLockAccepted(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (authAccepted || busy) return;
    if (!tournamentId || !matchId) return;
    if (!getScorerAuthSession()) return;
    void ensureAuthAndLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId]);

  useEffect(() => {
    if (!lockAccepted || !matchId || viewingComplete) return;
    const token = getScorerAuthSession()?.token;
    if (!token) return;

    const tick = () => {
      void heartbeatScorerMatchLock(matchId, token).catch(() => {
        setAuthError("Connection lost — lock expired. Re-open the match.");
        setLockAccepted(false);
        lockHeldRef.current = false;
      });
    };
    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [lockAccepted, matchId, viewingComplete]);

  useEffect(() => {
    function releaseOnUnload() {
      if (!lockHeldRef.current || !matchId) return;
      const token = getScorerAuthSession()?.token;
      if (!token) return;
      lockHeldRef.current = false;
      const params = new URLSearchParams({
        tournamentId: String(tournamentId),
        sport: "badminton",
      });
      void fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/scorer/matches/${matchId}/lock?${params}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        },
      ).catch(() => {});
    }
    window.addEventListener("pagehide", releaseOnUnload);
    return () => {
      window.removeEventListener("pagehide", releaseOnUnload);
      if (!lockHeldRef.current || !matchId) return;
      const token = getScorerAuthSession()?.token;
      if (!token) return;
      void releaseScorerMatchLock(matchId, token, { tournamentId, sport: "badminton" });
      lockHeldRef.current = false;
    };
  }, [matchId, tournamentId]);

  const ready = authAccepted && (lockAccepted || viewingComplete);

  const { data, isLoading, error } = useBadmintonMatch(
    ready ? tournamentId : 0,
    ready ? matchId : 0,
  );

  const scorer = useBadmintonScorer(tournamentId, matchId);
  const director = useBadmintonDirector(tournamentId, matchId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const tournamentName =
    branding?.displayName ?? (tournamentId ? `Tournament #${tournamentId}` : "Badminton");
  const matchDetail = data?.detail as Record<string, unknown> | null | undefined;
  const courtNumber = matchDetail?.courtNumber ? String(matchDetail.courtNumber) : undefined;
  const categoryName =
    typeof matchDetail?.categoryName === "string"
      ? matchDetail.categoryName
      : typeof matchDetail?.roundName === "string"
        ? matchDetail.roundName
        : undefined;

  async function exitScorer(logout = false) {
    const token = getScorerAuthSession()?.token;
    if (token && matchId && lockHeldRef.current) {
      await releaseScorerMatchLock(matchId, token, { tournamentId, sport: "badminton" });
      lockHeldRef.current = false;
    }
    setLockAccepted(false);
    if (logout && token) {
      await logoutScorer(token);
      clearScorerAuthSession();
      setAuthAccepted(false);
    }
    if (tournamentId > 0) {
      navigate(badmintonScorerHomePath(tournamentId));
    }
  }

  // Sprint 2 leftover — keep complete screen after server releases the lock.
  useEffect(() => {
    if (!ready || !data?.state) return;
    const status = (data.state as BadmintonMatchState).matchStatus;
    if (!TERMINAL_STATUSES.has(status)) return;
    setViewingComplete(true);
    if (releasedOnCompleteRef.current || !lockHeldRef.current) return;
    releasedOnCompleteRef.current = true;
    const token = getScorerAuthSession()?.token;
    if (!token) return;
    void releaseScorerMatchLock(matchId, token, { tournamentId, sport: "badminton" }).then(() => {
      lockHeldRef.current = false;
      setLockAccepted(false);
    });
  }, [ready, data?.state?.matchStatus, matchId, tournamentId]);

  if (!ready) {
    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <BadmintonPublicBrandMark variant="scorer-bar" />
              </div>
              <h1 className="text-white text-2xl font-black">{accessTitle}</h1>
              <p className="text-white/40 text-sm mt-2">
                Sign in with your mobile and personal PIN
              </p>
            </div>

            <div className="space-y-4">
              {!getScorerAuthSession() ? (
                <>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
                    placeholder="Mobile number"
                    className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-xl font-bold tracking-wide placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    maxLength={10}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void ensureAuthAndLock(mobileInput, pinInput);
                    }}
                    placeholder="Personal PIN"
                    className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-3xl font-black tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40"
                    maxLength={8}
                  />
                </>
              ) : null}

              {authError ? (
                <p className="text-red-400 text-sm text-center" role="alert">
                  {authError}
                </p>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={() => void ensureAuthAndLock(mobileInput, pinInput)}
                className="w-full h-16 rounded-lg bg-primary text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)] disabled:opacity-50"
              >
                {busy ? "Opening…" : getScorerAuthSession() ? "Retry lock" : accessButton}
              </button>

              {tournamentId > 0 ? (
                <Link
                  href={badmintonScorerHomePath(tournamentId)}
                  className="block text-center text-white/40 text-sm hover:text-white/70 py-2"
                >
                  Open Scorer Home
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  if (isLoading) {
    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#4fc3f7]/30 border-t-[#4fc3f7] rounded-full animate-spin" />
            <p className="text-white/40 text-sm">Loading match…</p>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  if (error || !data?.state) {
    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-white/60 text-lg font-semibold">Match not found</p>
            <button
              type="button"
              onClick={() => void exitScorer(false)}
              className="mt-6 px-6 py-3 rounded-xl bg-white/8 border border-white/10 text-white/60 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  const state = data.state as BadmintonMatchState;

  if (state.matchStatus === "scheduled") {
    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <ScorerStartMatchPanel
            tournamentId={tournamentId}
            matchId={matchId}
            detail={matchDetail}
            onStart={scorer.startMatch}
            onBack={() => void exitScorer(false)}
          />
        </div>
      </FullscreenLayout>
    );
  }

  // Sprint 2 / S2-03 — stay on a complete screen until the scorer exits explicitly.
  if (TERMINAL_STATUSES.has(state.matchStatus)) {
    const leftLabel = formatTeamPlayerLine(identityFromSideInfo(state.leftSide));
    const rightLabel = formatTeamPlayerLine(identityFromSideInfo(state.rightSide));
    const winnerLabel =
      state.winnerSide === "left"
        ? leftLabel
        : state.winnerSide === "right"
          ? rightLabel
          : null;

    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-6">
            <BadmintonPublicBrandMark variant="scorer-bar" className="mx-auto" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                {terminalStatusLabel(state.matchStatus)}
              </p>
              <h1 className="text-white text-3xl font-black mt-2">
                {winnerLabel ? `${winnerLabel} wins` : "Match finished"}
              </h1>
              <p className="text-white/55 text-lg font-semibold mt-3 tabular-nums">
                {state.gamesLeft} – {state.gamesRight}
              </p>
              {state.resultReason ? (
                <p className="text-white/35 text-sm mt-2">{state.resultReason}</p>
              ) : null}
              {courtNumber || categoryName ? (
                <p className="text-white/35 text-xs mt-3">
                  {[courtNumber ? `Court ${courtNumber}` : null, categoryName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Left</p>
                <p className="text-white font-semibold mt-1 truncate">{leftLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Right</p>
                <p className="text-white font-semibold mt-1 truncate">{rightLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void exitScorer(false)}
              className="w-full min-h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base"
            >
              Exit to Scorer Home
            </button>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout className="lovable-theme">
      <div className="h-[100dvh] overflow-hidden flex flex-col">
        {tournamentId > 0 ? (
          <div className="shrink-0 px-3 py-1.5 border-b border-border/60 bg-card/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void exitScorer(false)}
              className="min-h-10 inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              ← All matches
            </button>
            <button
              type="button"
              onClick={() => void exitScorer(true)}
              className="min-h-10 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Logout
            </button>
          </div>
        ) : null}
        {!scorer.isOnline ? (
          <div
            className="shrink-0 px-3 py-2 bg-amber-500/15 border-b border-amber-500/30"
            role="status"
          >
            <p className="text-amber-100 text-xs font-semibold">
              Offline — points stay on this device
              {scorer.pendingPointCount > 0
                ? ` (${scorer.pendingPointCount} queued)`
                : ""}
              {" "}and sync when you reconnect.
            </p>
          </div>
        ) : null}
        {scorer.isOnline && scorer.pointSyncError ? (
          <div
            className="shrink-0 px-3 py-2 bg-red-500/15 border-b border-red-500/30 flex items-center justify-between gap-3"
            role="alert"
          >
            <p className="text-red-200 text-xs font-semibold min-w-0 truncate">
              {scorer.pointSyncError}
            </p>
            <button
              type="button"
              onClick={() => void scorer.retryPointQueue()}
              className="shrink-0 min-h-9 px-3 rounded-lg bg-red-500/25 text-red-100 text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScorerAssistanceShell
            state={state}
            tournamentName={tournamentName}
            courtNumber={courtNumber}
            categoryName={categoryName}
            consoleTitle={consoleTitle}
            onAwardPoint={scorer.awardPoint}
            onStartInterval={scorer.startInterval}
            onEndInterval={scorer.endInterval}
            onAcknowledgeCourtChange={scorer.acknowledgeCourtChange}
          >
            {({ scoringBlocked, onAwardPoint }) => (
              <ScorerPanel
                tournamentId={tournamentId}
                matchId={matchId}
                state={state}
                onAwardPoint={onAwardPoint}
                onUndo={scorer.undo}
                onStartTimeout={scorer.startTimeout}
                onEndTimeout={scorer.endTimeout}
                onRetirement={director.retirement}
                onWalkover={director.walkover}
                scoringBlocked={scoringBlocked}
              />
            )}
          </ScorerAssistanceShell>
        </div>
      </div>
    </FullscreenLayout>
  );
}
