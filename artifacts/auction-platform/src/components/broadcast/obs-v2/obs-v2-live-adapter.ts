/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Live Cricket Data Adapter
 *
 * Pure transformation layer:
 * Authoritative Production Cricket Live State / ViewModel
 *                 ↓
 * Broadcast-Friendly ObsV2StageData
 *
 * Responsibilities:
 * - Maps live innings score (runs, wickets, overs).
 * - Maps team identities (name, shortCode, colors, logos).
 * - Maps target, chase equations (needRuns, ballsRemaining), and run rates (CRR, RRR).
 * - Maps match lifecycle phases (live, chase, pre_match, innings_break, completed, no_live).
 * - Guards against NaN, undefined, broken data, or fake placeholder metrics during live mode.
 * - Handles loading and standby states cleanly without disrupting the camera viewport.
 */

import type { CricketObsTeamView, CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import type { ObsV2ScorebugData, ObsV2StageData, ObsV2TeamInfo } from "./types";

/**
 * Normalizes a cricket team view into V2 broadcast team info.
 */
export function mapCricketTeamToObsV2(
  team: CricketObsTeamView | null | undefined,
  fallbackShortCode = "TBD",
): ObsV2TeamInfo | null {
  if (!team) return null;

  const shortCode =
    team.shortCode?.trim() ||
    team.name?.trim().slice(0, 3).toUpperCase() ||
    fallbackShortCode;

  // Filter out data: URLs which can be invalid or broken in OBS browser source
  const validLogo =
    team.logoUrl && !team.logoUrl.startsWith("data:") ? team.logoUrl : null;

  return {
    name: team.name || shortCode,
    shortCode,
    color: team.color || undefined,
    logoUrl: validLogo,
  };
}

/**
 * Transforms an authoritative CricketObsViewModel into ObsV2StageData.
 *
 * @param vm Authoritative Cricket OBS view-model from useCricketObsLive
 * @param isLoading Whether live scoring feed is currently connecting / syncing
 * @returns Clean, normalized ObsV2StageData for ObsV2Stage
 */
export function cricketVmToObsV2StageData(
  vm: CricketObsViewModel,
  isLoading = false,
): ObsV2StageData {
  const tournamentName = vm.tournamentName?.trim() || "BidWar Cricket";
  const tournamentLogoUrl =
    vm.tournamentLogoUrl && !vm.tournamentLogoUrl.startsWith("data:")
      ? vm.tournamentLogoUrl
      : null;

  // 1. Initial Feed Connecting / Loading State
  if (isLoading && vm.phase === "no_live") {
    return {
      header: {
        tournamentName,
        tournamentLogoUrl,
        matchContext: "CONNECTING FEED...",
        live: false,
        statusLabel: "SYNCING",
      },
      scorebug: {
        phase: "loading",
        isLoading: true,
        statusText: "CONNECTING TO LIVE CRICKET FEED...",
      },
      phase: "loading",
      isLoading: true,
      connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    };
  }

  // 2. No Active Match on Feed
  if (vm.phase === "no_live" || vm.phase === "match_unavailable") {
    return {
      header: {
        tournamentName,
        tournamentLogoUrl,
        matchContext: vm.venueText || "Broadcast Standby",
        live: false,
        statusLabel: vm.connectionHint === "reconnecting" ? "RECONNECTING" : "STANDBY",
      },
      scorebug: {
        phase: "no_live",
        isLoading: false,
        battingTeam: null,
        bowlingTeam: null,
        runs: null,
        wickets: null,
        overs: null,
        statusText: "WAITING FOR NEXT MATCH",
      },
      phase: "no_live",
      isLoading: false,
      connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    };
  }

  // 3. Pre-Match / Build-up State
  if (vm.phase === "pre_match") {
    const homeTeam = mapCricketTeamToObsV2(vm.home, "HOM");
    const awayTeam = mapCricketTeamToObsV2(vm.away, "AWY");
    const battingTeam = vm.batting ? mapCricketTeamToObsV2(vm.batting) : homeTeam;
    const bowlingTeam = vm.bowling ? mapCricketTeamToObsV2(vm.bowling) : awayTeam;

    const preMatchTitle =
      homeTeam && awayTeam
        ? `${homeTeam.shortCode} VS ${awayTeam.shortCode}`
        : "MATCH BUILD-UP";

    return {
      header: {
        tournamentName,
        tournamentLogoUrl,
        matchContext: vm.venueText || preMatchTitle,
        live: false,
        statusLabel: "PRE-MATCH",
      },
      scorebug: {
        phase: "pre_match",
        isLoading: false,
        battingTeam,
        bowlingTeam,
        runs: null,
        wickets: null,
        overs: null,
        statusText: vm.tossText || "MATCH STARTING SOON",
      },
      phase: "pre_match",
      isLoading: false,
      connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    };
  }

  // Resolve Active Teams
  const batting = mapCricketTeamToObsV2(vm.batting || vm.home, "BAT");
  const bowling = mapCricketTeamToObsV2(vm.bowling || vm.away, "BWL");

  // 4. Completed Match State
  if (vm.phase === "completed") {
    const winnerTeam = vm.winner ? mapCricketTeamToObsV2(vm.winner) : null;
    const resultBanner =
      vm.resultHeadline ||
      vm.resultText ||
      (winnerTeam ? `${winnerTeam.name} WON` : "MATCH COMPLETED");

    return {
      header: {
        tournamentName,
        tournamentLogoUrl,
        matchContext: vm.venueText || "Match Completed",
        live: false,
        statusLabel: "FINAL",
      },
      scorebug: {
        phase: "completed",
        isLoading: false,
        battingTeam: batting,
        bowlingTeam: bowling,
        runs: vm.runs,
        wickets: vm.wickets,
        overs: vm.oversDisplay || "0.0",
        maxOvers: vm.oversLimit > 0 ? vm.oversLimit : undefined,
        target: vm.target != null && vm.target > 0 ? vm.target : null,
        crr: vm.crr || null,
        statusText: resultBanner,
      },
      phase: "completed",
      isLoading: false,
      connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    };
  }

  // 5. Innings Break State
  if (vm.phase === "innings_break") {
    const targetValue = vm.target != null && vm.target > 0 ? vm.target : vm.runs + 1;
    const breakStatus =
      vm.firstInningsScoreLine || `INNINGS BREAK · TARGET ${targetValue}`;

    return {
      header: {
        tournamentName,
        tournamentLogoUrl,
        matchContext: vm.venueText || "Innings Break",
        live: false,
        statusLabel: "BREAK",
      },
      scorebug: {
        phase: "innings_break",
        isLoading: false,
        battingTeam: batting,
        bowlingTeam: bowling,
        runs: vm.runs,
        wickets: vm.wickets,
        overs: vm.oversDisplay || "0.0",
        maxOvers: vm.oversLimit > 0 ? vm.oversLimit : undefined,
        target: targetValue,
        crr: vm.crr || null,
        statusText: breakStatus,
      },
      phase: "innings_break",
      isLoading: false,
      connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    };
  }

  // 6. Active Live Match (1st Innings or 2nd Innings Chase)
  const isChase = vm.phase === "chase";
  const matchContext =
    vm.venueText || (isChase ? "2nd Innings Chase" : "1st Innings");

  let statusText: string | null = null;
  if (isChase && vm.needRuns != null && vm.ballsRemaining != null) {
    statusText = `NEED ${vm.needRuns} RUNS IN ${vm.ballsRemaining} BALLS`;
  } else if (vm.freeHitActive) {
    statusText = "FREE HIT ACTIVE";
  } else if (vm.superBallActive) {
    statusText = "SUPERBALL 2X ACTIVE";
  } else if (vm.partnershipText) {
    statusText = vm.partnershipText;
  }

  const scorebugData: ObsV2ScorebugData = {
    phase: vm.phase,
    isLoading: false,
    battingTeam: batting,
    bowlingTeam: bowling,
    runs: vm.runs,
    wickets: vm.wickets,
    overs: vm.oversDisplay || "0.0",
    maxOvers: vm.oversLimit > 0 ? vm.oversLimit : undefined,
    target: isChase && vm.target != null && vm.target > 0 ? vm.target : null,
    needRuns: isChase && vm.needRuns != null ? vm.needRuns : null,
    ballsRemaining: isChase && vm.ballsRemaining != null ? vm.ballsRemaining : null,
    crr: vm.crr || null,
    rrr: isChase ? vm.rrr || null : null,
    statusText,
  };

  return {
    header: {
      tournamentName,
      tournamentLogoUrl,
      matchContext,
      live: true,
      statusLabel: isChase ? "CHASE" : "LIVE",
    },
    scorebug: scorebugData,
    phase: vm.phase,
    isLoading: false,
    connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
  };
}
