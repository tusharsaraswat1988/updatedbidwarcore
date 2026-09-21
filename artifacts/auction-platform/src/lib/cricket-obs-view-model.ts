/**
 * Cricket OBS scorebug view-model — pure mapping from authoritative live state.
 * No scoring writes. No engine resolution. Paint preservation lives here.
 */

import type { BallDisplayOutcome, CricketScoreboardState } from "@workspace/scoring-core";
import type { CricketMatchSummary } from "@workspace/scoring-core";
import {
  getActiveInnings,
  oversText,
  requiredRate,
  runRate,
} from "@/lib/scoring-ball";
import type { ScoringLiveDisplay, ScoringMatchJson } from "@/lib/scoring-api";
import {
  getDisplayThemeFromPresentationPaint,
  type PresentationPaintJson,
} from "@/lib/display-theme";
import type { CricketScorerTeam } from "@/lib/scoring-squad";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";

export type CricketObsPhase =
  | "no_live"
  | "pre_match"
  | "live"
  | "innings_break"
  | "chase"
  | "completed"
  | "match_unavailable"
  | "reconnecting";

export type CricketObsFlashKind =
  | "FOUR"
  | "SIX"
  | "SUPERBALL"
  | "SUPER_OVER"
  | "NO_BALL"
  | "FREE_HIT"
  | "WIDE"
  | "WICKET"
  | "NEW_BATSMAN"
  | "TOSS_WIN"
  | "MATCH_WON";

export type CricketObsMidOverlayKind =
  | "none"
  | "sponsors"
  | "standings"
  | "fixtures"
  | "scorecard"
  | "summary"
  | "intro";

export type CricketObsBatterView = {
  id: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOnStrike: boolean;
};

export type CricketObsBowlerView = {
  id: number;
  name: string;
  overs: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
};

export type CricketObsTeamView = {
  id: number;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  color: string | null;
};

export type CricketObsTheme = {
  accent: string;
  accentOn: string;
  shell: string;
  panel: string;
  text: string;
  sponsorStripEnabled: boolean;
};

export type CricketObsViewModel = {
  phase: CricketObsPhase;
  matchId: number | null;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  home: CricketObsTeamView | null;
  away: CricketObsTeamView | null;
  batting: CricketObsTeamView | null;
  bowling: CricketObsTeamView | null;
  winner: CricketObsTeamView | null;
  runs: number;
  wickets: number;
  oversLabel: string;
  oversLimit: number;
  oversDisplay: string;
  crr: string | null;
  rrr: string | null;
  prr: string | null;
  projectedScore: number | null;
  target: number | null;
  needRuns: number | null;
  ballsRemaining: number | null;
  thisOverLabels: string[];
  striker: CricketObsBatterView | null;
  nonStriker: CricketObsBatterView | null;
  bowler: CricketObsBowlerView | null;
  partnershipRuns: number;
  partnershipBalls: number;
  partnershipText: string | null;
  powerplayText: string | null;
  tossText: string | null;
  freeHitActive: boolean;
  superBallActive: boolean;
  venueText: string | null;
  resultText: string | null;
  resultHeadline: string | null;
  firstInningsScoreLine: string | null;
  theme: CricketObsTheme;
  branding: PresentationPaintJson | null;
  sponsors: SponsorLogo[];
  showSponsorSlot: boolean;
  connectionHint: "none" | "reconnecting";
  flash: CricketObsFlashKind | null;
  flashToken: string | null;
  flashDetail?: string | null;
  midOverlay: CricketObsMidOverlayKind;
};

const DEFAULT_THEME: CricketObsTheme = {
  accent: BIDWAR_BROADCAST_YELLOW,
  accentOn: "#0c0c10",
  shell: BIDWAR_SCOREBOARD_SHELL,
  panel: BIDWAR_SCOREBOARD_PANEL,
  text: "#ffffff",
  sponsorStripEnabled: false,
};

function teamView(
  teams: CricketScorerTeam[],
  id: number | null | undefined,
): CricketObsTeamView | null {
  if (id == null) return null;
  const t = teams.find((x) => x.id === id);
  if (!t) {
    return {
      id,
      name: `Team ${id}`,
      shortCode: `T${id}`,
      logoUrl: null,
      color: null,
    };
  }
  return {
    id: t.id,
    name: t.name,
    shortCode: t.shortCode,
    logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : null,
    color: t.color,
  };
}

/** Legal balls remaining in the innings (6-ball overs). */
export function ballsRemaining(oversLimit: number, over: number, ball: number): number {
  return Math.max(0, oversLimit * 6 - (over * 6 + ball));
}

/**
 * Map a ball display row to a broadcast flash.
 * Only uses explicit fields / labels from authoritative thisOver — no guessing.
 */
export function mapBallToFlash(ball: BallDisplayOutcome | null | undefined): CricketObsFlashKind | null {
  if (!ball) return null;
  if (ball.isSuperBall) return "SUPERBALL";
  if (ball.isWicket) return "WICKET";
  if (ball.extrasType === "wide" || ball.label === "Wd" || ball.label.startsWith("Wd+")) {
    return "WIDE";
  }
  if (ball.extrasType === "no_ball" || ball.label === "Nb" || ball.label.startsWith("Nb+")) {
    return "NO_BALL";
  }
  // Boundaries: only when runs off the bat are exactly 4 or 6 (not extras-inflated totals).
  if (ball.runsOffBat === 6 && !ball.extrasType) return "SIX";
  if (ball.runsOffBat === 4 && !ball.extrasType) return "FOUR";
  if (ball.label === "6") return "SIX";
  if (ball.label === "4") return "FOUR";
  return null;
}

export function flashTokenForBall(
  matchId: number | null,
  sequence: number | null,
  ball: BallDisplayOutcome | null | undefined,
): string | null {
  if (!ball || matchId == null) return null;
  return `${matchId}:${sequence ?? 0}:${ball.over}.${ball.ball}:${ball.label}:${ball.isWicket ? "W" : ""}:${ball.isSuperBall ? "SB" : ""}`;
}

/**
 * Preserve REST-hydrated match metadata when SSE pushes a slim match object.
 */
export function mergeLiveDisplayPreserveBranding(
  previous: ScoringLiveDisplay | null | undefined,
  incoming: ScoringLiveDisplay | null | undefined,
): ScoringLiveDisplay | null {
  if (!incoming) return previous ?? null;
  if (!incoming.match) {
    return {
      match: previous?.match ?? null,
      state: incoming.state ?? previous?.state ?? null,
      summary: incoming.summary ?? previous?.summary ?? null,
    };
  }

  const prevMatch = previous?.match;
  const nextMatch = incoming.match;
  const mergedMatch: ScoringMatchJson = {
    ...(prevMatch ?? nextMatch),
    ...nextMatch,
    branding:
      nextMatch.branding != null && Object.keys(nextMatch.branding).length > 0
        ? nextMatch.branding
        : (prevMatch?.branding ?? nextMatch.branding ?? null),
    rules: nextMatch.rules ?? prevMatch?.rules ?? null,
    executionPolicyBind: nextMatch.executionPolicyBind ?? prevMatch?.executionPolicyBind ?? null,
    presentationPolicyBind:
      nextMatch.presentationPolicyBind ?? prevMatch?.presentationPolicyBind ?? null,
    roundName: nextMatch.roundName ?? prevMatch?.roundName ?? null,
    venue: nextMatch.venue ?? prevMatch?.venue ?? null,
    scheduledAt: nextMatch.scheduledAt ?? prevMatch?.scheduledAt ?? null,
  };

  return {
    match: mergedMatch,
    state: incoming.state ?? previous?.state ?? null,
    summary: incoming.summary ?? previous?.summary ?? null,
  };
}

function themeFromPaint(paint: PresentationPaintJson | null | undefined): CricketObsTheme {
  const display = getDisplayThemeFromPresentationPaint(paint);
  return {
    accent: display.accentColor || DEFAULT_THEME.accent,
    accentOn: DEFAULT_THEME.accentOn,
    shell: display.bg || DEFAULT_THEME.shell,
    panel: DEFAULT_THEME.panel,
    text: DEFAULT_THEME.text,
    sponsorStripEnabled: paint?.sponsorStripEnabled === true,
  };
}

function isInningsBreak(state: CricketScoreboardState): boolean {
  if (state.matchStatus !== "live") return false;
  const current = getActiveInnings(state);
  if (!current) return false;
  if (current.phase === "not_started") return true;
  // Fresh chase innings before first ball / crease set.
  if (
    state.target != null &&
    current.phase === "in_progress" &&
    current.runs === 0 &&
    current.wickets === 0 &&
    current.over === 0 &&
    current.ball === 0 &&
    state.strikerId == null
  ) {
    return true;
  }
  return false;
}

function firstInningsScoreLine(
  state: CricketScoreboardState,
  summary: CricketMatchSummary | null,
  teams: CricketScorerTeam[],
): string | null {
  const first =
    summary?.innings.find((i) => i.innings === 1) ??
    state.innings.find((i) => i.innings === 1);
  if (!first) return null;
  const bat = teamView(teams, first.battingTeamId);
  const overs =
    "overs" in first && typeof first.overs === "string"
      ? first.overs
      : oversText(
          (first as { over?: number }).over ?? 0,
          (first as { ball?: number }).ball ?? 0,
        );
  const limit = state.oversLimit;
  return `${bat?.shortCode ?? "T1"}  ${first.runs}/${first.wickets} (${overs}/${limit})`;
}

function resolveBatterView(
  playerId: number | null | undefined,
  isOnStrike: boolean,
  players?: CricketScorerPlayer[],
  scorecard?: CricketFullScorecard | null,
  currentInningsNum?: number,
): CricketObsBatterView | null {
  if (playerId == null) return null;
  const player = players?.find((p) => p.id === playerId);
  const name = player?.name || `Player #${playerId}`;

  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let strikeRate = 0;

  if (scorecard?.innings && currentInningsNum != null) {
    const inn = scorecard.innings.find((i) => i.innings === currentInningsNum);
    const row = inn?.batting.find((b) => b.playerId === playerId);
    if (row) {
      runs = row.runs;
      balls = row.balls;
      fours = row.fours;
      sixes = row.sixes;
      strikeRate = row.strikeRate;
    }
  }

  return {
    id: playerId,
    name,
    runs,
    balls,
    fours,
    sixes,
    strikeRate,
    isOnStrike,
  };
}

function resolveBowlerView(
  playerId: number | null | undefined,
  players?: CricketScorerPlayer[],
  scorecard?: CricketFullScorecard | null,
  currentInningsNum?: number,
): CricketObsBowlerView | null {
  if (playerId == null) return null;
  const player = players?.find((p) => p.id === playerId);
  const name = player?.name || `Bowler #${playerId}`;

  let overs = "0.0";
  let maidens = 0;
  let runsConceded = 0;
  let wickets = 0;
  let economy = 0;

  if (scorecard?.innings && currentInningsNum != null) {
    const inn = scorecard.innings.find((i) => i.innings === currentInningsNum);
    const row = inn?.bowling.find((b) => b.playerId === playerId);
    if (row) {
      overs = row.overs;
      maidens = row.maidens;
      runsConceded = row.runs;
      wickets = row.wickets;
      economy = row.economy;
    }
  }

  return {
    id: playerId,
    name,
    overs,
    maidens,
    runsConceded,
    wickets,
    economy,
  };
}

export type BuildCricketObsViewModelInput = {
  live: ScoringLiveDisplay | null;
  teams: CricketScorerTeam[];
  players?: CricketScorerPlayer[];
  scorecard?: CricketFullScorecard | null;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  sponsors: SponsorLogo[];
  /** null = follow tournament live; number = pin to match */
  pinnedMatchId: number | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  /** Previous flash token to avoid inventing flashes without a new ball */
  previousFlashToken?: string | null;
  overrideFlash?: CricketObsFlashKind | null;
  overrideFlashToken?: string | null;
  overrideFlashDetail?: string | null;
  midOverlay?: CricketObsMidOverlayKind;
};

export function buildCricketObsViewModel(input: BuildCricketObsViewModelInput): CricketObsViewModel {
  const {
    live,
    teams,
    players,
    scorecard,
    tournamentName,
    tournamentLogoUrl,
    sponsors,
    pinnedMatchId,
    connectionStatus,
    overrideFlash,
    overrideFlashToken,
    overrideFlashDetail,
    midOverlay = "none",
  } = input;

  const paint = (live?.match?.branding as PresentationPaintJson | null | undefined) ?? null;
  const theme = themeFromPaint(paint);
  const showSponsorSlot =
    sponsors.length > 0 && (paint == null || paint.sponsorStripEnabled !== false);

  const base: CricketObsViewModel = {
    phase: "no_live",
    matchId: null,
    tournamentName,
    tournamentLogoUrl,
    home: null,
    away: null,
    batting: null,
    bowling: null,
    winner: null,
    runs: 0,
    wickets: 0,
    oversLabel: "0.0",
    oversLimit: 0,
    oversDisplay: "0.0/0 OV",
    crr: null,
    rrr: null,
    prr: null,
    projectedScore: null,
    target: null,
    needRuns: null,
    ballsRemaining: null,
    thisOverLabels: [],
    striker: null,
    nonStriker: null,
    bowler: null,
    partnershipRuns: 0,
    partnershipBalls: 0,
    partnershipText: null,
    powerplayText: null,
    tossText: null,
    freeHitActive: false,
    superBallActive: false,
    venueText: null,
    resultText: null,
    resultHeadline: null,
    firstInningsScoreLine: null,
    theme,
    branding: paint,
    sponsors,
    showSponsorSlot,
    connectionHint: connectionStatus === "connected" ? "none" : "reconnecting",
    flash: overrideFlash ?? null,
    flashToken: overrideFlashToken ?? null,
    flashDetail: overrideFlashDetail ?? null,
    midOverlay,
  };

  if (!live?.match || !live.state) {
    return base;
  }

  const match = live.match;
  const state = live.state;
  const summary = live.summary;

  if (pinnedMatchId != null && match.id !== pinnedMatchId) {
    // Never substitute another match's score under a pinned match URL.
    return {
      ...base,
      phase: "match_unavailable",
      matchId: pinnedMatchId,
    };
  }

  const home = teamView(teams, state.homeTeamId ?? match.homeTeamId);
  const away = teamView(teams, state.awayTeamId ?? match.awayTeamId);
  const innings = getActiveInnings(state);
  const oversLimit = innings?.oversLimit ?? state.oversLimit ?? 0;
  const runs = innings?.runs ?? 0;
  const wickets = innings?.wickets ?? 0;
  const over = innings?.over ?? 0;
  const ball = innings?.ball ?? 0;
  const oversLabel = oversText(over, ball);
  const batting = innings ? teamView(teams, innings.battingTeamId) : null;
  const bowling = innings ? teamView(teams, innings.bowlingTeamId) : null;
  const winner = teamView(teams, state.winnerTeamId ?? match.winnerTeamId);
  const crr = innings && (over > 0 || ball > 0 || runs > 0) ? runRate(runs, over, ball) : null;
  const isTargetReached =
    target != null && runs >= target && (state.currentInnings ?? 1) >= 2;
  const isMatchFinished =
    state.matchStatus === "completed" ||
    state.matchStatus === "abandoned" ||
    isTargetReached;

  const needRuns =
    target != null && !isMatchFinished && state.matchStatus === "live"
      ? Math.max(0, target - runs)
      : null;
  const ballsLeft =
    target != null && !isMatchFinished && state.matchStatus === "live"
      ? ballsRemaining(oversLimit, over, ball)
      : null;
  const rrr =
    target != null && !isMatchFinished && innings
      ? requiredRate(target, runs, oversLimit, over, ball)
      : null;

  // Projected Score & PRR (1st innings)
  let projectedScore: number | null = null;
  let prr: string | null = null;
  if (innings && oversLimit > 0 && (over > 0 || ball > 0) && !isMatchFinished) {
    const ballsBowled = over * 6 + ball;
    const currentRunRate = (runs / ballsBowled) * 6;
    projectedScore = Math.round(currentRunRate * oversLimit);
    prr = currentRunRate.toFixed(2);
  }

  // Batter & Bowler stats
  const striker = resolveBatterView(
    state.strikerId,
    true,
    players,
    scorecard,
    state.currentInnings,
  );
  const nonStriker = resolveBatterView(
    state.nonStrikerId,
    false,
    players,
    scorecard,
    state.currentInnings,
  );
  const bowler = resolveBowlerView(
    state.bowlerId,
    players,
    scorecard,
    state.currentInnings,
  );

  // Powerplay indicator
  let powerplayText: string | null = null;
  if (innings && oversLimit > 0 && !isMatchFinished) {
    const p1Limit = Math.min(6, Math.ceil(oversLimit * 0.3));
    if (over < p1Limit) {
      powerplayText = `P1 (${p1Limit} OV)`;
    } else if (over >= p1Limit && oversLimit >= 20 && over < 15) {
      powerplayText = "P2";
    }
  }

  // Toss result text
  let tossText: string | null = null;
  if (state.tossWinnerTeamId) {
    const tossWinner = teamView(teams, state.tossWinnerTeamId);
    const decision = state.electedTo === "bat" ? "BAT" : state.electedTo === "bowl" ? "BOWL" : null;
    if (tossWinner && decision) {
      tossText = `${tossWinner.name.toUpperCase()} WON THE TOSS AND CHOSE TO ${decision}`;
    }
  }

  const lastBall =
    state.thisOver.length > 0 ? state.thisOver[state.thisOver.length - 1] : null;
  const ballFlashToken = flashTokenForBall(match.id, state.lastSequence, lastBall);
  const autoFlash =
    ballFlashToken && ballFlashToken !== input.previousFlashToken ? mapBallToFlash(lastBall) : null;

  const flash = overrideFlash !== undefined ? overrideFlash : autoFlash;
  const flashToken = overrideFlashToken !== undefined ? overrideFlashToken : ballFlashToken;

  let resultText = state.resultText ?? match.resultSummary ?? summary?.resultText ?? null;
  if (!resultText && isTargetReached && batting) {
    const wicketsInHand = Math.max(0, 10 - wickets);
    resultText = `${batting.name} Won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
  }

  const resultHeadline =
    isMatchFinished
      ? [winner?.shortCode || batting?.shortCode, resultText].filter(Boolean).join(" · ") || resultText
      : null;

  let phase: CricketObsPhase = "no_live";
  if (isMatchFinished) {
    phase = "completed";
  } else if (isInningsBreak(state)) {
    phase = "innings_break";
  } else if (state.matchStatus === "live" && target != null && innings) {
    phase = "chase";
  } else if (state.matchStatus === "live" && innings) {
    phase = "live";
  } else if (
    state.matchStatus === "scheduled" ||
    state.matchStatus === "live" ||
    !innings
  ) {
    phase = "pre_match";
  }

  return {
    ...base,
    phase,
    matchId: match.id,
    home,
    away,
    batting,
    bowling,
    winner,
    runs,
    wickets,
    oversLabel,
    oversLimit,
    oversDisplay: `${oversLabel}/${oversLimit} OV`,
    crr,
    rrr,
    prr,
    projectedScore,
    target,
    needRuns,
    ballsRemaining: ballsLeft,
    thisOverLabels: state.thisOver.map((b) => b.label),
    striker,
    nonStriker,
    bowler,
    partnershipRuns: (striker?.runs ?? 0) + (nonStriker?.runs ?? 0),
    partnershipBalls: (striker?.balls ?? 0) + (nonStriker?.balls ?? 0),
    partnershipText:
      striker || nonStriker
        ? `${(striker?.runs ?? 0) + (nonStriker?.runs ?? 0)} (${(striker?.balls ?? 0) + (nonStriker?.balls ?? 0)}b)`
        : null,
    powerplayText,
    tossText,
    freeHitActive: state.freeHitActive === true,
    superBallActive: state.superBallPending != null || lastBall?.isSuperBall === true,
    venueText: match.venue || null,
    resultText,
    resultHeadline,
    firstInningsScoreLine: firstInningsScoreLine(state, summary, teams),
    flash,
    flashToken,
    flashDetail: overrideFlashDetail,
    midOverlay,
  };
}

export const CRICKET_OBS_LIVE_SEGMENT = "live";

export function parseCricketObsMatchParam(
  raw: string | undefined,
): { mode: "live" } | { mode: "match"; matchId: number } | { mode: "invalid" } {
  if (!raw || raw === CRICKET_OBS_LIVE_SEGMENT) return { mode: "live" };
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return { mode: "invalid" };
  return { mode: "match", matchId: id };
}
