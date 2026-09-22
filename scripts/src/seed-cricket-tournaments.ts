import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  organizersTable,
  tournamentsTable,
  teamsTable,
  playersTable,
  scoringVenuesTable,
  scoringMatchesTable,
  scoringMatchSquadsTable,
  scoringDrawsTable,
  scoringFixturesTable,
  masterTeamsTable,
  globalPlayersTable,
  playerTeamAssignmentsTable,
  tournamentPlayerProfilesTable,
  masterPlayerIdMappingsTable,
} from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const TARGET_EMAIL = "tusharsaraswat1988@gmail.com";
const TARGET_MOBILE = "9829012345";
const DEFAULT_PASSWORD = process.env.LOCAL_ORGANIZER_PASSWORD?.trim() || "demo123";

const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.replace("#", "")}&color=fff&size=200&bold=true`;

async function main() {
  console.log(`\n======================================================`);
  console.log(`🏏 Seeding Cricket Tournaments for: ${TARGET_EMAIL}`);
  console.log(`======================================================\n`);

  // 1. Find or create Organizer
  let [organizer] = await db
    .select()
    .from(organizersTable)
    .where(eq(organizersTable.email, TARGET_EMAIL))
    .limit(1);

  if (!organizer) {
    const [byMobile] = await db
      .select()
      .from(organizersTable)
      .where(eq(organizersTable.mobile, TARGET_MOBILE))
      .limit(1);

    if (byMobile) {
      organizer = byMobile;
      await db
        .update(organizersTable)
        .set({ email: TARGET_EMAIL, licenseStatus: "active", maxTournaments: 20 })
        .where(eq(organizersTable.id, organizer.id));
      console.log(`Updated existing organizer (id=${organizer.id}) with email ${TARGET_EMAIL}`);
    } else {
      const [created] = await db
        .insert(organizersTable)
        .values({
          name: "Tushar Saraswat",
          email: TARGET_EMAIL,
          mobile: TARGET_MOBILE,
          licenseStatus: "active",
          maxTournaments: 20,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          whatsappConsent: true,
          whatsappConsentAt: new Date(),
        })
        .returning();
      organizer = created;
      console.log(`Created organizer record for ${TARGET_EMAIL} (id=${organizer.id})`);
    }
  } else {
    await db
      .update(organizersTable)
      .set({ licenseStatus: "active", maxTournaments: 20, phoneVerified: true })
      .where(eq(organizersTable.id, organizer.id));
    console.log(`Found organizer: ${organizer.name} (id=${organizer.id})`);
  }

  // Helper to purge tournament
  async function purgeTournamentIfExists(name: string) {
    const existing = await db
      .select()
      .from(tournamentsTable)
      .where(
        and(
          eq(tournamentsTable.organizerId, organizer.id),
          eq(tournamentsTable.name, name),
        ),
      );

    for (const t of existing) {
      console.log(`  Cleaning prior instance of '${name}' (id=${t.id})...`);
      const matches = await db.select({ id: scoringMatchesTable.id }).from(scoringMatchesTable).where(eq(scoringMatchesTable.tournamentId, t.id));
      if (matches.length > 0) {
        const matchIds = matches.map((m) => m.id);
        await db.delete(scoringMatchSquadsTable).where(inArray(scoringMatchSquadsTable.matchId, matchIds));
      }
      await db.delete(scoringMatchesTable).where(eq(scoringMatchesTable.tournamentId, t.id));
      await db.delete(scoringFixturesTable).where(eq(scoringFixturesTable.tournamentId, t.id));
      await db.delete(scoringDrawsTable).where(eq(scoringDrawsTable.tournamentId, t.id));
      await db.delete(scoringVenuesTable).where(eq(scoringVenuesTable.tournamentId, t.id));
      await db.delete(playerTeamAssignmentsTable).where(eq(playerTeamAssignmentsTable.tournamentId, t.id));
      await db.delete(tournamentPlayerProfilesTable).where(eq(tournamentPlayerProfilesTable.tournamentId, t.id));
      await db.delete(masterPlayerIdMappingsTable).where(eq(masterPlayerIdMappingsTable.tournamentId, t.id));
      await db.delete(playersTable).where(eq(playersTable.tournamentId, t.id));
      await db.delete(teamsTable).where(eq(teamsTable.tournamentId, t.id));
      await db.delete(tournamentsTable).where(eq(tournamentsTable.id, t.id));
    }
  }

  // =========================================================================
  // TOURNAMENT 1: BidWar Premier League (Box Cricket Edition)
  // =========================================================================
  const BOX_TOURNEY_NAME = "BidWar Premier League (Box Cricket)";
  await purgeTournamentIfExists(BOX_TOURNEY_NAME);

  console.log(`\n📦 Creating ${BOX_TOURNEY_NAME}...`);
  const [boxTourney] = await db
    .insert(tournamentsTable)
    .values({
      organizerId: organizer.id,
      name: BOX_TOURNEY_NAME,
      sport: "cricket",
      city: "Jaipur",
      venue: "Pink City Turf & Box Arena",
      auctionCode: "BPL" + Math.floor(1000 + Math.random() * 9000),
      organizerName: organizer.name,
      organizerEmail: TARGET_EMAIL,
      organizerMobile: organizer.mobile,
      organizerPassword: DEFAULT_PASSWORD,
      status: "active",
      licenseStatus: "active",
      scoringEnabled: true,
      scoringPhase: "active",
      scoringPin: "1234",
      playerRegistrationMode: "scoring",
      variantId: "box",
      competitionTypeId: "league_knockout",
      ruleProfileId: "box_cricket_default",
      ruleProfileVersion: "1.0.0",
      presentationProfileId: "box_cricket_presentation",
      presentationProfileVersion: "1.0.0",
      squadRulesJson: {
        minPlayers: 8,
        maxPlayers: 10,
        substitutes: 2,
        retentions: 0,
      },
      ruleOverridesJson: {
        values: {
          "cricket.match.overs_per_innings": 8,
          "cricket.match.max_wickets": 7,
          "cricket.match.playing_squad_size": 8,
          "cricket.match.bench_size": 2,
          "cricket.match.playing_xi_enforced": false,
          "cricket.batting.retire_at_runs": 30,
          "cricket.dismissal.lbw_enabled": false,
          "cricket.extras.leg_bye_enabled": false,
          "cricket.bowling.free_hit_enabled": true,
          "cricket.special.super_ball_enabled": true,
          "cricket.tie_break.super_over_enabled": true,
          "cricket.tie_break.super_over_overs": 1,
          "cricket.tie_break.super_over_wickets": 2,
        },
      },
    })
    .returning();

  // Create Venue
  const [boxVenue] = await db
    .insert(scoringVenuesTable)
    .values({
      tournamentId: boxTourney.id,
      name: "Court 1 - Main AstroTurf",
      city: "Jaipur",
      surfaceType: "AstroTurf",
      status: "active",
    })
    .returning();

  // 4 Box Teams
  const boxTeamsConfig = [
    { name: "Thunder Strikers", shortCode: "TST", color: "#EF4444", owner: "Amit Sharma", mobile: "9829100001" },
    { name: "Royal Smashers", shortCode: "RSM", color: "#3B82F6", owner: "Rohit Agarwal", mobile: "9829100002" },
    { name: "Blazing Titans", shortCode: "BTI", color: "#F59E0B", owner: "Vikas Meena", mobile: "9829100003" },
    { name: "Super Kings", shortCode: "SKG", color: "#10B981", owner: "Sanjay Verma", mobile: "9829100004" },
  ];

  const createdBoxTeams: any[] = [];
  for (const t of boxTeamsConfig) {
    const masterTeamId = `mt_box_${t.shortCode.toLowerCase()}_${boxTourney.id}`;
    await db.insert(masterTeamsTable).values({
      id: masterTeamId,
      name: t.name,
      shortName: t.shortCode,
      primaryColor: t.color,
      ownerName: t.owner,
      logoUrl: avatar(t.shortCode, t.color),
    }).onConflictDoNothing();

    const [team] = await db
      .insert(teamsTable)
      .values({
        tournamentId: boxTourney.id,
        name: t.name,
        shortCode: t.shortCode,
        ownerName: t.owner,
        ownerMobile: t.mobile,
        color: t.color,
        logoUrl: avatar(t.shortCode, t.color),
        masterTeamId,
        purse: 5000000,
        purseUsed: 5000000,
      })
      .returning();
    createdBoxTeams.push(team);
  }

  // 8 players per Box Team
  const boxPlayerNames = [
    // Thunder Strikers
    ["Tushar Saraswat", "Aarav Sharma", "Kabir Mehta", "Rohan Gupta", "Yash Joshi", "Devendra Singh", "Nitin Rathore", "Kunal Jain"],
    // Royal Smashers
    ["Mayank Agarwal", "Prakash Saini", "Siddharth Jain", "Gaurav Pareek", "Aditya Rawat", "Deepak Soni", "Aniket Goyal", "Manish Mathur"],
    // Blazing Titans
    ["Abhishek Chouhan", "Pankaj Vyas", "Tarun Bhati", "Rakesh Jangid", "Himanshu Khandelwal", "Lalit Tiwari", "Sourabh Tailor", "Prateek Saxena"],
    // Super Kings
    ["Virendra Shekhawat", "Dharmendra Tanwar", "Rajendra Bunkar", "Sunny Chhabra", "Hemant Gurjar", "Mohit Kumawat", "Chetan Sharma", "Kuldeep Bishnoi"],
  ];

  const roles = ["Top-order Batter", "All-rounder", "Wicketkeeper Batter", "All-rounder", "Hard-hitter", "Fast Bowler", "Spin Bowler", "Bowler"];
  const boxTeamPlayers: Record<number, any[]> = {};

  let serial = 1;
  for (let teamIdx = 0; teamIdx < createdBoxTeams.length; teamIdx++) {
    const team = createdBoxTeams[teamIdx];
    boxTeamPlayers[team.id] = [];
    const names = boxPlayerNames[teamIdx];

    for (let pIdx = 0; pIdx < names.length; pIdx++) {
      const pName = names[pIdx];
      const role = roles[pIdx % roles.length];
      const mobile = `98290${teamIdx}${pIdx}${Math.floor(100 + Math.random() * 900)}`;
      const gpId = `gp_box_${team.shortCode.toLowerCase()}_${pIdx + 1}`;

      await db.insert(globalPlayersTable).values({
        id: gpId,
        canonicalName: pName,
        displayName: pName,
        mobileNumber: mobile,
        sport: "cricket",
      }).onConflictDoNothing();

      const [player] = await db
        .insert(playersTable)
        .values({
          tournamentId: boxTourney.id,
          serialNo: serial++,
          teamId: team.id,
          name: pName,
          role,
          battingStyle: pIdx % 3 === 0 ? "Left-hand bat" : "Right-hand bat",
          bowlingStyle: pIdx % 2 === 0 ? "Right-arm medium" : "Right-arm off-spin",
          basePrice: 50000,
          soldPrice: 50000,
          status: "sold",
          mobileNumber: mobile,
          globalPlayerId: gpId,
          jerseyNumber: String((pIdx + 1) * 7 % 99 + 1),
        })
        .returning();

      boxTeamPlayers[team.id].push(player);

      await db.insert(playerTeamAssignmentsTable).values({
        playerId: gpId,
        teamId: team.masterTeamId!,
        tournamentId: boxTourney.id,
        sport: "cricket",
        isActive: true,
        auctionPlayerId: player.id,
        auctionTeamId: team.id,
      });

      await db.insert(tournamentPlayerProfilesTable).values({
        tournamentId: boxTourney.id,
        masterPlayerId: gpId,
        displayName: pName,
        initials: pName.split(" ").map((n: string) => n[0]).join(""),
      }).onConflictDoNothing();
    }
  }

  // Draw for Box Cricket
  const [boxDraw] = await db
    .insert(scoringDrawsTable)
    .values({
      tournamentId: boxTourney.id,
      name: "Group Stage & Finals",
      format: "round_robin",
      status: "in_progress",
      lifecycleStatus: "ready",
      configurationLocked: true,
      schedulingLifecycleStatus: "ready",
      schedulingConfigurationLocked: true,
    })
    .returning();

  // Create Fixtures & Matches for Box Cricket
  const boxMatchPairs = [
    { home: createdBoxTeams[0], away: createdBoxTeams[1], label: "Match 1: TST vs RSM (Opening Match)", offsetHours: 0 },
    { home: createdBoxTeams[2], away: createdBoxTeams[3], label: "Match 2: BTI vs SKG", offsetHours: 2 },
    { home: createdBoxTeams[0], away: createdBoxTeams[2], label: "Match 3: TST vs BTI", offsetHours: 4 },
    { home: createdBoxTeams[1], away: createdBoxTeams[3], label: "Match 4: RSM vs SKG", offsetHours: 6 },
  ];

  const createdBoxMatches: any[] = [];
  const now = new Date();

  for (let i = 0; i < boxMatchPairs.length; i++) {
    const pair = boxMatchPairs[i];
    const scheduledTime = new Date(now.getTime() + pair.offsetHours * 3600 * 1000);

    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: boxTourney.id,
        drawId: boxDraw.id,
        homeTeamId: pair.home.id,
        awayTeamId: pair.away.id,
        scheduledAt: scheduledTime,
        venueId: boxVenue.id,
        status: i === 0 ? "live" : "scheduled",
      })
      .returning();

    const rulesSnapshot = {
      overs: 8,
      maxWickets: 7,
      playingSquadSize: 8,
      benchSize: 2,
      lbwEnabled: false,
      legByeEnabled: false,
      freeHitEnabled: true,
      superBallEnabled: true,
      superOverEnabled: true,
      retireAtRuns: 30,
      cricketFormat: "box",
    };

    const [match] = await db
      .insert(scoringMatchesTable)
      .values({
        tournamentId: boxTourney.id,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        matchLabel: pair.label,
        roundName: "Round Robin",
        scheduledAt: scheduledTime,
        venueId: boxVenue.id,
        venue: boxVenue.name,
        status: i === 0 ? "scheduled" : "scheduled",
        homeTeamId: pair.home.id,
        awayTeamId: pair.away.id,
        rulesJson: rulesSnapshot,
        startedAt: i === 0 ? now : null,
      })
      .returning();

    createdBoxMatches.push(match);

    // Populate Match Squads (8 Playing players each)
    const homePlayingIds = boxTeamPlayers[pair.home.id].map((p: any) => p.id);
    const awayPlayingIds = boxTeamPlayers[pair.away.id].map((p: any) => p.id);

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: pair.home.id,
      squadJson: {
        playingXi: homePlayingIds,
        bench: [],
        battingOrder: homePlayingIds,
        captainId: homePlayingIds[0],
        wicketKeeperId: homePlayingIds[2],
      },
    });

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: pair.away.id,
      squadJson: {
        playingXi: awayPlayingIds,
        bench: [],
        battingOrder: awayPlayingIds,
        captainId: awayPlayingIds[0],
        wicketKeeperId: awayPlayingIds[2],
      },
    });
  }

  console.log(`✅ Box Cricket Tournament Seeded!`);
  console.log(`   ID: ${boxTourney.id}`);
  console.log(`   Scoring Hub: http://localhost:3000/tournament/${boxTourney.id}/score`);
  console.log(`   Live Scorer Pad: http://localhost:3000/tournament/${boxTourney.id}/score/${createdBoxMatches[0].id}/live`);

  // =========================================================================
  // TOURNAMENT 2: BidWar Champions Trophy (Outdoor Cricket Edition)
  // =========================================================================
  const OUTDOOR_TOURNEY_NAME = "BidWar Champions Trophy (Outdoor Cricket)";
  await purgeTournamentIfExists(OUTDOOR_TOURNEY_NAME);

  console.log(`\n🏏 Creating ${OUTDOOR_TOURNEY_NAME}...`);
  const [outdoorTourney] = await db
    .insert(tournamentsTable)
    .values({
      organizerId: organizer.id,
      name: OUTDOOR_TOURNEY_NAME,
      sport: "cricket",
      city: "Jaipur",
      venue: "Sawai Mansingh Stadium Club",
      auctionCode: "BCT" + Math.floor(1000 + Math.random() * 9000),
      organizerName: organizer.name,
      organizerEmail: TARGET_EMAIL,
      organizerMobile: organizer.mobile,
      organizerPassword: DEFAULT_PASSWORD,
      status: "completed", // Completed auction simulation
      licenseStatus: "active",
      scoringEnabled: true,
      scoringPhase: "active",
      scoringPin: "5678",
      playerRegistrationMode: "auction",
      basePurse: 100000000,
      minBid: 100000,
      bidIncrement: 50000,
      variantId: "outdoor",
      competitionTypeId: "round_robin",
      ruleProfileId: "t20_standard",
      ruleProfileVersion: "1.0.0",
      presentationProfileId: "cricket_standard",
      presentationProfileVersion: "1.0.0",
      squadRulesJson: {
        minPlayers: 11,
        maxPlayers: 15,
        substitutes: 4,
        retentions: 0,
      },
      ruleOverridesJson: {
        values: {
          "cricket.match.overs_per_innings": 20,
          "cricket.match.max_wickets": 10,
          "cricket.match.playing_squad_size": 11,
          "cricket.match.bench_size": 4,
          "cricket.match.playing_xi_enforced": true,
          "cricket.dismissal.lbw_enabled": true,
          "cricket.extras.leg_bye_enabled": true,
          "cricket.bowling.free_hit_enabled": true,
          "cricket.tie_break.super_over_enabled": true,
          "cricket.tie_break.super_over_overs": 1,
          "cricket.tie_break.super_over_wickets": 2,
        },
      },
    })
    .returning();

  const [outdoorVenue] = await db
    .insert(scoringVenuesTable)
    .values({
      tournamentId: outdoorTourney.id,
      name: "Main Ground - SMS Club",
      city: "Jaipur",
      surfaceType: "Natural Turf Pitch",
      status: "active",
    })
    .returning();

  const outdoorTeamsConfig = [
    { name: "Jaipur Jaguars", shortCode: "JJG", color: "#6366F1", owner: "Harsh Vardhan", mobile: "9829200001" },
    { name: "Rajasthan Stallions", shortCode: "RST", color: "#EC4899", owner: "Pradeep Rathore", mobile: "9829200002" },
    { name: "Desert Warriors", shortCode: "DWR", color: "#06B6D4", owner: "Neeraj Singhal", mobile: "9829200003" },
    { name: "Aravalli Aces", shortCode: "AAC", color: "#84CC16", owner: "Mukesh Sharma", mobile: "9829200004" },
  ];

  const createdOutdoorTeams: any[] = [];
  for (const t of outdoorTeamsConfig) {
    const masterTeamId = `mt_out_${t.shortCode.toLowerCase()}_${outdoorTourney.id}`;
    await db.insert(masterTeamsTable).values({
      id: masterTeamId,
      name: t.name,
      shortName: t.shortCode,
      primaryColor: t.color,
      ownerName: t.owner,
      logoUrl: avatar(t.shortCode, t.color),
    }).onConflictDoNothing();

    const [team] = await db
      .insert(teamsTable)
      .values({
        tournamentId: outdoorTourney.id,
        name: t.name,
        shortCode: t.shortCode,
        ownerName: t.owner,
        ownerMobile: t.mobile,
        color: t.color,
        logoUrl: avatar(t.shortCode, t.color),
        masterTeamId,
        purse: 100000000,
        purseUsed: 87500000,
      })
      .returning();
    createdOutdoorTeams.push(team);
  }

  // 12 players per outdoor team (11 playing XI + 1 bench)
  const outdoorPlayerNames = [
    // JJG
    ["Virat Kohli (c)", "Rohit Sharma", "Shubman Gill", "Suryakumar Yadav", "Rishabh Pant (wk)", "Hardik Pandya", "Ravindra Jadeja", "Jasprit Bumrah", "Mohammed Shami", "Kuldeep Yadav", "Mohammed Siraj", "Sanju Samson"],
    // RST
    ["Jos Buttler (c)", "Yashasvi Jaiswal", "KL Rahul", "Shimron Hetmyer", "Riyan Parag", "Dhruv Jurel (wk)", "Ravichandran Ashwin", "Yuzvendra Chahal", "Trent Boult", "Avesh Khan", "Sandeep Sharma", "Navdeep Saini"],
    // DWR
    ["David Warner (c)", "Travis Head", "Mitchell Marsh", "Glenn Maxwell", "Heinrich Klaasen (wk)", "Marcus Stoinis", "Pat Cummins", "Mitchell Starc", "Josh Hazlewood", "Adam Zampa", "Nathan Ellis", "Tim David"],
    // AAC
    ["Faf du Plessis (c)", "Ruturaj Gaikwad", "Devdutt Padikkal", "Shivam Dube", "Nicholas Pooran (wk)", "Andre Russell", "Sunil Narine", "Rashid Khan", "Arshdeep Singh", "Kagiso Rabada", "T Natarajan", "Dinesh Karthik"],
  ];

  const outdoorTeamPlayers: Record<number, any[]> = {};
  let outSerial = 1;

  for (let teamIdx = 0; teamIdx < createdOutdoorTeams.length; teamIdx++) {
    const team = createdOutdoorTeams[teamIdx];
    outdoorTeamPlayers[team.id] = [];
    const names = outdoorPlayerNames[teamIdx];

    for (let pIdx = 0; pIdx < names.length; pIdx++) {
      const pName = names[pIdx];
      const role = pIdx < 4 ? "Batter" : pIdx === 4 ? "Wicketkeeper Batter" : pIdx < 7 ? "All-rounder" : "Bowler";
      const mobile = `98293${teamIdx}${pIdx}${Math.floor(100 + Math.random() * 900)}`;
      const gpId = `gp_out_${team.shortCode.toLowerCase()}_${pIdx + 1}`;
      const soldPrice = 2000000 + (pIdx * 1500000);

      await db.insert(globalPlayersTable).values({
        id: gpId,
        canonicalName: pName,
        displayName: pName,
        mobileNumber: mobile,
        sport: "cricket",
      }).onConflictDoNothing();

      const [player] = await db
        .insert(playersTable)
        .values({
          tournamentId: outdoorTourney.id,
          serialNo: outSerial++,
          teamId: team.id,
          name: pName,
          role,
          battingStyle: pIdx % 4 === 0 ? "Left-hand bat" : "Right-hand bat",
          bowlingStyle: pIdx >= 6 ? (pIdx % 2 === 0 ? "Right-arm fast" : "Slow left-arm orthodox") : undefined,
          basePrice: 1000000,
          soldPrice,
          status: "sold",
          mobileNumber: mobile,
          globalPlayerId: gpId,
          jerseyNumber: String((pIdx + 1) * 3 % 99 + 1),
        })
        .returning();

      outdoorTeamPlayers[team.id].push(player);

      await db.insert(playerTeamAssignmentsTable).values({
        playerId: gpId,
        teamId: team.masterTeamId!,
        tournamentId: outdoorTourney.id,
        sport: "cricket",
        isActive: true,
        auctionPlayerId: player.id,
        auctionTeamId: team.id,
      });

      await db.insert(tournamentPlayerProfilesTable).values({
        tournamentId: outdoorTourney.id,
        masterPlayerId: gpId,
        displayName: pName,
        initials: pName.split(" ").map((n: string) => n[0]).join(""),
      }).onConflictDoNothing();
    }
  }

  const [outdoorDraw] = await db
    .insert(scoringDrawsTable)
    .values({
      tournamentId: outdoorTourney.id,
      name: "T20 League Stage",
      format: "round_robin",
      status: "in_progress",
    })
    .returning();

  const outdoorMatchPairs = [
    { home: createdOutdoorTeams[0], away: createdOutdoorTeams[1], label: "Match 1: JJG vs RST (Blockbuster Clash)", offsetHours: 0 },
    { home: createdOutdoorTeams[2], away: createdOutdoorTeams[3], label: "Match 2: DWR vs AAC", offsetHours: 3 },
    { home: createdOutdoorTeams[0], away: createdOutdoorTeams[2], label: "Match 3: JJG vs DWR", offsetHours: 6 },
  ];

  const createdOutdoorMatches: any[] = [];
  for (let i = 0; i < outdoorMatchPairs.length; i++) {
    const pair = outdoorMatchPairs[i];
    const scheduledTime = new Date(now.getTime() + pair.offsetHours * 3600 * 1000);

    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: outdoorTourney.id,
        drawId: outdoorDraw.id,
        homeTeamId: pair.home.id,
        awayTeamId: pair.away.id,
        scheduledAt: scheduledTime,
        venueId: outdoorVenue.id,
        status: "scheduled",
      })
      .returning();

    const rulesSnapshot = {
      overs: 20,
      maxWickets: 10,
      playingSquadSize: 11,
      benchSize: 4,
      lbwEnabled: true,
      legByeEnabled: true,
      freeHitEnabled: true,
      superOverEnabled: true,
      cricketFormat: "t20",
    };

    const [match] = await db
      .insert(scoringMatchesTable)
      .values({
        tournamentId: outdoorTourney.id,
        fixtureId: fixture.id,
        sportSlug: "cricket",
        matchLabel: pair.label,
        roundName: "League Stage",
        scheduledAt: scheduledTime,
        venueId: outdoorVenue.id,
        venue: outdoorVenue.name,
        status: "scheduled",
        homeTeamId: pair.home.id,
        awayTeamId: pair.away.id,
        rulesJson: rulesSnapshot,
      })
      .returning();

    createdOutdoorMatches.push(match);

    const homePlayingIds = outdoorTeamPlayers[pair.home.id].slice(0, 11).map((p: any) => p.id);
    const homeBenchIds = outdoorTeamPlayers[pair.home.id].slice(11).map((p: any) => p.id);
    const awayPlayingIds = outdoorTeamPlayers[pair.away.id].slice(0, 11).map((p: any) => p.id);
    const awayBenchIds = outdoorTeamPlayers[pair.away.id].slice(11).map((p: any) => p.id);

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: pair.home.id,
      squadJson: {
        playingXi: homePlayingIds,
        bench: homeBenchIds,
        battingOrder: homePlayingIds,
        captainId: homePlayingIds[0],
        wicketKeeperId: homePlayingIds[4],
      },
    });

    await db.insert(scoringMatchSquadsTable).values({
      matchId: match.id,
      teamId: pair.away.id,
      squadJson: {
        playingXi: awayPlayingIds,
        bench: awayBenchIds,
        battingOrder: awayPlayingIds,
        captainId: awayPlayingIds[0],
        wicketKeeperId: awayPlayingIds[4],
      },
    });
  }

  console.log(`✅ Outdoor Cricket Tournament Seeded!`);
  console.log(`   ID: ${outdoorTourney.id}`);
  console.log(`   Scoring Hub: http://localhost:3000/tournament/${outdoorTourney.id}/score`);
  console.log(`   Live Scorer Pad: http://localhost:3000/tournament/${outdoorTourney.id}/score/${createdOutdoorMatches[0].id}/live`);

  console.log(`\n🎉 Both Cricket Tournaments are successfully prepared and ready to test!`);
}

main()
  .catch((err) => {
    console.error("Error seeding cricket tournaments:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
