/**
 * Badminton Scorer Page
 * Route: /badminton/:matchId/score?pin=XXX&tid=YYY
 *
 * PIN-protected scorer interface for court-side volunteers.
 * Optimized for mobile phones and tablets.
 */

import { useState, useEffect } from "react";
import { useSearch, useRoute } from "wouter";
import { ScorerPanel } from "@/components/badminton/scorer-panel";
import { UmpireAssistanceShell } from "@/components/badminton/umpire-assistance-shell";
import {
  DoublesPreMatchSetup,
  SinglesPreMatchSetup,
  isDoublesMatchType,
} from "@/components/badminton/doubles-pre-match-setup";
import { useBadmintonMatch, useBadmintonScorer } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { verifyBadmintonScorerPin } from "@/lib/badminton-api";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { FullscreenLayout } from "@/components/layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { ScorerConsoleHeader } from "@/components/badminton/scorer-console-header";

export default function BadmintonScorerPage() {
  const [, params] = useRoute("/badminton/:matchId/score");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const pin = searchParams.get("pin") ?? undefined;

  const [pinInput, setPinInput] = useState(pin ?? "");
  const [pinAccepted, setPinAccepted] = useState(false);
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  async function submitPin(candidate: string) {
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
    } finally {
      setVerifyingPin(false);
    }
  }

  useEffect(() => {
    if (!pin || !tournamentId || !matchId || pinAccepted || verifyingPin) return;
    void submitPin(pin);
    // Only attempt URL pin once on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, error } = useBadmintonMatch(
    pinAccepted ? tournamentId : 0,
    pinAccepted ? matchId : 0,
  );

  const scorer = useBadmintonScorer(tournamentId, matchId, pinInput);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const tournamentName =
    branding?.displayName ?? (tournamentId ? `Tournament #${tournamentId}` : "Badminton");
  const matchDetail = data?.detail as Record<string, unknown> | null | undefined;
  const courtNumber = matchDetail?.courtNumber ? String(matchDetail.courtNumber) : undefined;

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
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  const state = data.state as BadmintonMatchState;

  // If match is scheduled (not started), show pre-match setup
  if (state.matchStatus === "scheduled") {
    const matchType = ((data.detail as Record<string, unknown> | null)?.matchType as string) ?? state.matchKind;
    const isDoubles = isDoublesMatchType(matchType);

    return (
      <FullscreenLayout>
        <div className="relative flex flex-col min-h-[100dvh] bg-background">
          <ScorerConsoleHeader
            tournamentName={tournamentName}
            courtNumber={courtNumber}
            voiceEnabled={false}
            onToggleVoice={() => {}}
            showVoiceToggle={false}
            showBrandMark={false}
            className="relative z-10"
          />
          <div className="flex-1 flex flex-col min-h-0">
            {isDoubles ? (
              <DoublesPreMatchSetup
                state={state}
                detail={data.detail}
                onStart={scorer.startMatch}
              />
            ) : (
              <SinglesPreMatchSetup detail={data.detail} onStart={scorer.startMatch} />
            )}
          </div>
          <footer className="shrink-0 border-t border-border bg-card/90 px-4 py-3 flex justify-center">
            <BadmintonPublicBrandMark variant="footer" />
          </footer>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="h-[100dvh] overflow-hidden">
        <UmpireAssistanceShell
          state={state}
          tournamentName={tournamentName}
          courtNumber={courtNumber}
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
              onRetirement={scorer.retirement}
              onWalkover={scorer.walkover}
              scoringBlocked={scoringBlocked}
            />
          )}
        </UmpireAssistanceShell>
      </div>
    </FullscreenLayout>
  );
}
