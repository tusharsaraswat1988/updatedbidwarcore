/**
 * Badminton Scorer Page
 * Route: /badminton/:matchId/score?tid=YYY
 *
 * Requires Scorer JWT (mobile + personal PIN login). Acquires match lock
 * before entering the console; heartbeats while open; unlocks on exit/finish.
 */

import { useState, useEffect, useRef } from "react";
import { useSearch, useRoute, Link, useLocation } from "wouter";
import { ScorerPanel } from "@/components/badminton/scorer-panel";
import { ScorerAssistanceShell } from "@/components/badminton/scorer-assistance-shell";
import { ScorerStartMatchPanel } from "@/components/badminton/scorer-start-match";
import {
  canShowEditToss,
  ScorerEditTossPanel,
} from "@/components/badminton/scorer-edit-toss-panel";
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

/** Map raw API lock/sync errors into umpire-friendly copy. */
function friendlyScorerSyncError(message: string): { text: string; isLock: boolean } {
  const lower = message.toLowerCase();
  if (
    lower.includes("match lock required") ||
    lower.includes("lock_not_found") ||
    lower.includes("lock expired") ||
    lower.includes("connection lost")
  ) {
    return {
      text: "Scoring paused — this device lost the match lock. Tap Reconnect to continue scoring.",
      isLock: true,
    };
  }
  if (lower.includes("held by") || lower.includes("already locked")) {
    return {
      text: message,
      isLock: true,
    };
  }
  return { text: message, isLock: false };
}

export default function BadmintonScorerPage() {
  const [, params] = useRoute("/badminton/:matchId/score");
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");

  const [mobileInput, setMobileInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authAccepted, setAuthAccepted] = useState(false);
  const [lockAccepted, setLockAccepted] = useState(false);
  const [authError, setAuthError] = useState("");
  // Never seed busy=true from session — that blocked the auto-lock effect forever
  // ("Opening scorer console…" with no Back / no progress on Resume Match).
  const [busy, setBusy] = useState(false);
  const [viewingComplete, setViewingComplete] = useState(false);
  const [editingToss, setEditingToss] = useState(false);
  const lockHeldRef = useRef(false);
  const releasedOnCompleteRef = useRef(false);
  const autoLockAttemptedRef = useRef(false);

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
    if (authAccepted || lockAccepted) return;
    if (!tournamentId || !matchId) return;
    if (!getScorerAuthSession()) return;
    if (autoLockAttemptedRef.current) return;
    autoLockAttemptedRef.current = true;
    void ensureAuthAndLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId, authAccepted, lockAccepted]);

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
    setBusy(true);
    try {
      // Final points must reach the server before unlock — otherwise home stays LIVE.
      try {
        await scorer.ensurePointsSynced();
      } catch {
        setAuthError(
          scorer.pointSyncError ??
            "Final score not saved yet. Tap Retry, then exit again.",
        );
        return;
      }

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
    } finally {
      setBusy(false);
    }
  }

  async function reconnectAndRetry() {
    setBusy(true);
    try {
      const token = getScorerAuthSession()?.token;
      if (!token) {
        setAuthError("Sign in required");
        setAuthAccepted(false);
        setLockAccepted(false);
        return;
      }
      const lock = await acquireScorerMatchLock(matchId, token, {
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
      setAuthError("");
      await scorer.retryPointQueue();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Could not reconnect");
    } finally {
      setBusy(false);
    }
  }

  const pointsUnsynced =
    scorer.pendingPointCount > 0 || scorer.pointsSyncing || Boolean(scorer.pointSyncError);

  // Release lock only after the terminal result is synced — early unlock drops
  // queued MATCH_ENDED points and leaves Scorer Home stuck on Resume Live.
  useEffect(() => {
    if (!ready || !data?.state) return;
    const status = (data.state as BadmintonMatchState).matchStatus;
    if (!TERMINAL_STATUSES.has(status)) return;
    setViewingComplete(true);
    if (pointsUnsynced) return;
    if (releasedOnCompleteRef.current || !lockHeldRef.current) return;
    releasedOnCompleteRef.current = true;
    const token = getScorerAuthSession()?.token;
    if (!token) return;
    void releaseScorerMatchLock(matchId, token, { tournamentId, sport: "badminton" }).then(() => {
      lockHeldRef.current = false;
      setLockAccepted(false);
    });
  }, [
    ready,
    data?.state?.matchStatus,
    matchId,
    tournamentId,
    pointsUnsynced,
  ]);

  if (!ready) {
    if (busy && getScorerAuthSession() && !authError) {
      return (
        <FullscreenLayout className="lovable-theme">
          <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-4">
            <BadmintonPublicBrandMark variant="scorer-bar" />
            <p className="text-white/50 text-sm mt-2">Opening scorer console…</p>
            {tournamentId > 0 ? (
              <Link
                href={badmintonScorerHomePath(tournamentId)}
                className="text-white/45 text-sm hover:text-white/70 underline-offset-2 hover:underline"
              >
                Cancel · Back to Scorer Home
              </Link>
            ) : null}
          </div>
        </FullscreenLayout>
      );
    }

    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <BadmintonPublicBrandMark variant="scorer-bar" />
              </div>
              <h1 className="text-white text-2xl font-black">Scorer Access</h1>
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
                {busy ? "Opening…" : getScorerAuthSession() ? "Retry lock" : "Access Scorer"}
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
    const completedGames = (state.games ?? []).filter((g) => g.phase === "completed");

    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-5">
            <BadmintonPublicBrandMark variant="scorer-bar" className="mx-auto" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                Match summary · {terminalStatusLabel(state.matchStatus)}
              </p>
              <h1 className="text-foreground text-2xl sm:text-3xl font-black mt-2 leading-tight">
                {winnerLabel ? `${winnerLabel} wins` : "Match finished"}
              </h1>
              <p className="text-primary text-3xl font-black mt-3 tabular-nums">
                {state.gamesLeft} – {state.gamesRight}
              </p>
              <p className="text-muted-foreground text-sm mt-1">Games won</p>
              {state.resultReason && state.resultReason !== "normal" ? (
                <p className="text-muted-foreground text-sm mt-2 capitalize">{state.resultReason}</p>
              ) : null}
              {tournamentName ? (
                <p className="text-muted-foreground text-xs mt-3 truncate" title={tournamentName}>
                  {tournamentName}
                </p>
              ) : null}
              {courtNumber || categoryName ? (
                <p className="text-muted-foreground text-xs mt-1">
                  {[courtNumber ? `Court ${courtNumber}` : null, categoryName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-xl border border-border bg-card/80 px-3 py-3 min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">End 1</p>
                <p className="text-foreground font-semibold mt-1 break-words">{leftLabel}</p>
              </div>
              <div className="rounded-xl border border-border bg-card/80 px-3 py-3 min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">End 2</p>
                <p className="text-foreground font-semibold mt-1 break-words">{rightLabel}</p>
              </div>
            </div>

            {completedGames.length > 0 ? (
              <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-left">
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">
                  Game scores
                </p>
                <ul className="space-y-2">
                  {completedGames.map((game) => (
                    <li
                      key={game.gameNumber}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">Game {game.gameNumber}</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {game.leftScore} – {game.rightScore}
                      </span>
                      <span className="text-[11px] text-muted-foreground w-16 text-right">
                        {game.winner === "left"
                          ? "End 1"
                          : game.winner === "right"
                            ? "End 2"
                            : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {scorer.pendingPointCount > 0 || scorer.pointsSyncing ? (
              <p className="text-amber-200/90 text-sm font-semibold" role="status">
                Saving final score to server…
              </p>
            ) : null}

            {scorer.pointSyncError ? (
              <div
                className="rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-3 text-left space-y-2"
                role="alert"
              >
                <p className="text-destructive-foreground text-xs font-semibold">
                  {friendlyScorerSyncError(scorer.pointSyncError).text}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const { isLock } = friendlyScorerSyncError(scorer.pointSyncError!);
                    if (isLock) void reconnectAndRetry();
                    else void scorer.retryPointQueue();
                  }}
                  className="w-full min-h-11 rounded-lg bg-destructive/25 text-destructive-foreground text-sm font-bold disabled:opacity-50"
                >
                  {busy ? "…" : "Retry save"}
                </button>
              </div>
            ) : null}

            {authError ? (
              <p className="text-red-400 text-sm" role="alert">
                {authError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || pointsUnsynced}
              onClick={() => void exitScorer(false)}
              className="w-full min-h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              {scorer.pointsSyncing || scorer.pendingPointCount > 0
                ? "Saving…"
                : scorer.pointSyncError
                  ? "Save failed — retry above"
                  : "Exit to Scorer Home"}
            </button>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout className="lovable-theme h-[100dvh] min-h-0 overflow-hidden">
      <div className="h-full min-h-0 overflow-hidden flex flex-col bg-background overscroll-none">
        {tournamentId > 0 ? (
          <div className="shrink-0 px-3 py-1.5 border-b border-border bg-card/80 flex items-center justify-between gap-2">
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
        {scorer.pointSyncError ? (
          <div
            className="shrink-0 px-3 py-2.5 bg-destructive/15 border-b border-destructive/30 flex items-center justify-between gap-3"
            role="alert"
          >
            <p className="text-destructive-foreground text-xs font-semibold min-w-0">
              {friendlyScorerSyncError(scorer.pointSyncError).text}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const { isLock } = friendlyScorerSyncError(scorer.pointSyncError!);
                if (isLock) {
                  void reconnectAndRetry();
                } else {
                  void scorer.retryPointQueue();
                }
              }}
              className="shrink-0 min-h-9 px-3 rounded-lg bg-destructive/25 text-destructive-foreground text-xs font-bold disabled:opacity-50"
            >
              {busy
                ? "…"
                : friendlyScorerSyncError(scorer.pointSyncError).isLock
                  ? "Reconnect"
                  : "Retry"}
            </button>
          </div>
        ) : null}
        {canShowEditToss(state) && !editingToss ? (
          <div className="shrink-0 px-3 py-2 border-b border-border bg-cyan-500/10">
            <button
              type="button"
              onClick={() => setEditingToss(true)}
              className="w-full min-h-11 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-sm font-bold"
            >
              Edit Toss
            </button>
            <p className="text-cyan-100/70 text-[11px] text-center mt-1.5">
              Change serve setup or swap court ends, then continue scoring.
            </p>
          </div>
        ) : null}
        <div className="flex-1 min-h-0 overflow-hidden">
          {editingToss ? (
            <ScorerEditTossPanel
              state={state}
              onCancel={() => setEditingToss(false)}
              onCorrectToss={async (payload) => {
                await scorer.correctToss(payload);
                setEditingToss(false);
              }}
            />
          ) : (
            <ScorerAssistanceShell
              state={state}
              tournamentName={tournamentName}
              courtNumber={courtNumber}
              categoryName={categoryName}
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
          )}
        </div>
      </div>
    </FullscreenLayout>
  );
}
