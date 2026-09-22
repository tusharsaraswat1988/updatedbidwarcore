import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  teamsTable,
  playersTable,
  scoringVenuesTable,
  scoringMatchesTable,
  scoringMatchSquadsTable,
  scoringDrawsTable,
  scoringFixturesTable,
  scoringGroupsTable,
  scoringGroupMembersTable,
  scoringEventsTable,
  scoringMatchPlayerStatsTable,
  scoringPlayerAwardsTable,
  scoringStandingsTable,
  scoringSessionsTable,
  matchConfigurationHistoryTable,
  runtimeMatchHistoryTable,
  scorerMatchLocksTable,
  masterTeamsTable,
  globalPlayersTable,
  playerTeamAssignmentsTable,
  tournamentPlayerProfilesTable,
  masterPlayerIdMappingsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildCricketScorecardFromEvents,
  scorecardToPlayerStats,
  pickManOfTheMatch,
  buildStandingsFromMatches,
  type PlayerMatchStatsInput,
  type BattingCardRow,
  type BowlingCardRow,
  type StandingsMatchInput,
} from "@workspace/scoring-core";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const TOURNAMENT_ID = 10;
const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.replace("#", "")}&color=fff&size=200&bold=true`;

// Teams Configuration for Varanasi Schools
const groupsConfig = [
  {
    groupName: "Group A",
    sortOrder: 1,
    teams: [
      { name: "DPS Varanasi", shortCode: "DPS", color: "#10B981", owner: "R.K. Sharma", mobile: "9838000001" },
      { name: "Aryan International School", shortCode: "AIS", color: "#3B82F6", owner: "Vipin Tripathi", mobile: "9838000002" },
      { name: "St. John's School DLW", shortCode: "SJS", color: "#EF4444", owner: "Father Thomas", mobile: "9838000003" },
      { name: "W.H. Smith Memorial School", shortCode: "WHS", color: "#F59E0B", owner: "Anil Mehrotra", mobile: "9838000004" },
    ],
  },
  {
    groupName: "Group B",
    sortOrder: 2,
    teams: [
      { name: "Unique Academy", shortCode: "UAC", color: "#8B5CF6", owner: "Sanjay Pandey", mobile: "9838000005" },
      { name: "Sunbeam School Basant", shortCode: "SSB", color: "#EC4899", owner: "Amrita Basant", mobile: "9838000006" },
      { name: "Care & Career Academy", shortCode: "CCA", color: "#06B6D4", owner: "Dr. A.K. Jaiswal", mobile: "9838000007" },
      { name: "St. Atulanand Academy", shortCode: "SAA", color: "#F97316", owner: "Divyansh Singh", mobile: "9838000008" },
    ],
  },
];

// 7 Indian Kids Players per team
const playersByTeamCode: Record<string, Array<{ name: string; role: string; batting: string; bowling?: string }>> = {
  DPS: [
    { name: "Aarav Patel (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Vihaan Singh (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Reyansh Sharma", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Advik Gupta", role: "All-rounder", batting: "Left-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Kabir Mishra", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Atharva Pandey", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Right-arm leg-spin" },
    { name: "Ishan Yadav", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  AIS: [
    { name: "Ayaan Tripathi (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Dhruv Srivastava (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Vivaan Tiwari", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Shaurya Verma", role: "All-rounder", batting: "Left-hand bat", bowling: "Right-arm off-spin" },
    { name: "Samar Jaiswal", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Pranay Agrawal", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Right-arm leg-spin" },
    { name: "Arnav Keshari", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  SJS: [
    { name: "Ronit Mukherjee (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Ethan D'Souza (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Aniket Roy", role: "All-rounder", batting: "Left-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Shivansh Dubey", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Devansh Shukla", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Tejas Choubey", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Right-arm off-spin" },
    { name: "Utkarsh Rai", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  WHS: [
    { name: "Ayushmaan Sen (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Krishna Maurya (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Manan Rastogi", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Shreyas Pathak", role: "All-rounder", batting: "Left-hand bat", bowling: "Right-arm off-spin" },
    { name: "Harshil Chaurasia", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Parth Srivastava", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Vedant Pandey", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  UAC: [
    { name: "Rudra Pratap (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Shivam Bind (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Yug Swaroop", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Nakul Seth", role: "All-rounder", batting: "Left-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Samarth Kushwaha", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Tanmay Upadhyay", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Right-arm leg-spin" },
    { name: "Naman Baranwal", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  SSB: [
    { name: "Ojasvi Kapoor (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Raghav Jhunjhunwala (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Krrish Singhania", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Daksh Agarwal", role: "All-rounder", batting: "Left-hand bat", bowling: "Right-arm off-spin" },
    { name: "Vansh Kashyap", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Bhavya Madhok", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Hardik Modi", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  CCA: [
    { name: "Rishit Jaiswal (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Abhinav Gautam (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Shlok Ranjan", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Pratyush Prakash", role: "All-rounder", batting: "Left-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Divit Malviya", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Chirag Khandelwal", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Right-arm leg-spin" },
    { name: "Omkar Nath", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
  SAA: [
    { name: "Kartikeya Mishra (c)", role: "Top-order Batter", batting: "Right-hand bat" },
    { name: "Mayank Singh (wk)", role: "Wicketkeeper Batter", batting: "Right-hand bat" },
    { name: "Aayushmaan Dixit", role: "All-rounder", batting: "Right-hand bat", bowling: "Right-arm medium" },
    { name: "Shashwat Bhattacharya", role: "All-rounder", batting: "Left-hand bat", bowling: "Right-arm off-spin" },
    { name: "Yashvardhan Singh", role: "Fast Bowler", batting: "Right-hand bat", bowling: "Right-arm fast" },
    { name: "Anshuman Dwivedi", role: "Spin Bowler", batting: "Right-hand bat", bowling: "Slow left-arm orthodox" },
    { name: "Tanishq Srivastava", role: "Bowler", batting: "Right-hand bat", bowling: "Right-arm medium" },
  ],
};

async function purgeTournamentData(tournamentId: number) {
  console.log(`Cleaning old tournament data for tournament ${tournamentId}...`);

  const matches = await db
    .select({ id: scoringMatchesTable.id })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId));

  const matchIds = matches.map((m) => m.id);
  if (matchIds.length > 0) {
    await db.delete(scoringEventsTable).where(inArray(scoringEventsTable.matchId, matchIds));
    await db.delete(scoringSessionsTable).where(inArray(scoringSessionsTable.matchId, matchIds));
    await db.delete(scoringMatchSquadsTable).where(inArray(scoringMatchSquadsTable.matchId, matchIds));
    await db.delete(scoringMatchPlayerStatsTable).where(inArray(scoringMatchPlayerStatsTable.matchId, matchIds));
    await db.delete(scoringPlayerAwardsTable).where(inArray(scoringPlayerAwardsTable.matchId, matchIds));
    await db.delete(matchConfigurationHistoryTable).where(inArray(matchConfigurationHistoryTable.matchId, matchIds));
    await db.delete(runtimeMatchHistoryTable).where(inArray(runtimeMatchHistoryTable.matchId, matchIds));
    await db.delete(scorerMatchLocksTable).where(inArray(scorerMatchLocksTable.matchId, matchIds));
  }

  await db.delete(scoringMatchesTable).where(eq(scoringMatchesTable.tournamentId, tournamentId));
  await db.delete(scoringFixturesTable).where(eq(scoringFixturesTable.tournamentId, tournamentId));

  const groups = await db
    .select({ id: scoringGroupsTable.id })
    .from(scoringGroupsTable)
    .where(eq(scoringGroupsTable.tournamentId, tournamentId));
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await db.delete(scoringGroupMembersTable).where(inArray(scoringGroupMembersTable.groupId, groupIds));
  }
  await db.delete(scoringGroupsTable).where(eq(scoringGroupsTable.tournamentId, tournamentId));
  await db.delete(scoringDrawsTable).where(eq(scoringDrawsTable.tournamentId, tournamentId));
  await db.delete(scoringStandingsTable).where(eq(scoringStandingsTable.tournamentId, tournamentId));
  await db.delete(scoringVenuesTable).where(eq(scoringVenuesTable.tournamentId, tournamentId));

  await db.delete(playerTeamAssignmentsTable).where(eq(playerTeamAssignmentsTable.tournamentId, tournamentId));
  await db.delete(tournamentPlayerProfilesTable).where(eq(tournamentPlayerProfilesTable.tournamentId, tournamentId));
  await db.delete(masterPlayerIdMappingsTable).where(eq(masterPlayerIdMappingsTable.tournamentId, tournamentId));
  await db.delete(playersTable).where(eq(playersTable.tournamentId, tournamentId));
  await db.delete(teamsTable).where(eq(teamsTable.tournamentId, tournamentId));
}

// Ball-by-ball simulator for 5 overs cricket match
function generateInningsBalls(options: {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  batters: Array<{ id: number; name: string }>;
  bowlers: Array<{ id: number; name: string }>;
  targetRuns?: number; // Target to defend/chase
  overs: number;
  maxWickets: number;
}) {
  const { innings, batters, bowlers, targetRuns, overs, maxWickets } = options;
  const events: Array<{
    eventType: string;
    payload: Record<string, unknown>;
  }> = [];

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;
  let totalRuns = 0;
  let totalWickets = 0;
  let ballsBowled = 0;

  let striker = batters[strikerIdx];
  let nonStriker = batters[nonStrikerIdx];

  // Pre-determined realistic ball run sequences
  // Runs generator biased for exciting 5-over match (avg 8-12 runs per over)
  const getRandomRun = () => {
    const r = Math.random();
    if (r < 0.28) return 0; // dot ball
    if (r < 0.58) return 1; // single
    if (r < 0.72) return 2; // double
    if (r < 0.86) return 4; // four
    if (r < 0.94) return 6; // six
    return 1; // extra single
  };

  // Select 5 bowlers for 5 overs (1 over per bowler rule)
  const assignedBowlers = bowlers.slice(2, 7); // using all-rounders and bowlers

  for (let overIdx = 0; overIdx < overs; overIdx++) {
    const bowler = assignedBowlers[overIdx % assignedBowlers.length];

    for (let ballNum = 1; ballNum <= 6; ballNum++) {
      if (totalWickets >= maxWickets) break;
      if (targetRuns && totalRuns >= targetRuns) break;

      ballsBowled++;
      const isWicket = Math.random() < 0.12 && totalWickets < maxWickets; // ~1-3 wickets per innings

      if (isWicket) {
        totalWickets++;
        const dismissedPlayer = striker;
        const dismissalTypes = ["bowled", "caught", "lbw", "run_out"] as const;
        const dismissalType = dismissalTypes[Math.floor(Math.random() * dismissalTypes.length)];
        const fielder = dismissalType === "caught" ? bowlers[Math.floor(Math.random() * bowlers.length)].id : undefined;

        events.push({
          eventType: CricketEventType.BALL_RECORDED,
          payload: {
            innings,
            over: overIdx,
            ball: ballNum,
            strikerId: striker.id,
            nonStrikerId: nonStriker.id,
            bowlerId: bowler.id,
            runsOffBat: 0,
            extras: { type: null, runs: 0 },
            wicket: {
              type: dismissalType,
              dismissedPlayerId: dismissedPlayer.id,
              fielderId: fielder,
            },
            isLegalDelivery: true,
          },
        });

        if (nextBatterIdx < batters.length && totalWickets < maxWickets) {
          strikerIdx = nextBatterIdx++;
          striker = batters[strikerIdx];
        }
      } else {
        const runs = getRandomRun();
        totalRuns += runs;

        events.push({
          eventType: CricketEventType.BALL_RECORDED,
          payload: {
            innings,
            over: overIdx,
            ball: ballNum,
            strikerId: striker.id,
            nonStrikerId: nonStriker.id,
            bowlerId: bowler.id,
            runsOffBat: runs,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          },
        });

        // Rotate strike on odd runs
        if (runs % 2 === 1) {
          const temp = striker;
          striker = nonStriker;
          nonStriker = temp;
        }
      }

      if (targetRuns && totalRuns >= targetRuns) break;
    }

    if (totalWickets >= maxWickets || (targetRuns && totalRuns >= targetRuns)) break;

    // End of over: switch strike
    const temp = striker;
    striker = nonStriker;
    nonStriker = temp;
  }

  const completedOvers = Math.floor(ballsBowled / 6);
  const remBalls = ballsBowled % 6;
  const oversStr = `${completedOvers}.${remBalls}`;

  return {
    events,
    totalRuns,
    totalWickets,
    oversStr,
    allOut: totalWickets >= maxWickets,
  };
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🏏 Seeding Varanasi School Cricket Tournament (ID: ${TOURNAMENT_ID})`);
  console.log(`======================================================\n`);

  // 1. Clean previous data in Tournament 10
  await purgeTournamentData(TOURNAMENT_ID);

  // 2. Update Tournament 10 Settings
  const todayStr = "2026-09-22";
  await db
    .update(tournamentsTable)
    .set({
      name: "BidWar Champions Trophy (Outdoor Cricket)",
      sport: "cricket",
      city: "Varanasi",
      venue: "Sigra Sports Stadium, Varanasi",
      status: "active",
      scoringEnabled: true,
      scoringPhase: "active",
      scoringPin: "5678",
      variantId: "outdoor",
      competitionTypeId: "round_robin_groups",
      ruleProfileId: "cricket_5_overs_7_players",
      squadRulesJson: {
        minPlayers: 7,
        maxPlayers: 7,
        substitutes: 0,
        retentions: 0,
      },
      ruleOverridesJson: {
        values: {
          "cricket.match.overs_per_innings": 5,
          "cricket.match.max_wickets": 6,
          "cricket.match.playing_squad_size": 7,
          "cricket.match.bench_size": 0,
          "cricket.match.playing_xi_enforced": true,
          "cricket.dismissal.lbw_enabled": true,
          "cricket.extras.leg_bye_enabled": true,
          "cricket.bowling.free_hit_enabled": true,
          "cricket.tie_break.super_over_enabled": true,
        },
      },
    })
    .where(eq(tournamentsTable.id, TOURNAMENT_ID));

  // 3. Create Venue
  const [venue] = await db
    .insert(scoringVenuesTable)
    .values({
      tournamentId: TOURNAMENT_ID,
      name: "Ground 1 - Sigra Sports Stadium",
      city: "Varanasi",
      surfaceType: "Natural Grass Turf",
      status: "active",
    })
    .returning();

  // 4. Create Draw
  const [draw] = await db
    .insert(scoringDrawsTable)
    .values({
      tournamentId: TOURNAMENT_ID,
      name: "Inter-School League Stage (2 Groups)",
      format: "group_stage",
      status: "in_progress",
      lifecycleStatus: "ready",
      configurationLocked: true,
      schedulingLifecycleStatus: "ready",
      schedulingConfigurationLocked: true,
    })
    .returning();

  // 5. Create 2 Groups & 8 Teams & 56 Players
  const createdTeams: Record<string, typeof teamsTable.$inferSelect> = {};
  const teamPlayers: Record<number, Array<typeof playersTable.$inferSelect>> = {};
  const groupRecordMap: Record<string, typeof scoringGroupsTable.$inferSelect> = {};

  let globalPlayerSerial = 1;

  for (const gConfig of groupsConfig) {
    const [groupRecord] = await db
      .insert(scoringGroupsTable)
      .values({
        tournamentId: TOURNAMENT_ID,
        drawId: draw.id,
        name: gConfig.groupName,
        sortOrder: gConfig.sortOrder,
      })
      .returning();

    groupRecordMap[gConfig.groupName] = groupRecord;

    for (let tIdx = 0; tIdx < gConfig.teams.length; tIdx++) {
      const t = gConfig.teams[tIdx];
      const masterTeamId = `mt_vns_${t.shortCode.toLowerCase()}_${TOURNAMENT_ID}`;

      await db
        .insert(masterTeamsTable)
        .values({
          id: masterTeamId,
          name: t.name,
          shortName: t.shortCode,
          primaryColor: t.color,
          ownerName: t.owner,
          logoUrl: avatar(t.shortCode, t.color),
        })
        .onConflictDoNothing();

      const [team] = await db
        .insert(teamsTable)
        .values({
          tournamentId: TOURNAMENT_ID,
          name: t.name,
          shortCode: t.shortCode,
          ownerName: t.owner,
          ownerMobile: t.mobile,
          color: t.color,
          logoUrl: avatar(t.shortCode, t.color),
          masterTeamId,
          purse: 10000000,
          purseUsed: 10000000,
        })
        .returning();

      createdTeams[t.shortCode] = team;
      teamPlayers[team.id] = [];

      // Link to group
      await db.insert(scoringGroupMembersTable).values({
        groupId: groupRecord.id,
        teamId: team.id,
        seed: tIdx + 1,
      });

      // Insert 7 Players
      const pList = playersByTeamCode[t.shortCode] || [];
      for (let pIdx = 0; pIdx < pList.length; pIdx++) {
        const p = pList[pIdx];
        const gpId = `gp_vns_${t.shortCode.toLowerCase()}_${pIdx + 1}`;
        const mobile = `98380${gConfig.sortOrder}${tIdx}${pIdx}${Math.floor(100 + Math.random() * 900)}`;

        await db
          .insert(globalPlayersTable)
          .values({
            id: gpId,
            canonicalName: p.name,
            displayName: p.name,
            mobileNumber: mobile,
            sport: "cricket",
          })
          .onConflictDoNothing();

        const [player] = await db
          .insert(playersTable)
          .values({
            tournamentId: TOURNAMENT_ID,
            serialNo: globalPlayerSerial++,
            teamId: team.id,
            name: p.name,
            role: p.role,
            battingStyle: p.batting,
            bowlingStyle: p.bowling,
            basePrice: 500000,
            soldPrice: 500000 + pIdx * 100000,
            status: "sold",
            mobileNumber: mobile,
            globalPlayerId: gpId,
            jerseyNumber: String((pIdx + 1) * 7 % 99 + 1),
          })
          .returning();

        teamPlayers[team.id].push(player);

        await db.insert(playerTeamAssignmentsTable).values({
          playerId: gpId,
          teamId: masterTeamId,
          tournamentId: TOURNAMENT_ID,
          sport: "cricket",
          isActive: true,
          auctionPlayerId: player.id,
          auctionTeamId: team.id,
        });

        await db
          .insert(tournamentPlayerProfilesTable)
          .values({
            tournamentId: TOURNAMENT_ID,
            masterPlayerId: gpId,
            displayName: p.name,
            initials: p.name.split(" ").map((n) => n[0]).join(""),
          })
          .onConflictDoNothing();
      }
    }
  }

  console.log(`✅ 8 Teams and 56 Players inserted across Group A & Group B!`);

  // 6. Define Fixtures Schedule
  // Group A: DPS, AIS, SJS, WHS (6 matches)
  // Group B: UAC, SSB, CCA, SAA (6 matches)
  const matchSchedule = [
    // --- GROUP A LEAGUE MATCHES ---
    {
      matchNo: 1,
      group: "Group A",
      home: "DPS",
      away: "AIS",
      time: "09:00 AM",
      offsetMinutes: -300,
      status: "completed" as const,
      label: "Match #1 (Group A): DPS Varanasi vs Aryan International",
      tossWinner: "DPS",
      electedTo: "bat" as const,
      inn1Target: 58,
      inn2Target: 52,
    },
    {
      matchNo: 2,
      group: "Group A",
      home: "SJS",
      away: "WHS",
      time: "10:15 AM",
      offsetMinutes: -225,
      status: "completed" as const,
      label: "Match #2 (Group A): St. John's DLW vs W.H. Smith Memorial",
      tossWinner: "WHS",
      electedTo: "bowl" as const,
      inn1Target: 44,
      inn2Target: 47,
    },
    {
      matchNo: 3,
      group: "Group A",
      home: "DPS",
      away: "SJS",
      time: "11:30 AM",
      offsetMinutes: -150,
      status: "completed" as const,
      label: "Match #3 (Group A): DPS Varanasi vs St. John's DLW",
      tossWinner: "DPS",
      electedTo: "bat" as const,
      inn1Target: 62,
      inn2Target: 38,
    },
    {
      matchNo: 4,
      group: "Group A",
      home: "AIS",
      away: "WHS",
      time: "02:30 PM",
      offsetMinutes: 0,
      status: "scheduled" as const,
      label: "Match #4 (Group A): Aryan International vs W.H. Smith Memorial",
    },
    {
      matchNo: 5,
      group: "Group A",
      home: "DPS",
      away: "WHS",
      time: "03:45 PM",
      offsetMinutes: 75,
      status: "scheduled" as const,
      label: "Match #5 (Group A): DPS Varanasi vs W.H. Smith Memorial",
    },
    {
      matchNo: 6,
      group: "Group A",
      home: "AIS",
      away: "SJS",
      time: "05:00 PM",
      offsetMinutes: 150,
      status: "scheduled" as const,
      label: "Match #6 (Group A): Aryan International vs St. John's DLW",
    },

    // --- GROUP B LEAGUE MATCHES ---
    {
      matchNo: 7,
      group: "Group B",
      home: "UAC",
      away: "SSB",
      time: "09:30 AM",
      offsetMinutes: -270,
      status: "completed" as const,
      label: "Match #7 (Group B): Unique Academy vs Sunbeam School Basant",
      tossWinner: "SSB",
      electedTo: "bowl" as const,
      inn1Target: 41,
      inn2Target: 44,
    },
    {
      matchNo: 8,
      group: "Group B",
      home: "CCA",
      away: "SAA",
      time: "10:45 AM",
      offsetMinutes: -195,
      status: "completed" as const,
      label: "Match #8 (Group B): Care & Career vs St. Atulanand Academy",
      tossWinner: "SAA",
      electedTo: "bat" as const,
      inn1Target: 65,
      inn2Target: 50,
    },
    {
      matchNo: 9,
      group: "Group B",
      home: "UAC",
      away: "CCA",
      time: "12:00 PM",
      offsetMinutes: -120,
      status: "completed" as const,
      label: "Match #9 (Group B): Unique Academy vs Care & Career",
      tossWinner: "UAC",
      electedTo: "bowl" as const,
      inn1Target: 46,
      inn2Target: 49,
    },
    {
      matchNo: 10,
      group: "Group B",
      home: "SSB",
      away: "SAA",
      time: "06:15 PM",
      offsetMinutes: 225,
      status: "scheduled" as const,
      label: "Match #10 (Group B): Sunbeam School Basant vs St. Atulanand Academy",
    },
    {
      matchNo: 11,
      group: "Group B",
      home: "UAC",
      away: "SAA",
      time: "07:30 PM",
      offsetMinutes: 300,
      status: "scheduled" as const,
      label: "Match #11 (Group B): Unique Academy vs St. Atulanand Academy",
    },
    {
      matchNo: 12,
      group: "Group B",
      home: "SSB",
      away: "CCA",
      time: "08:45 PM",
      offsetMinutes: 375,
      status: "scheduled" as const,
      label: "Match #12 (Group B): Sunbeam School Basant vs Care & Career",
    },
  ];

  const rulesSnapshot = {
    overs: 5,
    maxWickets: 6,
    playingSquadSize: 7,
    benchSize: 0,
    lbwEnabled: true,
    legByeEnabled: true,
    freeHitEnabled: true,
    superOverEnabled: true,
    cricketFormat: "t5_junior",
  };

  const baseDate = new Date(`${todayStr}T09:00:00.000Z`);

  const completedMatchesList: any[] = [];

  for (const mSched of matchSchedule) {
    const homeTeam = createdTeams[mSched.home];
    const awayTeam = createdTeams[mSched.away];
    const groupRecord = groupRecordMap[mSched.group];

    const matchTime = new Date(baseDate.getTime() + mSched.offsetMinutes * 60 * 1000);

    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: TOURNAMENT_ID,
        drawId: draw.id,
        groupId: groupRecord.id,
        roundName: `${mSched.group} League Match`,
        fixtureNumber: mSched.matchNo,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        scheduledAt: matchTime,
        venueId: venue.id,
        venue: venue.name,
        status: mSched.status,
      })
      .returning();

    const [match] = await db
      .insert(scoringMatchesTable)
      .values({
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        matchLabel: mSched.label,
        roundName: `${mSched.group} Stage`,
        scheduledAt: matchTime,
        venueId: venue.id,
        venue: venue.name,
        status: mSched.status,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        rulesJson: rulesSnapshot,
        startedAt: mSched.status === "completed" ? matchTime : null,
        completedAt: mSched.status === "completed" ? new Date(matchTime.getTime() + 45 * 60 * 1000) : null,
      })
      .returning();

    // Populate Match Squads (7 Playing Kids)
    const homePlayingIds = teamPlayers[homeTeam.id].map((p) => p.id);
    const awayPlayingIds = teamPlayers[awayTeam.id].map((p) => p.id);

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: homeTeam.id,
      squadJson: {
        playingXi: homePlayingIds,
        bench: [],
        battingOrder: homePlayingIds,
        captainId: homePlayingIds[0],
        wicketKeeperId: homePlayingIds[1],
      },
    });

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: awayTeam.id,
      squadJson: {
        playingXi: awayPlayingIds,
        bench: [],
        battingOrder: awayPlayingIds,
        captainId: awayPlayingIds[0],
        wicketKeeperId: awayPlayingIds[1],
      },
    });

    // If completed match, generate full ball-by-ball simulation
    if (mSched.status === "completed") {
      const tossWinnerTeam = createdTeams[mSched.tossWinner!];
      const tossLoserTeam = tossWinnerTeam.id === homeTeam.id ? awayTeam : homeTeam;
      const battingFirstTeam =
        mSched.electedTo === "bat" ? tossWinnerTeam : tossLoserTeam;
      const bowlingFirstTeam =
        battingFirstTeam.id === homeTeam.id ? awayTeam : homeTeam;

      const inn1Batters = teamPlayers[battingFirstTeam.id];
      const inn1Bowlers = teamPlayers[bowlingFirstTeam.id];
      const inn2Batters = teamPlayers[bowlingFirstTeam.id];
      const inn2Bowlers = teamPlayers[battingFirstTeam.id];

      // 1. MATCH STARTED event
      let seq = 1;
      const events: Array<{
        matchId: number;
        tournamentId: number;
        fixtureId: number;
        sportSlug: string;
        eventType: string;
        eventVersion: number;
        sequence: number;
        occurredAt: Date;
        actorType: string;
        payloadJson: Record<string, unknown>;
      }> = [];

      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: matchTime,
        actorType: "scorer",
        payloadJson: {
          tossWinnerTeamId: tossWinnerTeam.id,
          electedTo: mSched.electedTo,
          oversLimit: 5,
        },
      });

      // 2. LINEUP SET events
      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: matchTime,
        actorType: "scorer",
        payloadJson: {
          teamId: battingFirstTeam.id,
          playerIds: inn1Batters.map((p) => p.id),
        },
      });

      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: matchTime,
        actorType: "scorer",
        payloadJson: {
          teamId: bowlingFirstTeam.id,
          playerIds: inn2Batters.map((p) => p.id),
        },
      });

      // 3. INNINGS 1 BALLS
      const simInn1 = generateInningsBalls({
        innings: 1,
        battingTeamId: battingFirstTeam.id,
        bowlingTeamId: bowlingFirstTeam.id,
        batters: inn1Batters,
        bowlers: inn1Bowlers,
        overs: 5,
        maxWickets: 6,
      });

      let ballTimestamp = new Date(matchTime.getTime() + 60 * 1000);

      for (const b of simInn1.events) {
        ballTimestamp = new Date(ballTimestamp.getTime() + 45 * 1000);
        events.push({
          matchId: match.id,
          tournamentId: TOURNAMENT_ID,
          fixtureId: fixture.id,
          sportSlug: "cricket",
          eventType: b.eventType,
          eventVersion: 1,
          sequence: seq++,
          occurredAt: ballTimestamp,
          actorType: "scorer",
          payloadJson: b.payload,
        });
      }

      // End of Innings 1
      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.INNINGS_ENDED,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: ballTimestamp,
        actorType: "scorer",
        payloadJson: {
          innings: 1,
          reason: simInn1.allOut ? "all_out" : "overs_complete",
          runs: simInn1.totalRuns,
          wickets: simInn1.totalWickets,
          overs: simInn1.oversStr,
        },
      });

      // 4. INNINGS 2 BALLS (Chase)
      const target = simInn1.totalRuns + 1;
      const simInn2 = generateInningsBalls({
        innings: 2,
        battingTeamId: bowlingFirstTeam.id,
        bowlingTeamId: battingFirstTeam.id,
        batters: inn2Batters,
        bowlers: inn2Bowlers,
        targetRuns: target,
        overs: 5,
        maxWickets: 6,
      });

      ballTimestamp = new Date(ballTimestamp.getTime() + 10 * 60 * 1000); // Innings break

      for (const b of simInn2.events) {
        ballTimestamp = new Date(ballTimestamp.getTime() + 45 * 1000);
        events.push({
          matchId: match.id,
          tournamentId: TOURNAMENT_ID,
          fixtureId: fixture.id,
          sportSlug: "cricket",
          eventType: b.eventType,
          eventVersion: 1,
          sequence: seq++,
          occurredAt: ballTimestamp,
          actorType: "scorer",
          payloadJson: b.payload,
        });
      }

      // Determine Winner & Result Summary
      let winnerTeamId: number | null = null;
      let margin = "";
      let resultText = "";

      if (simInn2.totalRuns >= target) {
        winnerTeamId = bowlingFirstTeam.id;
        const wicketsLeft = 6 - simInn2.totalWickets;
        margin = `${wicketsLeft} wicket${wicketsLeft > 1 ? "s" : ""}`;
        resultText = `${bowlingFirstTeam.name} won by ${margin}`;
      } else if (simInn2.totalRuns < simInn1.totalRuns) {
        winnerTeamId = battingFirstTeam.id;
        const runsDiff = simInn1.totalRuns - simInn2.totalRuns;
        margin = `${runsDiff} run${runsDiff > 1 ? "s" : ""}`;
        resultText = `${battingFirstTeam.name} won by ${margin}`;
      } else {
        resultText = "Match Tied";
      }

      // End of Innings 2
      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.INNINGS_ENDED,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: ballTimestamp,
        actorType: "scorer",
        payloadJson: {
          innings: 2,
          reason: simInn2.totalRuns >= target ? "target_reached" : simInn2.allOut ? "all_out" : "overs_complete",
          runs: simInn2.totalRuns,
          wickets: simInn2.totalWickets,
          overs: simInn2.oversStr,
        },
      });

      // MATCH COMPLETED event
      events.push({
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_COMPLETED,
        eventVersion: 1,
        sequence: seq++,
        occurredAt: ballTimestamp,
        actorType: "scorer",
        payloadJson: {
          winnerTeamId,
          margin,
          resultText,
          isTie: winnerTeamId === null,
        },
      });

      // Insert all events
      await db.insert(scoringEventsTable).values(events);

      // Match Summary JSON
      const summaryJson = {
        innings: [
          {
            innings: 1,
            battingTeamId: battingFirstTeam.id,
            bowlingTeamId: bowlingFirstTeam.id,
            runs: simInn1.totalRuns,
            wickets: simInn1.totalWickets,
            overs: simInn1.oversStr,
            phase: "completed",
            kind: "normal",
            allOut: simInn1.allOut,
            oversLimit: 5,
          },
          {
            innings: 2,
            battingTeamId: bowlingFirstTeam.id,
            bowlingTeamId: battingFirstTeam.id,
            runs: simInn2.totalRuns,
            wickets: simInn2.totalWickets,
            overs: simInn2.oversStr,
            phase: "completed",
            kind: "normal",
            allOut: simInn2.allOut,
            oversLimit: 5,
          },
        ],
        target,
        winnerTeamId,
        resultText,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        oversLimit: 5,
        maxWickets: 6,
        currentInnings: 2,
        matchStatus: "completed",
      };

      // Update match row
      await db
        .update(scoringMatchesTable)
        .set({
          status: "completed",
          winnerTeamId,
          resultSummary: resultText,
          summaryJson,
        })
        .where(eq(scoringMatchesTable.id, match.id));

      await db
        .update(scoringFixturesTable)
        .set({
          status: "completed",
          winnerTeamId,
          resultSummary: resultText,
        })
        .where(eq(scoringFixturesTable.id, fixture.id));

      // Project Player Stats & Scorecards
      const envelopes = events.map((e, idx) => ({
        id: idx + 1,
        matchId: match.id,
        tournamentId: TOURNAMENT_ID,
        fixtureId: fixture.id,
        sportSlug: "cricket" as const,
        eventType: e.eventType,
        eventVersion: 1,
        sequence: e.sequence,
        occurredAt: e.occurredAt,
        actorType: "scorer" as const,
        payload: e.payloadJson,
      }));

      const scorecard = buildCricketScorecardFromEvents(match.id, envelopes, {
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
      });

      const playerRows = scorecardToPlayerStats(scorecard);
      if (playerRows.length > 0) {
        await db.insert(scoringMatchPlayerStatsTable).values(
          playerRows.map((row) => ({
            matchId: match.id,
            tournamentId: TOURNAMENT_ID,
            playerId: row.playerId,
            teamId: row.teamId,
            innings: row.innings,
            battingJson: row.batting
              ? {
                  runs: row.batting.runs,
                  balls: row.batting.balls,
                  fours: row.batting.fours,
                  sixes: row.batting.sixes,
                  strikeRate: row.batting.strikeRate,
                  notOut: row.batting.notOut,
                  dismissalType: row.batting.dismissalType,
                }
              : null,
            bowlingJson: row.bowling
              ? {
                  overs: row.bowling.overs,
                  maidens: row.bowling.maidens,
                  runs: row.bowling.runs,
                  wickets: row.bowling.wickets,
                  wides: row.bowling.wides,
                  noBalls: row.bowling.noBalls,
                  economy: row.bowling.economy,
                }
              : null,
            fieldingJson: row.fielding,
          })),
        );

        // Man of the match award
        const momStats: PlayerMatchStatsInput[] = playerRows.map((r) => ({
          playerId: r.playerId,
          teamId: r.teamId,
          batting: r.batting,
          bowling: r.bowling,
          fielding: r.fielding,
        }));

        const mom = pickManOfTheMatch(momStats, winnerTeamId);
        if (mom) {
          await db.insert(scoringPlayerAwardsTable).values({
            tournamentId: TOURNAMENT_ID,
            matchId: match.id,
            playerId: mom.playerId,
            teamId: mom.teamId,
            awardType: "man_of_the_match",
            points: String(mom.score),
            reason: mom.reason,
          });
        }
      }

      completedMatchesList.push({
        matchId: match.id,
        status: "completed" as const,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        summary: summaryJson,
        isTie: winnerTeamId === null,
      });

      console.log(`   ✨ Completed: ${mSched.label} -> ${resultText} (Inn1: ${simInn1.totalRuns}/${simInn1.totalWickets}, Inn2: ${simInn2.totalRuns}/${simInn2.totalWickets})`);
    } else {
      console.log(`   ⏳ Scheduled: ${mSched.label} at ${mSched.time}`);
    }
  }

  // 7. Calculate and Persist Points Table Standings
  const allTeamIds = Object.values(createdTeams).map((t) => t.id);
  const standingsInputs: StandingsMatchInput[] = completedMatchesList;
  const computedStandings = buildStandingsFromMatches(allTeamIds, standingsInputs);

  if (computedStandings.length > 0) {
    await db.insert(scoringStandingsTable).values(
      computedStandings.map((row) => ({
        tournamentId: TOURNAMENT_ID,
        teamId: row.teamId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        tied: row.tied,
        noResult: row.noResult,
        points: row.points,
        netRunRate: row.netRunRate.toFixed(3),
        extrasJson: {
          runsScored: row.runsScored,
          oversFaced: row.oversFaced,
          runsConceded: row.runsConceded,
          oversBowled: row.oversBowled,
        },
      })),
    );
  }

  console.log(`\n======================================================`);
  console.log(`🏆 TOURNAMENT DUMMY DATA SEEDING COMPLETE!`);
  console.log(`   Tournament ID: ${TOURNAMENT_ID}`);
  console.log(`   Total Teams: 8 (4 in Group A, 4 in Group B)`);
  console.log(`   Total Players: 56 (7 playing per team)`);
  console.log(`   Total Matches: 12 (6 Completed with live stats, 6 Scheduled)`);
  console.log(`   Live Control URL: http://localhost:24755/scoring-app/tournament/${TOURNAMENT_ID}/score/live-control`);
  console.log(`======================================================\n`);
}

main()
  .catch((err) => {
    console.error("Error seeding tournament data:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
