/**
 * Badminton Scorer Page
 * Route: /badminton/:matchId/score?pin=XXX&tid=YYY
 *
 * PIN-protected scorer interface for court-side volunteers.
 * Optimized for mobile phones and tablets.
 *
 * PIN may come from: URL ?pin=, Scorer Home session, or manual entry.
 * Existing direct URLs continue to work unchanged.
 */

import { useState, useEffect } from "react";
import { useSearch, useRoute, Link } from "wouter";
import { ScorerPanel } from "@/components/badminton/scorer-panel";
import { UmpireAssistanceShell } from "@/components/badminton/umpire-assistance-shell";
import { useBadmintonMatch, useBadmintonDirector, useBadmintonScorer } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { verifyBadmintonScorerPin } from "@/lib/badminton-api";
import {
  clearBadmintonScorerSession,
  getBadmintonScorerSession,
  setBadmintonScorerSession,
} from "@/lib/badminton-scorer-session";
import { badmintonScorerHomePath } from "@/lib/badminton-routes";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { FullscreenLayout } from "@/components/layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";

export default function BadmintonScorerPage() {
  const [, params] = useRoute("/badminton/:matchId/score");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const pin = searchParams.get("pin") ?? undefined;
  const session = tournamentId > 0 ? getBadmintonScorerSession(tournamentId) : null;
  const hasScorerHomeSession = !!session;

  const [pinInput, setPinInput] = useState(pin ?? session?.pin ?? "");
  const [pinAccepted, setPinAccepted] = useState(false);
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  async function submitPin(candidate: string, persistSession = true) {
    if (candidate.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    if (!tournamentId || !matchId) {
      setPinError("Invalid match link");
      return;
    }
    setVerifyingPin(true);
    setPinError("");
    try {
      const ok = await verifyBadmintonScorerPin(tournamentId, matchId, candidate);
      if (!ok) {
        setPinError("Incorrect PIN for this match");
        return;
      }
      setPinInput(candidate);
      setPinAccepted(true);
      if (persistSession) {
        setBadmintonScorerSession(tournamentId, candidate);
      }
    } finally {
      setVerifyingPin(false);
    }
  }

  useEffect(() => {
    if (pinAccepted || verifyingPin || !tournamentId || !matchId) return;
    const candidate = pin ?? session?.pin;
    if (!candidate) return;
    void submitPin(candidate, true);
    // Only attempt URL/session pin once on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, error } = useBadmintonMatch(
    pinAccepted ? tournamentId : 0,
    pinAccepted ? matchId : 0,
  );

  const scorer = useBadmintonScorer(tournamentId, matchId, pinInput);
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

  if (!pinAccepted) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <BadmintonPublicBrandMark variant="scorer-bar" />
              </div>
              <h1 className="text-white text-2xl font-black">Scorer Access</h1>
              <p className="text-white/40 text-sm mt-2">Enter your scorer PIN to continue</p>
            </div>

            <div className="space-y-4">
              <input
                type="tel"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void submitPin(pinInput);
                  }
                }}
                placeholder="Enter PIN"
                className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-3xl font-black tracking-[0.5em] placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40 focus:bg-white/8"
                maxLength={8}
              />
              {pinError && (
                <p className="text-red-400 text-sm text-center">{pinError}</p>
              )}
              <button
                type="button"
                disabled={verifyingPin}
                onClick={() => void submitPin(pinInput)}
                className="w-full h-16 rounded-lg bg-primary text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)] hover-elevate transition-colors disabled:opacity-50"
              >
                {verifyingPin ? "Checking PIN…" : "Access Scorer"}
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
            <p className="text-white/30 text-sm mt-2">Check the match ID and tournament ID</p>
            <button
              onClick={() => setPinAccepted(false)}
              className="mt-6 px-6 py-3 rounded-xl bg-white/8 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/12"
            >
              Try Again
            </button>
            {tournamentId > 0 ? (
              <Link
                href={badmintonScorerHomePath(tournamentId)}
                className="block mt-4 text-white/40 text-sm hover:text-white/70"
              >
                Back to Scorer Home
              </Link>
            ) : null}
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  const state = data.state as BadmintonMatchState;

  // Scheduled matches must start from Match Control — block umpire bypass.
  if (state.matchStatus === "scheduled") {
    const controlHref =
      tournamentId > 0
        ? `/tournament/${tournamentId}/badminton/matches/${matchId}/control`
        : null;

    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-4">
            <h1 className="text-white text-xl font-bold">Match not started yet</h1>
            <p className="text-white/55 text-sm">
              The tournament director must start this match from Match Control before scoring
              opens. This prevents starting the wrong court or opening scoring twice.
            </p>
            {controlHref ? (
              <a
                href={controlHref}
                className="inline-flex items-center justify-center min-h-12 px-6 rounded-xl bg-amber-500/30 text-amber-50 font-bold"
              >
                Open Match Control
              </a>
            ) : (
              <p className="text-white/40 text-xs">Ask the organizer to start the match.</p>
            )}
            {tournamentId > 0 ? (
              <Link
                href={badmintonScorerHomePath(tournamentId)}
                className="block mx-auto mt-2 text-white/55 text-sm font-semibold hover:text-white/80"
              >
                Back to Scorer Home
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (hasScorerHomeSession) {
                  clearBadmintonScorerSession(tournamentId);
                }
                setPinAccepted(false);
              }}
              className="block mx-auto mt-2 text-white/40 text-sm hover:text-white/70"
            >
              Back to PIN
            </button>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="h-[100dvh] overflow-hidden flex flex-col">
        {tournamentId > 0 ? (
          <div className="shrink-0 px-3 py-1.5 border-b border-border/60 bg-card/80 flex items-center justify-between gap-2">
            <Link
              href={badmintonScorerHomePath(tournamentId)}
              className="min-h-10 inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              ← All matches
            </Link>
            <button
              type="button"
              onClick={() => {
                clearBadmintonScorerSession(tournamentId);
                setPinAccepted(false);
                setPinInput("");
              }}
              className="min-h-10 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Logout
            </button>
          </div>
        ) : null}
        <div className="flex-1 min-h-0 overflow-hidden">
          <UmpireAssistanceShell
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
          </UmpireAssistanceShell>
        </div>
      </div>
    </FullscreenLayout>
  );
}
