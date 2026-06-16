/**
 * Badminton Scorer Page
 * Route: /badminton/:matchId/score?pin=XXX&tid=YYY
 *
 * PIN-protected scorer interface for court-side volunteers.
 * Optimized for mobile phones and tablets.
 */

import { useState } from "react";
import { useSearch, useRoute } from "wouter";
import { ScorerPanel } from "@/components/badminton/scorer-panel";
import { UmpireAssistanceShell } from "@/components/badminton/umpire-assistance-shell";
import {
  DoublesPreMatchSetup,
  SinglesPreMatchSetup,
  isDoublesMatchType,
} from "@/components/badminton/doubles-pre-match-setup";
import { useBadmintonMatch, useBadmintonScorer } from "@/hooks/use-badminton-match";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { FullscreenLayout } from "@/components/layout";

export default function BadmintonScorerPage() {
  const [, params] = useRoute("/badminton/:matchId/score");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const pin = searchParams.get("pin") ?? undefined;

  const [pinInput, setPinInput] = useState(pin ?? "");
  const [pinAccepted, setPinAccepted] = useState(!!pin);
  const [pinError, setPinError] = useState("");

  const { data, isLoading, error } = useBadmintonMatch(
    pinAccepted ? tournamentId : 0,
    pinAccepted ? matchId : 0,
  );

  const scorer = useBadmintonScorer(tournamentId, matchId, pinInput);

  if (!pinAccepted) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#4fc3f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
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
                    if (pinInput.length >= 4) {
                      setPinAccepted(true);
                    } else {
                      setPinError("PIN must be at least 4 digits");
                    }
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
                onClick={() => {
                  if (pinInput.length >= 4) {
                    setPinAccepted(true);
                    setPinError("");
                  } else {
                    setPinError("PIN must be at least 4 digits");
                  }
                }}
                className="w-full h-16 rounded-2xl bg-[#0070f3] hover:bg-[#0060d3] text-white font-black text-lg transition-colors"
              >
                Access Scorer
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
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
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
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
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
        {isDoubles ? (
          <DoublesPreMatchSetup
            state={state}
            detail={data.detail}
            onStart={scorer.startMatch}
          />
        ) : (
          <SinglesPreMatchSetup detail={data.detail} onStart={scorer.startMatch} />
        )}
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="relative h-screen overflow-hidden">
        <UmpireAssistanceShell
          state={state}
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
