import type { PlayerMatchStatsInput } from "./leaderboard";

export type MomCandidate = {
  playerId: number;
  teamId: number;
  score: number;
  reason: string;
};

function combineMatchStats(rows: PlayerMatchStatsInput[]): Map<number, PlayerMatchStatsInput> {
  const combined = new Map<number, PlayerMatchStatsInput>();

  for (const row of rows) {
    const existing = combined.get(row.playerId);
    if (!existing) {
      combined.set(row.playerId, {
        matchId: row.matchId,
        playerId: row.playerId,
        teamId: row.teamId,
        innings: row.innings,
        batting: row.batting ? { ...row.batting } : null,
        bowling: row.bowling ? { ...row.bowling } : null,
        fielding: { ...row.fielding },
      });
      continue;
    }

    if (row.batting) {
      const bat = existing.batting ?? {
        playerId: row.playerId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        notOut: true,
        dismissalType: null,
        dismissedByPlayerId: null,
        fielderId: null,
      };
      bat.runs += row.batting.runs;
      bat.balls += row.batting.balls;
      bat.fours += row.batting.fours;
      bat.sixes += row.batting.sixes;
      bat.notOut = bat.notOut && row.batting.notOut;
      existing.batting = bat;
    }

    if (row.bowling) {
      const bowl = existing.bowling ?? {
        playerId: row.playerId,
        overs: "0.0",
        maidens: 0,
        runs: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
        economy: 0,
      };
      bowl.runs += row.bowling.runs;
      bowl.wickets += row.bowling.wickets;
      bowl.wides += row.bowling.wides;
      bowl.noBalls += row.bowling.noBalls;
      bowl.maidens += row.bowling.maidens;
      const [whole = "0", part = "0"] = bowl.overs.split(".");
      const legalBalls = parseInt(whole, 10) * 6 + parseInt(part, 10);
      const addLegal = (() => {
        const [w = "0", p = "0"] = row.bowling!.overs.split(".");
        return parseInt(w, 10) * 6 + parseInt(p, 10);
      })();
      const totalLegal = legalBalls + addLegal;
      bowl.overs = `${Math.floor(totalLegal / 6)}.${totalLegal % 6}`;
      bowl.economy = totalLegal > 0 ? Math.round((bowl.runs / totalLegal) * 6 * 100) / 100 : 0;
      existing.bowling = bowl;
    }

    existing.fielding.catches += row.fielding.catches;
    existing.fielding.runOuts += row.fielding.runOuts;
    existing.fielding.stumpings += row.fielding.stumpings;
  }

  return combined;
}

function scoreCandidate(row: PlayerMatchStatsInput, winnerTeamId: number | null): MomCandidate {
  const runs = row.batting?.runs ?? 0;
  const wickets = row.bowling?.wickets ?? 0;
  const catches = row.fielding.catches;
  const stumpings = row.fielding.stumpings;
  const runOuts = row.fielding.runOuts;

  let score = runs + wickets * 25 + catches * 8 + stumpings * 10 + runOuts * 6;
  if (runs >= 100) score += 30;
  else if (runs >= 50) score += 15;
  if (wickets >= 3) score += 10;

  if (winnerTeamId != null && row.teamId === winnerTeamId) {
    score *= 1.08;
  }

  const parts: string[] = [];
  if (runs > 0) parts.push(`${runs} runs`);
  if (wickets > 0) parts.push(`${wickets} wkts`);
  if (catches > 0) parts.push(`${catches} ct`);
  if (stumpings > 0) parts.push(`${stumpings} st`);
  const reason = parts.length > 0 ? parts.join(", ") : "All-round contribution";

  return { playerId: row.playerId, teamId: row.teamId, score, reason };
}

/** Heuristic Man of the Match picker from per-innings match stats. */
export function pickManOfTheMatch(
  rows: PlayerMatchStatsInput[],
  winnerTeamId: number | null,
): MomCandidate | null {
  if (rows.length === 0) return null;

  const combined = combineMatchStats(rows);
  let best: MomCandidate | null = null;

  for (const row of combined.values()) {
    const candidate = scoreCandidate(row, winnerTeamId);
    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score &&
        winnerTeamId != null &&
        candidate.teamId === winnerTeamId &&
        best.teamId !== winnerTeamId)
    ) {
      best = candidate;
    }
  }

  if (best) {
    best = { ...best, score: Math.round(best.score) };
  }

  return best;
}
