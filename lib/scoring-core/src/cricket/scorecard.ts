import { CricketEventType, type CricketBallRecordedPayload } from "../events/cricket";
import type { ScoringEventEnvelope } from "../types";
import { resolveEventsForReplay } from "../projector/resolve-undo";
import type { DismissalType, ExtraType } from "./types";
import type { CricketPartnership, CricketPartnershipRecord } from "./state";

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
  partnerships: CricketPartnershipRecord[];
  currentPartnership: CricketPartnership | null;
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

export function oversFromBalls(balls: number, ballsPerOver = 6): string {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  const whole = Math.floor(balls / bpo);
  const rem = balls % bpo;
  return `${whole}.${rem}`;
}

export function economy(runs: number, legalBalls: number, ballsPerOver = 6): number {
  if (legalBalls === 0) return 0;
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  return Math.round((runs / (legalBalls / bpo)) * 100) / 100;
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
  ballsPerOver?: number;
};

export function buildCricketScorecardFromEvents(
  matchId: number,
  events: ScoringEventEnvelope[],
  meta?: ScorecardMatchMeta,
  ballsPerOver = meta?.ballsPerOver ?? 6,
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
      partnerships: CricketPartnershipRecord[];
      activePartnership: CricketPartnership | null;
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
        partnerships: [],
        activePartnership: null,
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

    if (event.eventType === CricketEventType.INNINGS_ENDED) {
      const p = event.payload as { innings: number };
      if (!inningsMap.has(p.innings) && innings1Batting != null && innings1Bowling != null) {
        if (p.innings === 1) ensureInnings(1, innings1Batting, innings1Bowling);
        else if (p.innings === 2) ensureInnings(2, innings1Bowling, innings1Batting);
      }
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
          overs: oversFromBalls(inn.lastOver * ballsPerOver + inn.lastBall, ballsPerOver),
          playerId: p.playerId,
        });
      } else {
        bat.dismissalType = "retired_hurt";
      }

      if (
        inn.activePartnership &&
        (inn.activePartnership.batter1Id === p.playerId ||
          inn.activePartnership.batter2Id === p.playerId)
      ) {
        const surviving =
          p.playerId === inn.activePartnership.batter1Id
            ? inn.activePartnership.batter2Id
            : inn.activePartnership.batter1Id;
        if (inn.activePartnership.runs > 0 || inn.activePartnership.balls > 0) {
          inn.partnerships.push({
            innings: p.innings,
            wicket: p.type === "out" ? inn.totalWickets : 0,
            batter1Id: inn.activePartnership.batter1Id ?? p.playerId,
            batter1Runs: inn.activePartnership.batter1Runs,
            batter1Balls: inn.activePartnership.batter1Balls,
            batter2Id: inn.activePartnership.batter2Id ?? 0,
            batter2Runs: inn.activePartnership.batter2Runs,
            batter2Balls: inn.activePartnership.batter2Balls,
            extras: inn.activePartnership.extras,
            runs: inn.activePartnership.runs,
            balls: inn.activePartnership.balls,
            dismissedPlayerId: p.playerId,
            notOutPlayerId: surviving,
          });
        }
        inn.activePartnership = {
          runs: 0,
          balls: 0,
          batter1Id: surviving,
          batter1Runs: 0,
          batter1Balls: 0,
          batter2Id: null,
          batter2Runs: 0,
          batter2Balls: 0,
          extras: 0,
        };
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

    const effectiveBatRuns = payload.isSuperBall
      ? payload.runsOffBat * 2
      : payload.runsOffBat;
    const extraType = payload.extras.type as ExtraType | null;
    const extraRuns = payload.extras.runs;

    let runsToBowler = effectiveBatRuns;
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
    } else if (extraType === "leg_bye") {
      inn.extras.legByes += extraRuns;
      inn.extras.total += extraRuns;
    } else if (extraType === "penalty") {
      inn.extras.penalties += extraRuns;
      inn.extras.total += extraRuns;
    }

    const totalBallRuns = effectiveBatRuns + extraRuns;
    inn.totalRuns += totalBallRuns;

    if (batsmanFacesBall(payload)) {
      batStriker.balls += 1;
      batStriker.runs += effectiveBatRuns;
      if (payload.runsOffBat === 4) batStriker.fours += 1;
      if (payload.runsOffBat === 6) batStriker.sixes += 1;
    }

    // --- Partnership Tracking in Scorecard ---
    if (!inn.activePartnership) {
      inn.activePartnership = {
        runs: 0,
        balls: 0,
        batter1Id: payload.strikerId,
        batter1Runs: 0,
        batter1Balls: 0,
        batter2Id: payload.nonStrikerId ?? null,
        batter2Runs: 0,
        batter2Balls: 0,
        extras: 0,
      };
    } else {
      if (inn.activePartnership.batter1Id == null) {
        inn.activePartnership.batter1Id = payload.strikerId;
      } else if (
        inn.activePartnership.batter2Id == null &&
        payload.nonStrikerId != null &&
        payload.nonStrikerId !== inn.activePartnership.batter1Id
      ) {
        inn.activePartnership.batter2Id = payload.nonStrikerId;
      } else if (
        inn.activePartnership.batter2Id == null &&
        payload.strikerId !== inn.activePartnership.batter1Id
      ) {
        inn.activePartnership.batter2Id = payload.strikerId;
      }
    }

    inn.activePartnership.runs += totalBallRuns;
    inn.activePartnership.extras += extraRuns;
    const isBallFaced = batsmanFacesBall(payload);
    if (isBallFaced) {
      inn.activePartnership.balls += 1;
    }

    if (payload.strikerId === inn.activePartnership.batter1Id) {
      inn.activePartnership.batter1Runs += effectiveBatRuns;
      if (isBallFaced) inn.activePartnership.batter1Balls += 1;
    } else if (payload.strikerId === inn.activePartnership.batter2Id) {
      inn.activePartnership.batter2Runs += effectiveBatRuns;
      if (isBallFaced) inn.activePartnership.batter2Balls += 1;
    } else {
      if (inn.activePartnership.batter1Id == null) {
        inn.activePartnership.batter1Id = payload.strikerId;
        inn.activePartnership.batter1Runs += effectiveBatRuns;
        if (isBallFaced) inn.activePartnership.batter1Balls += 1;
      } else {
        inn.activePartnership.batter2Id = payload.strikerId;
        inn.activePartnership.batter2Runs += effectiveBatRuns;
        if (isBallFaced) inn.activePartnership.batter2Balls += 1;
      }
    }

    bowl.runs += runsToBowler;
    bowl.runsThisOver += runsToBowler;

    if (payload.isLegalDelivery) {
      bowl.legalBalls += 1;
      bowl.legalBallsThisOver += 1;
      inn.lastOver = payload.over;
      inn.lastBall = payload.ball;
      if (payload.ball === ballsPerOver) {
        if (bowl.legalBallsThisOver === ballsPerOver && bowl.runsThisOver === 0) {
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

      // MCC Law: bowler credited only for bowled, caught, lbw, stumped, hit_wicket
      const isBowlerWicket = [
        "bowled",
        "caught",
        "lbw",
        "stumped",
        "hit_wicket",
      ].includes(payload.wicket.type);
      if (isBowlerWicket) {
        bowl.wickets += 1;
      }

      inn.fow.push({
        wicket: inn.totalWickets,
        runs: inn.totalRuns,
        overs: `${payload.over}.${payload.ball}`,
        playerId: payload.wicket.dismissedPlayerId,
      });

      if (inn.activePartnership) {
        const disId = payload.wicket.dismissedPlayerId;
        const surviving =
          disId === inn.activePartnership.batter1Id
            ? inn.activePartnership.batter2Id
            : inn.activePartnership.batter1Id;

        inn.partnerships.push({
          innings: payload.innings,
          wicket: inn.totalWickets,
          batter1Id: inn.activePartnership.batter1Id ?? payload.strikerId,
          batter1Runs: inn.activePartnership.batter1Runs,
          batter1Balls: inn.activePartnership.batter1Balls,
          batter2Id: inn.activePartnership.batter2Id ?? payload.nonStrikerId ?? 0,
          batter2Runs: inn.activePartnership.batter2Runs,
          batter2Balls: inn.activePartnership.batter2Balls,
          extras: inn.activePartnership.extras,
          runs: inn.activePartnership.runs,
          balls: inn.activePartnership.balls,
          dismissedPlayerId: disId,
          notOutPlayerId: surviving,
        });

        inn.activePartnership = {
          runs: 0,
          balls: 0,
          batter1Id: surviving,
          batter1Runs: 0,
          batter1Balls: 0,
          batter2Id: null,
          batter2Runs: 0,
          batter2Balls: 0,
          extras: 0,
        };
      }
    }
  }

  const innings: InningsScorecard[] = [...inningsMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inningsNum, inn]) => {
      const pships = [...inn.partnerships];
      if (
        inn.activePartnership &&
        (inn.activePartnership.runs > 0 || inn.activePartnership.balls > 0)
      ) {
        pships.push({
          innings: inningsNum,
          wicket: 0,
          batter1Id: inn.activePartnership.batter1Id ?? 0,
          batter1Runs: inn.activePartnership.batter1Runs,
          batter1Balls: inn.activePartnership.batter1Balls,
          batter2Id: inn.activePartnership.batter2Id ?? 0,
          batter2Runs: inn.activePartnership.batter2Runs,
          batter2Balls: inn.activePartnership.batter2Balls,
          extras: inn.activePartnership.extras,
          runs: inn.activePartnership.runs,
          balls: inn.activePartnership.balls,
          dismissedPlayerId: null,
          notOutPlayerId: null,
        });
      }

      return {
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
            overs: oversFromBalls(b.legalBalls, ballsPerOver),
            maidens: b.maidens,
            runs: b.runs,
            wickets: b.wickets,
            wides: b.wides,
            noBalls: b.noBalls,
            economy: economy(b.runs, b.legalBalls, ballsPerOver),
          }))
          .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs),
        fallOfWickets: inn.fow,
        partnerships: pships,
        currentPartnership: inn.activePartnership,
        extras: inn.extras,
        totalRuns: inn.totalRuns,
        totalWickets: inn.totalWickets,
        overs: oversFromBalls(inn.lastOver * ballsPerOver + inn.lastBall, ballsPerOver),
      };
    });

  return { matchId, innings };
}
