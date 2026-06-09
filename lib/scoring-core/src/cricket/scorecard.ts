import { CricketEventType, type CricketBallRecordedPayload } from "../events/cricket";
import type { ScoringEventEnvelope } from "../types";
import { resolveEventsForReplay } from "../projector/resolve-undo";
import type { DismissalType, ExtraType } from "./types";

export type BattingCardRow = {
  playerId: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalType: DismissalType | "retired_hurt" | null;
  dismissedByPlayerId: number | null;
  fielderId: number | null;
};

export type BowlingCardRow = {
  playerId: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
};

export type FallOfWicket = {
  wicket: number;
  runs: number;
  overs: string;
  playerId: number;
};

export type InningsExtras = {
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalties: number;
  total: number;
};

export type InningsScorecard = {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  batting: BattingCardRow[];
  bowling: BowlingCardRow[];
  fallOfWickets: FallOfWicket[];
  extras: InningsExtras;
  totalRuns: number;
  totalWickets: number;
  overs: string;
};

export type CricketFullScorecard = {
  matchId: number;
  innings: InningsScorecard[];
};

type BatAcc = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  notOut: boolean;
  dismissalType: BattingCardRow["dismissalType"];
  dismissedByPlayerId: number | null;
  fielderId: number | null;
};

type BowlAcc = {
  legalBalls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  maidens: number;
  runsThisOver: number;
  legalBallsThisOver: number;
};

function emptyBat(): BatAcc {
  return {
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    notOut: true,
    dismissalType: null,
    dismissedByPlayerId: null,
    fielderId: null,
  };
}

function emptyBowl(): BowlAcc {
  return {
    legalBalls: 0,
    runs: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    maidens: 0,
    runsThisOver: 0,
    legalBallsThisOver: 0,
  };
}

function oversFromBalls(balls: number): string {
  const whole = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${whole}.${rem}`;
}

function economy(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return Math.round((runs / (legalBalls / 6)) * 100) / 100;
}

function strikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return Math.round((runs / balls) * 10000) / 100;
}

function batsmanFacesBall(payload: CricketBallRecordedPayload): boolean {
  if (!payload.isLegalDelivery) {
    return payload.extras.type === "no_ball" && payload.runsOffBat > 0;
  }
  return payload.extras.type !== "wide";
}

export type ScorecardMatchMeta = {
  homeTeamId: number;
  awayTeamId: number;
};

export function buildCricketScorecardFromEvents(
  matchId: number,
  events: ScoringEventEnvelope[],
  meta?: ScorecardMatchMeta,
): CricketFullScorecard {
  const effective = resolveEventsForReplay(events);
  let innings1Batting: number | null = null;
  let innings1Bowling: number | null = null;

  const inningsMap = new Map<
    number,
    {
      battingTeamId: number;
      bowlingTeamId: number;
      bats: Map<number, BatAcc>;
      bowls: Map<number, BowlAcc>;
      fow: FallOfWicket[];
      extras: InningsExtras;
      totalRuns: number;
      totalWickets: number;
      lastOver: number;
      lastBall: number;
    }
  >();

  function ensureInnings(
    inn: number,
    battingTeamId: number,
    bowlingTeamId: number,
  ) {
    if (!inningsMap.has(inn)) {
      inningsMap.set(inn, {
        battingTeamId,
        bowlingTeamId,
        bats: new Map(),
        bowls: new Map(),
        fow: [],
        extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0, penalties: 0, total: 0 },
        totalRuns: 0,
        totalWickets: 0,
        lastOver: 0,
        lastBall: 0,
      });
    }
    return inningsMap.get(inn)!;
  }

  function getBat(inn: ReturnType<typeof ensureInnings>, playerId: number): BatAcc {
    if (!inn.bats.has(playerId)) inn.bats.set(playerId, emptyBat());
    return inn.bats.get(playerId)!;
  }

  function getBowl(inn: ReturnType<typeof ensureInnings>, playerId: number): BowlAcc {
    if (!inn.bowls.has(playerId)) inn.bowls.set(playerId, emptyBowl());
    return inn.bowls.get(playerId)!;
  }

  for (const event of effective) {
    if (event.eventType === CricketEventType.MATCH_STARTED && meta) {
      const p = event.payload as {
        tossWinnerTeamId: number;
        electedTo: "bat" | "bowl";
      };
      const other =
        p.tossWinnerTeamId === meta.homeTeamId ? meta.awayTeamId : meta.homeTeamId;
      innings1Batting = p.electedTo === "bat" ? p.tossWinnerTeamId : other;
      innings1Bowling = p.electedTo === "bat" ? other : p.tossWinnerTeamId;
      ensureInnings(1, innings1Batting, innings1Bowling);
      continue;
    }

    if (event.eventType === CricketEventType.SUPER_OVER_STARTED) {
      const p = event.payload as {
        innings: number;
        battingTeamId: number;
        bowlingTeamId: number;
      };
      ensureInnings(p.innings, p.battingTeamId, p.bowlingTeamId);
      continue;
    }

    if (event.eventType === CricketEventType.PENALTY_AWARDED) {
      const p = event.payload as { innings: number; battingTeamId: number; runs: number };
      const inn = inningsMap.get(p.innings);
      if (inn) {
        inn.extras.penalties += p.runs;
        inn.extras.total += p.runs;
        inn.totalRuns += p.runs;
      }
      continue;
    }

    if (event.eventType === CricketEventType.PLAYER_RETIRED) {
      const p = event.payload as {
        innings: number;
        playerId: number;
        type: "hurt" | "out";
      };
      const inn = inningsMap.get(p.innings);
      if (!inn) continue;
      const bat = getBat(inn, p.playerId);
      if (p.type === "out") {
        bat.notOut = false;
        bat.dismissalType = "retired_out";
        inn.totalWickets += 1;
        inn.fow.push({
          wicket: inn.totalWickets,
          runs: inn.totalRuns,
          overs: oversFromBalls(inn.lastOver * 6 + inn.lastBall),
          playerId: p.playerId,
        });
      } else {
        bat.dismissalType = "retired_hurt";
      }
      continue;
    }

    if (event.eventType !== CricketEventType.BALL_RECORDED) continue;

    const payload = event.payload as CricketBallRecordedPayload;
    if (!inningsMap.has(payload.innings) && innings1Batting != null && innings1Bowling != null) {
      if (payload.innings === 1) {
        ensureInnings(1, innings1Batting, innings1Bowling);
      } else if (payload.innings === 2) {
        ensureInnings(2, innings1Bowling, innings1Batting);
      }
    }
    const inn = inningsMap.get(payload.innings);
    if (!inn) continue;

    const batStriker = getBat(inn, payload.strikerId);
    const bowl = getBowl(inn, payload.bowlerId);

    const runsOffBat = payload.runsOffBat;
    const extraType = payload.extras.type as ExtraType | null;
    const extraRuns = payload.extras.runs;

    let runsToBowler = runsOffBat;
    if (extraType === "wide" || extraType === "no_ball") {
      bowl.wides += extraType === "wide" ? 1 : 0;
      bowl.noBalls += extraType === "no_ball" ? 1 : 0;
      runsToBowler += extraRuns;
      inn.extras.total += extraRuns;
      if (extraType === "wide") inn.extras.wides += extraRuns;
      if (extraType === "no_ball") inn.extras.noBalls += extraRuns;
    } else if (extraType === "bye") {
      inn.extras.byes += extraRuns;
      inn.extras.total += extraRuns;
      runsToBowler += extraRuns;
    } else if (extraType === "leg_bye") {
      inn.extras.legByes += extraRuns;
      inn.extras.total += extraRuns;
      runsToBowler += extraRuns;
    } else if (extraType === "penalty") {
      inn.extras.penalties += extraRuns;
      inn.extras.total += extraRuns;
    }

    const totalBallRuns = runsOffBat + (extraType === "bye" || extraType === "leg_bye" ? 0 : extraRuns);
    inn.totalRuns += totalBallRuns;

    if (batsmanFacesBall(payload)) {
      batStriker.balls += 1;
      batStriker.runs += runsOffBat;
      if (runsOffBat === 4) batStriker.fours += 1;
      if (runsOffBat === 6) batStriker.sixes += 1;
    }

    bowl.runs += runsToBowler + (extraType === "bye" || extraType === "leg_bye" ? extraRuns : 0);

    if (payload.isLegalDelivery) {
      bowl.legalBalls += 1;
      bowl.legalBallsThisOver += 1;
      bowl.runsThisOver += totalBallRuns;
      inn.lastOver = payload.over;
      inn.lastBall = payload.ball;
      if (payload.ball === 6) {
        if (bowl.legalBallsThisOver === 6 && bowl.runsThisOver === 0) {
          bowl.maidens += 1;
        }
        bowl.runsThisOver = 0;
        bowl.legalBallsThisOver = 0;
      }
    }

    if (payload.wicket) {
      inn.totalWickets += 1;
      const dismissed = getBat(inn, payload.wicket.dismissedPlayerId);
      dismissed.notOut = false;
      dismissed.dismissalType = payload.wicket.type as DismissalType;
      dismissed.dismissedByPlayerId = payload.bowlerId;
      dismissed.fielderId = payload.wicket.fielderId ?? null;
      if (payload.wicket.type !== "run_out" && payload.wicket.type !== "stumped") {
        bowl.wickets += 1;
      } else if (payload.wicket.type === "stumped") {
        bowl.wickets += 1;
      }
      inn.fow.push({
        wicket: inn.totalWickets,
        runs: inn.totalRuns,
        overs: `${payload.over}.${payload.ball}`,
        playerId: payload.wicket.dismissedPlayerId,
      });
    }
  }

  const innings: InningsScorecard[] = [...inningsMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inningsNum, inn]) => ({
      innings: inningsNum,
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      batting: [...inn.bats.entries()]
        .map(([playerId, b]) => ({
          playerId,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          strikeRate: strikeRate(b.runs, b.balls),
          notOut: b.notOut,
          dismissalType: b.dismissalType,
          dismissedByPlayerId: b.dismissedByPlayerId,
          fielderId: b.fielderId,
        }))
        .sort((a, b) => b.runs - a.runs),
      bowling: [...inn.bowls.entries()]
        .map(([playerId, b]) => ({
          playerId,
          overs: oversFromBalls(b.legalBalls),
          maidens: b.maidens,
          runs: b.runs,
          wickets: b.wickets,
          wides: b.wides,
          noBalls: b.noBalls,
          economy: economy(b.runs, b.legalBalls),
        }))
        .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs),
      fallOfWickets: inn.fow,
      extras: inn.extras,
      totalRuns: inn.totalRuns,
      totalWickets: inn.totalWickets,
      overs: oversFromBalls(inn.lastOver * 6 + inn.lastBall),
    }));

  return { matchId, innings };
}
