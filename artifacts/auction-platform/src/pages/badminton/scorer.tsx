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
import { FullscreenLayout } from "@/components/layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";

const HEARTBEAT_MS = 20_000;

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
  const [busy, setBusy] = useState(false);
  const lockHeldRef = useRef(false);

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
    if (!lockAccepted || !matchId) return;
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
  }, [lockAccepted, matchId]);

  useEffect(() => {
    return () => {
      if (!lockHeldRef.current || !matchId) return;
      const token = getScorerAuthSession()?.token;
      if (!token) return;
      void releaseScorerMatchLock(matchId, token, { tournamentId, sport: "badminton" });
      lockHeldRef.current = false;
    };
  }, [matchId, tournamentId]);

  const ready = authAccepted && lockAccepted;

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

  // Navigate home when match finishes
  useEffect(() => {
    if (!ready || !data?.state) return;
    const status = (data.state as BadmintonMatchState).matchStatus;
    if (
      status === "completed" ||
      status === "walkover" ||
      status === "retired" ||
      status === "disqualified" ||
      status === "abandoned"
    ) {
      void exitScorer(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.state?.matchStatus]);

  if (!ready) {
    return (
      <FullscreenLayout>
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
      <FullscreenLayout>
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
      <FullscreenLayout>
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
      <FullscreenLayout>
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

  return (
    <FullscreenLayout>
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
        <div className="flex-1 min-h-0 overflow-hidden">
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
        </div>
      </div>
    </FullscreenLayout>
  );
}
