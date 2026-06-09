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
import { useBadmintonMatch, useBadmintonScorer } from "@/hooks/use-badminton-match";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { STANDARD_FORMAT } from "@workspace/badminton-core";
import { sideJsonToStartSide } from "@/components/badminton/pair-side-picker";
import { SidePlayerNames } from "@/components/badminton/side-players";
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
    return (
      <FullscreenLayout>
        <PreMatchSetup
          matchId={matchId}
          tournamentId={tournamentId}
          state={state}
          detail={data.detail}
          onStart={scorer.startMatch}
        />
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="relative h-screen overflow-hidden">
        <ScorerPanel
          tournamentId={tournamentId}
          matchId={matchId}
          state={state}
          onAwardPoint={scorer.awardPoint}
          onUndo={scorer.undo}
          onStartTimeout={scorer.startTimeout}
          onEndTimeout={scorer.endTimeout}
          onRetirement={scorer.retirement}
          onWalkover={scorer.walkover}
        />
      </div>
    </FullscreenLayout>
  );
}

// ── Pre-match setup ────────────────────────────────────────────────────────────

function PreMatchSetup({
  matchId,
  tournamentId,
  state,
  detail,
  onStart,
}: {
  matchId: number;
  tournamentId: number;
  state: BadmintonMatchState;
  detail: unknown;
  onStart: (payload: unknown) => Promise<BadmintonMatchState>;
}) {
  const d = detail as Record<string, unknown> | null;
  const leftSideJson = (d?.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (d?.rightSideJson ?? {}) as Record<string, unknown>;
  const matchType = (d?.matchType as string) ?? "singles";

  const [firstServer, setFirstServer] = useState<"left" | "right">("left");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      await onStart({
        matchKind: matchType,
        format: STANDARD_FORMAT,
        leftSide: sideJsonToStartSide(leftSideJson),
        rightSide: sideJsonToStartSide(rightSideJson),
        firstServer,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start match");
    } finally {
      setStarting(false);
    }
  }

  const leftSide = sideJsonToStartSide(leftSideJson);
  const rightSide = sideJsonToStartSide(rightSideJson);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/25 rounded-full px-4 py-1.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Pre-Match</span>
          </div>
          <h1 className="text-white text-2xl font-black">Ready to Start</h1>
          <p className="text-white/40 text-sm mt-1">Select who serves first</p>
        </div>

        {/* Match info */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1">
              <SidePlayerNames info={leftSide} matchKind={matchType} side="left" stacked className="text-lg" />
            </div>
            <span className="text-white/30 text-sm font-light">vs</span>
            <div className="flex-1">
              <SidePlayerNames info={rightSide} matchKind={matchType} side="right" stacked className="text-lg" />
            </div>
          </div>
          <p className="text-center text-white/30 text-xs mt-2 uppercase tracking-widest">
            {matchType.replace("_", " ")} • Best of 3
          </p>
        </div>

        {/* First server selection */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3 text-center">
            Who serves first?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFirstServer("left")}
              className={`h-20 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all border ${
                firstServer === "left"
                  ? "bg-[#0070f3]/20 border-[#0070f3]/50 text-white"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              {firstServer === "left" && (
                <div className="w-3 h-3 rounded-full bg-[#ffd700] mb-1 animate-pulse" />
              )}
              <span className="truncate max-w-[120px] px-2 text-center">{leftSide.shortLabel}</span>
            </button>
            <button
              onClick={() => setFirstServer("right")}
              className={`h-20 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all border ${
                firstServer === "right"
                  ? "bg-[#7c3aed]/20 border-[#7c3aed]/50 text-white"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              {firstServer === "right" && (
                <div className="w-3 h-3 rounded-full bg-[#ffd700] mb-1 animate-pulse" />
              )}
              <span className="truncate max-w-[120px] px-2 text-center">{rightSide.shortLabel}</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full h-16 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-black text-lg transition-colors flex items-center justify-center gap-3"
        >
          {starting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Start Match
            </>
          )}
        </button>
      </div>
    </div>
  );
}
