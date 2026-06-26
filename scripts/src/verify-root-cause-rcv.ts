/**
 * Root Cause Verification — fresh tournament workflows vs BV-1/BV-2/BV-3.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run verify:root-cause-rcv
 *
 * Does NOT run repair --apply. Outputs JSON summary for remediation report.
 */
import { loadAppEnv } from "@workspace/db/load-app-env";

loadAppEnv({ nodeEnv: "development" });

import { sql, eq } from "drizzle-orm";
import { db, tournamentsTable, teamsTable, playersTable, badmintonPlayersTable, badmintonCategoriesTable, badmintonRegistrationsTable } from "@workspace/db";
import { CricketEventType } from "@workspace/scoring-core";
import {
  syncAuctionPlayerToMaster,
  createPlayerTeamAssignmentFromSale,
} from "../../artifacts/api-server/src/lib/master-sports/sync";
import { createScoringMatch, appendScoringEvent } from "../../artifacts/api-server/src/lib/scoring-service";
import {
  createBadmintonMatch,
  startBadmintonMatch,
  handleForceEndMatch,
} from "../../artifacts/api-server/src/lib/badminton-service";
import {
  buildSideJsonFromBadmintonPlayer,
  ensureBadmintonPlayerFromMaster,
} from "../../artifacts/api-server/src/lib/master-sports/badminton";
import { isPlayerSportProfilesEnabled } from "@workspace/api-base/player-sport-profiles";
import "../../artifacts/api-server/src/lib/scoring-adapters/register";

type SportAudit = {
  tournamentId: number;
  sport: string;
  label: string;
  bv1_wrongSportStatistics: number;
  bv2_wrongSportAssignments: number;
  bv3_missingSportProfiles: number;
  bv1_samples: Record<string, unknown>[];
  bv2_samples: Record<string, unknown>[];
  bv3_samples: Record<string, unknown>[];
  reproduced: boolean;
};

const ACTOR = { type: "organizer" as const, id: "rcv-script" };
const TAG = `RCV-${Date.now().toString(36).toUpperCase()}`;

async function auditTournament(tournamentId: number, sport: string, label: string): Promise<SportAudit> {
  const wrongStats = await db.execute(sql`
    SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id
    FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE ps.tournament_id = ${tournamentId}
      AND lower(ps.sport) <> lower(t.sport)
  `);

  const wrongAssign = await db.execute(sql`
    SELECT pta.id, pta.player_id, pta.sport, pta.tournament_id
    FROM player_team_assignments pta
    INNER JOIN tournaments t ON t.id = pta.tournament_id
    WHERE pta.tournament_id = ${tournamentId}
      AND lower(pta.sport) <> lower(t.sport)
  `);

  const missingProfiles = await db.execute(sql`
    SELECT DISTINCT gp.global_player_id, lower(t.sport) AS expected_sport
    FROM (
      SELECT p.global_player_id, p.tournament_id
      FROM players p
      WHERE p.tournament_id = ${tournamentId} AND p.global_player_id IS NOT NULL
      UNION
      SELECT bp.master_player_id AS global_player_id, bp.tournament_id
      FROM badminton_players bp
      WHERE bp.tournament_id = ${tournamentId} AND bp.master_player_id IS NOT NULL
    ) gp
    INNER JOIN tournaments t ON t.id = gp.tournament_id
    WHERE NOT EXISTS (
      SELECT 1 FROM player_sport_profiles psp
      WHERE psp.global_player_id = gp.global_player_id
        AND lower(psp.sport_slug) = lower(t.sport)
    )
  `);

  const bv1 = wrongStats.rows.length;
  const bv2 = wrongAssign.rows.length;
  const bv3 = missingProfiles.rows.length;

  return {
    tournamentId,
    sport,
    label,
    bv1_wrongSportStatistics: bv1,
    bv2_wrongSportAssignments: bv2,
    bv3_missingSportProfiles: bv3,
    bv1_samples: wrongStats.rows.slice(0, 5) as Record<string, unknown>[],
    bv2_samples: wrongAssign.rows.slice(0, 5) as Record<string, unknown>[],
    bv3_samples: missingProfiles.rows.slice(0, 5) as Record<string, unknown>[],
    reproduced: bv1 > 0 || bv2 > 0 || bv3 > 0,
  };
}

async function runCricketWorkflow(): Promise<SportAudit> {
  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: `${TAG} Cricket`,
      sport: "cricket",
      auctionCode: `RC${TAG.slice(-6)}`,
      status: "active",
      scoringEnabled: true,
      scoringPhase: "active",
      organizerName: "RCV Script",
      organizerPassword: "rcv-temp-not-for-login",
    })
    .returning();

  const tid = tournament.id;

  const ownerMobileA = `9${String(Date.now()).slice(-9)}`;
  const ownerMobileB = `9${String(Date.now() + 3).slice(-9)}`;

  const [teamA, teamB] = await db
    .insert(teamsTable)
    .values([
      {
        tournamentId: tid,
        name: "RCV Team A",
        shortCode: "RCA",
        ownerName: "RCV Owner A",
        ownerMobile: ownerMobileA,
        color: "#1D4ED8",
        purse: 10000000,
        purseUsed: 0,
      },
      {
        tournamentId: tid,
        name: "RCV Team B",
        shortCode: "RCB",
        ownerName: "RCV Owner B",
        ownerMobile: ownerMobileB,
        color: "#DC2626",
        purse: 10000000,
        purseUsed: 0,
      },
    ])
    .returning();

  const playerRows = await db
    .insert(playersTable)
    .values([
      {
        tournamentId: tid,
        serialNo: 1,
        name: "RCV Cricket Striker",
        mobileNumber: `9${String(Date.now()).slice(-9)}`,
        role: "Batsman",
        basePrice: 200000,
        status: "available",
      },
      {
        tournamentId: tid,
        serialNo: 2,
        name: "RCV Cricket NonStriker",
        mobileNumber: `9${String(Date.now() + 1).slice(-9)}`,
        role: "Batsman",
        basePrice: 200000,
        status: "available",
      },
      {
        tournamentId: tid,
        serialNo: 3,
        name: "RCV Cricket Bowler",
        mobileNumber: `9${String(Date.now() + 2).slice(-9)}`,
        role: "Bowler",
        basePrice: 200000,
        status: "available",
      },
    ])
    .returning();

  const synced = [];
  for (const p of playerRows) {
    const result = await syncAuctionPlayerToMaster(p.id, tid);
    if (!result) throw new Error(`sync failed for player ${p.id}`);
    synced.push({ player: p, masterId: result.masterPlayerId });
  }

  const [striker, nonStriker, bowler] = playerRows;
  const soldStriker = await db
    .update(playersTable)
    .set({ status: "sold", teamId: teamA.id, soldPrice: striker.basePrice })
    .where(eq(playersTable.id, striker.id))
    .returning();
  const soldNon = await db
    .update(playersTable)
    .set({ status: "sold", teamId: teamA.id, soldPrice: nonStriker.basePrice })
    .where(eq(playersTable.id, nonStriker.id))
    .returning();
  const soldBowler = await db
    .update(playersTable)
    .set({ status: "sold", teamId: teamB.id, soldPrice: bowler.basePrice })
    .where(eq(playersTable.id, bowler.id))
    .returning();

  const [teamARow] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamA.id));
  const [teamBRow] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamB.id));

  await createPlayerTeamAssignmentFromSale(soldStriker[0], teamARow, tid);
  await createPlayerTeamAssignmentFromSale(soldNon[0], teamARow, tid);
  await createPlayerTeamAssignmentFromSale(soldBowler[0], teamBRow, tid);

  const { match } = await createScoringMatch(tid, {
    homeTeamId: teamA.id,
    awayTeamId: teamB.id,
    oversLimit: 20,
  });

  let seq = 0;
  await appendScoringEvent(tid, match.id, {
    eventType: CricketEventType.MATCH_STARTED,
    payload: { tossWinnerTeamId: teamA.id, electedTo: "bat", oversLimit: 20 },
    expectedSequence: seq,
    actor: ACTOR,
  });
  seq = 1;
  await appendScoringEvent(tid, match.id, {
    eventType: CricketEventType.BALL_RECORDED,
    payload: {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: striker.id,
      nonStrikerId: nonStriker.id,
      bowlerId: bowler.id,
      runsOffBat: 4,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    },
    expectedSequence: seq,
    actor: ACTOR,
  });
  seq = 2;
  await appendScoringEvent(tid, match.id, {
    eventType: CricketEventType.MATCH_COMPLETED,
    payload: {
      winnerTeamId: teamA.id,
      margin: "1 run",
      resultText: "RCV Team A won by 1 run",
    },
    expectedSequence: seq,
    actor: ACTOR,
  });

  return auditTournament(tid, "cricket", `${TAG} Cricket`);
}

async function runBadmintonWorkflow(): Promise<SportAudit> {
  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: `${TAG} Badminton`,
      sport: "badminton",
      auctionCode: `RB${TAG.slice(-6)}`,
      status: "active",
      scoringEnabled: true,
      scoringPhase: "active",
      organizerName: "RCV Script",
      organizerPassword: "rcv-temp-not-for-login",
    })
    .returning();

  const tid = tournament.id;

  const ownerMobileA = `8${String(Date.now() + 10).slice(-9)}`;
  const ownerMobileB = `8${String(Date.now() + 11).slice(-9)}`;

  const [teamA, teamB] = await db
    .insert(teamsTable)
    .values([
      {
        tournamentId: tid,
        name: "RCV Franchise A",
        shortCode: "RFA",
        ownerName: "RCV Owner A",
        ownerMobile: ownerMobileA,
        color: "#7C3AED",
        purse: 5000000,
        purseUsed: 0,
      },
      {
        tournamentId: tid,
        name: "RCV Franchise B",
        shortCode: "RFB",
        ownerName: "RCV Owner B",
        ownerMobile: ownerMobileB,
        color: "#059669",
        purse: 5000000,
        purseUsed: 0,
      },
    ])
    .returning();

  const auctionPlayers = await db
    .insert(playersTable)
    .values([
      {
        tournamentId: tid,
        serialNo: 1,
        name: "RCV Badminton Left",
        mobileNumber: `8${String(Date.now()).slice(-9)}`,
        gender: "M",
        basePrice: 150000,
        status: "available",
      },
      {
        tournamentId: tid,
        serialNo: 2,
        name: "RCV Badminton Right",
        mobileNumber: `8${String(Date.now() + 1).slice(-9)}`,
        gender: "F",
        basePrice: 150000,
        status: "available",
      },
    ])
    .returning();

  const masterIds: string[] = [];
  for (const p of auctionPlayers) {
    const sync = await syncAuctionPlayerToMaster(p.id, tid);
    if (!sync) throw new Error(`badminton auction player sync failed ${p.id}`);
    masterIds.push(sync.masterPlayerId);
  }

  const soldLeft = await db
    .update(playersTable)
    .set({ status: "sold", teamId: teamA.id, soldPrice: auctionPlayers[0].basePrice })
    .where(eq(playersTable.id, auctionPlayers[0].id))
    .returning();
  const soldRight = await db
    .update(playersTable)
    .set({ status: "sold", teamId: teamB.id, soldPrice: auctionPlayers[1].basePrice })
    .where(eq(playersTable.id, auctionPlayers[1].id))
    .returning();

  const [teamARow] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamA.id));
  const [teamBRow] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamB.id));
  await createPlayerTeamAssignmentFromSale(soldLeft[0], teamARow, tid);
  await createPlayerTeamAssignmentFromSale(soldRight[0], teamBRow, tid);

  const bpLeft = await ensureBadmintonPlayerFromMaster(tid, masterIds[0]);
  const bpRight = await ensureBadmintonPlayerFromMaster(tid, masterIds[1]);

  const [singlesCat] = await db
    .insert(badmintonCategoriesTable)
    .values({
      tournamentId: tid,
      name: "RCV Men's Singles",
      matchType: "singles",
      gender: "M",
      maxPlayers: 32,
    })
    .returning();

  const [doublesCat] = await db
    .insert(badmintonCategoriesTable)
    .values({
      tournamentId: tid,
      name: "RCV Mixed Doubles",
      matchType: "mixed_doubles",
      gender: "Mixed",
      maxPlayers: 16,
    })
    .returning();

  const [bpMale] = await db
    .insert(badmintonPlayersTable)
    .values({
      tournamentId: tid,
      firstName: "RCV",
      lastName: "Doubles Male",
      gender: "M",
      mobile: `7${String(Date.now()).slice(-9)}`,
      masterPlayerId: masterIds[0],
    })
    .returning();

  const [bpFemale] = await db
    .insert(badmintonPlayersTable)
    .values({
      tournamentId: tid,
      firstName: "RCV",
      lastName: "Doubles Female",
      gender: "F",
      mobile: `7${String(Date.now() + 1).slice(-9)}`,
      masterPlayerId: masterIds[1],
    })
    .returning();

  await db.insert(badmintonRegistrationsTable).values({
    tournamentId: tid,
    categoryId: singlesCat.id,
    player1Id: bpLeft.id,
    status: "accepted",
  });

  await db.insert(badmintonRegistrationsTable).values({
    tournamentId: tid,
    categoryId: doublesCat.id,
    player1Id: bpMale.id,
    player2Id: bpFemale.id,
    status: "accepted",
  });

  const leftSide = await buildSideJsonFromBadmintonPlayer(bpLeft.id, tid);
  const rightSide = await buildSideJsonFromBadmintonPlayer(bpRight.id, tid);

  const singlesFormat = {
    totalGames: 1,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    midGameSideChange: false,
  };

  const { match } = await createBadmintonMatch({
    tournamentId: tid,
    categoryId: singlesCat.id,
    matchType: "singles",
    matchLabel: "RCV Singles",
    leftSideJson: leftSide,
    rightSideJson: rightSide,
    matchFormatJson: singlesFormat,
  });

  await startBadmintonMatch(
    match.id,
    tid,
    {
      matchKind: "singles",
      format: singlesFormat,
      leftSide: {
        label: String(leftSide.label ?? "Left"),
        shortLabel: String(leftSide.shortLabel ?? "L"),
        playerIds: (leftSide.playerIds as number[]) ?? [bpLeft.id],
      },
      rightSide: {
        label: String(rightSide.label ?? "Right"),
        shortLabel: String(rightSide.shortLabel ?? "R"),
        playerIds: (rightSide.playerIds as number[]) ?? [bpRight.id],
      },
      firstServer: "left",
    },
    ACTOR,
  );

  await handleForceEndMatch(match.id, tid, "RCV verification complete", ACTOR);

  return auditTournament(tid, "badminton", `${TAG} Badminton`);
}

async function main() {
  console.log(`Root Cause Verification — tag ${TAG}`);
  console.log(`PLAYER_SPORT_PROFILES_ENABLED=${isPlayerSportProfilesEnabled()}`);

  const cricket = await runCricketWorkflow();
  const badminton = await runBadmintonWorkflow();

  const summary = {
    tag: TAG,
    verifiedAt: new Date().toISOString(),
    playerSportProfilesEnabled: isPlayerSportProfilesEnabled(),
    cricket,
    badminton,
    conclusion: {
      bv1_reproduced_on_fresh_data: cricket.bv1_wrongSportStatistics > 0 || badminton.bv1_wrongSportStatistics > 0,
      bv2_reproduced_on_fresh_data: cricket.bv2_wrongSportAssignments > 0 || badminton.bv2_wrongSportAssignments > 0,
      bv3_reproduced_on_fresh_data: cricket.bv3_missingSportProfiles > 0 || badminton.bv3_missingSportProfiles > 0,
      legacy_only:
        cricket.bv1_wrongSportStatistics === 0 &&
        cricket.bv2_wrongSportAssignments === 0 &&
        cricket.bv3_missingSportProfiles === 0 &&
        badminton.bv1_wrongSportStatistics === 0 &&
        badminton.bv2_wrongSportAssignments === 0 &&
        badminton.bv3_missingSportProfiles === 0,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.conclusion.legacy_only) {
    console.log("\n✓ Fresh workflows did NOT reproduce BV-1/BV-2/BV-3 — issues are likely legacy data only.");
    process.exit(0);
  } else {
    console.error("\n✗ Fresh workflows reproduced at least one BV issue — active code path bug suspected.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
