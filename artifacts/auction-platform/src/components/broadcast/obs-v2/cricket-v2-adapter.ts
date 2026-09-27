import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";
import type {
  BallEvent,
  BallKind,
  BatterLine,
  BowlerLine,
  BroadcastFrame,
  CricketScoreModel,
  FeedStatus,
  ScenePayload,
  TeamPurse,
  WaitingSceneModel,
} from "./contracts";
import { deriveBranding, mapSponsors } from "./branding";

/**
 * Maps live cricket ball strings into Lovable presentation categories:
 * "dot" | "run" | "four" | "six" | "wicket" | "wide" | "noball" | "bye"
 */
export function mapBallLabelToBallEvent(label: string): BallEvent {
  const trimmed = (label || "").trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === "0" || trimmed === "•" || trimmed === "-") {
    return { kind: "dot", label: trimmed || "0" };
  }
  if (trimmed === "4") {
    return { kind: "four", label: "4" };
  }
  if (trimmed === "6") {
    return { kind: "six", label: "6" };
  }
  if (trimmed.includes("W") && !trimmed.includes("Wd")) {
    return { kind: "wicket", label: trimmed };
  }
  if (trimmed.includes("Wd") || lower.includes("wide")) {
    return { kind: "wide", label: trimmed };
  }
  if (trimmed.includes("Nb") || lower.includes("no")) {
    return { kind: "noball", label: trimmed };
  }
  if (trimmed.includes("B") || trimmed.includes("Lb") || lower.includes("bye")) {
    return { kind: "bye", label: trimmed };
  }
  return { kind: "run", label: trimmed };
}

/**
 * Derives the bottom-left status chip and accompanying text from live cricket phase.
 */
export function deriveCricketStatus(vm: CricketObsViewModel): { chip: string; text: string } {
  if (vm.phase === "completed") {
    const headline = vm.resultHeadline || vm.resultText || "MATCH COMPLETED";
    return { chip: "FINAL", text: headline.toUpperCase() };
  }
  if (vm.phase === "chase") {
    if (vm.needRuns != null && vm.ballsRemaining != null) {
      return {
        chip: "CHASE",
        text: `NEED ${vm.needRuns} RUNS IN ${vm.ballsRemaining} BALLS`,
      };
    }
    return { chip: "CHASE", text: vm.target != null ? `TARGET: ${vm.target}` : "2ND INNINGS CHASE" };
  }
  if (vm.phase === "innings_break") {
    const targetVal = vm.target ?? (vm.runs + 1);
    return {
      chip: "BREAK",
      text: vm.firstInningsScoreLine || `INNINGS BREAK · TARGET ${targetVal}`,
    };
  }
  if (vm.phase === "pre_match") {
    return {
      chip: "PRE-MATCH",
      text: vm.tossText || "MATCH STARTING SOON",
    };
  }
  if (vm.phase === "no_live" || vm.phase === "match_unavailable") {
    return { chip: "STANDBY", text: "WAITING FOR NEXT MATCH" };
  }
  if (vm.freeHitActive) {
    return { chip: "FREE HIT", text: "FREE HIT ACTIVE" };
  }
  if (vm.superBallActive) {
    return { chip: "SUPERBALL", text: "SUPERBALL 2X RUNS" };
  }
  if (vm.partnershipText) {
    return { chip: "LIVE", text: vm.partnershipText.toUpperCase() };
  }
  return { chip: "LIVE", text: "1ST INNINGS" };
}

export interface AdaptCricketToBroadcastFrameOptions {
  vm: CricketObsViewModel;
  tournamentLogoUrl?: string | null;
  sponsorLogos?: BidWarSponsorLogo[];
  performanceMode?: boolean;
}

/**
 * Pure adapter: Transforms authoritative CricketObsViewModel into the Lovable
 * BroadcastFrame with the correct scene for each match phase.
 *
 * Phase → Scene mapping:
 *   no_live / match_unavailable  → WAITING
 *   pre_match                    → CRICKET (scorebug shows team info, no scores)
 *   innings_break                → CRICKET (scorebug with innings break info)
 *   live / chase / completed     → CRICKET (full live scorebug)
 */
export function adaptCricketToBroadcastFrame(
  opts: AdaptCricketToBroadcastFrameOptions,
): BroadcastFrame {
  const { vm, tournamentLogoUrl, sponsorLogos = [], performanceMode = false } = opts;

  const branding = deriveBranding(
    vm.tournamentName || "BidWar Cricket",
    vm.tournamentLogoUrl || tournamentLogoUrl || null,
    vm.venueText,
  );

  const sponsors = mapSponsors(
    (vm.sponsors && vm.sponsors.length > 0) ? vm.sponsors : sponsorLogos,
  );

  // Teams for ticker
  const teams: TeamPurse[] = [];
  if (vm.home) {
    teams.push({
      teamId: String(vm.home.id),
      name: vm.home.name,
      short: vm.home.shortCode,
      logoUrl: vm.home.logoUrl || undefined,
      purseRemaining: 0,
      playersBought: 0,
      slotsRemaining: 0,
    });
  }
  if (vm.away) {
    teams.push({
      teamId: String(vm.away.id),
      name: vm.away.name,
      short: vm.away.shortCode,
      logoUrl: vm.away.logoUrl || undefined,
      purseRemaining: 0,
      playersBought: 0,
      slotsRemaining: 0,
    });
  }

  const feedStatus: FeedStatus =
    vm.connectionHint === "reconnecting" ? "stale" : "live";

  const baseFrame = {
    branding,
    sponsors,
    teams,
    settings: {
      performanceMode,
      showTicker: teams.length > 0,
    },
    feed: {
      status: feedStatus,
    },
  };

  // ── WAITING / NO-LIVE SCENE ──────────────────────────────────────────────
  if (vm.phase === "no_live" || vm.phase === "match_unavailable") {
    const waitingModel: WaitingSceneModel = {
      headline: vm.tournamentName
        ? `${vm.tournamentName} LIVE`
        : "BIDWAR CRICKET LIVE",
      subline: "WAITING FOR NEXT MATCH",
    };
    const payload: ScenePayload = { scene: "WAITING", model: waitingModel };
    return { ...baseFrame, ...payload };
  }

  // ── CRICKET SCOREBUG (all live phases) ───────────────────────────────────
  // Batters — show zeros for pre_match phase (no score yet)
  const isPreMatch = vm.phase === "pre_match";
  const isChase = vm.phase === "chase";

  const striker: BatterLine = {
    name: vm.striker?.name || (isPreMatch ? "TBC" : "Striker"),
    runs: vm.striker?.runs || 0,
    balls: vm.striker?.balls || 0,
    onStrike: true,
  };

  const nonStriker: BatterLine = {
    name: vm.nonStriker?.name || (isPreMatch ? "TBC" : "Non-Striker"),
    runs: vm.nonStriker?.runs || 0,
    balls: vm.nonStriker?.balls || 0,
    onStrike: false,
  };

  // Bowler
  const bowler: BowlerLine = {
    name: vm.bowler?.name || (isPreMatch ? "TBC" : "Bowler"),
    wickets: vm.bowler?.wickets || 0,
    runs: vm.bowler?.runsConceded || 0,
    overs: vm.bowler?.overs || "0.0",
  };

  // This Over balls
  const thisOver: BallEvent[] = (vm.thisOverLabels || []).map(mapBallLabelToBallEvent);

  // Result panel
  const showResult = vm.phase === "completed" || Boolean(vm.resultHeadline);
  const result = showResult
    ? {
        kicker: "Match Result",
        headline: vm.resultHeadline || vm.resultText || "FINAL",
        detail: vm.resultText || undefined,
      }
    : undefined;

  const battingTeam = {
    name: vm.batting?.name || vm.home?.name || "Batting",
    short: vm.batting?.shortCode || vm.home?.shortCode || "BAT",
    logoUrl: vm.batting?.logoUrl || vm.home?.logoUrl || undefined,
  };

  const bowlingTeamShort = vm.bowling?.shortCode || vm.away?.shortCode || "BWL";

  // ── Extended scorebug fields ─────────────────────────────────────────────
  const rrr = isChase && vm.rrr ? parseFloat(vm.rrr) || null : null;
  const needRuns = isChase && vm.needRuns != null ? vm.needRuns : null;
  const ballsRemaining = isChase && vm.ballsRemaining != null ? vm.ballsRemaining : null;
  const partnership = vm.partnershipText || null;
  const freeHitActive = vm.freeHitActive || false;
  const superBallActive = vm.superBallActive || false;
  const powerplayText = vm.powerplayText || null;
  const firstInningsScore = vm.firstInningsScoreLine || null;

  const cricketModel: CricketScoreModel = {
    battingTeam,
    bowlingTeamShort,
    runs: vm.runs || 0,
    wickets: vm.wickets || 0,
    overs: vm.oversDisplay || "0.0",
    maxOvers: vm.oversLimit > 0 ? vm.oversLimit : 20,
    crr: parseFloat(vm.crr || "0") || 0,
    striker,
    nonStriker,
    bowler,
    thisOver,
    result,
    status: deriveCricketStatus(vm),
    // Extended fields
    rrr,
    needRuns,
    ballsRemaining,
    partnership,
    freeHitActive,
    superBallActive,
    powerplayText,
    firstInningsScore,
    phase: vm.phase as CricketScoreModel["phase"],
  };

  const payload: ScenePayload = { scene: "CRICKET", model: cricketModel };
  return { ...baseFrame, ...payload };
}
