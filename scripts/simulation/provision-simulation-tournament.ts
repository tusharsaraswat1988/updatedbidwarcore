/**
 * Safe Simulation Tournament Provisioning Script
 * Milestone M2 — BIDWAR PREMIER LEAGUE Simulation Environment Setup
 *
 * This script provisions the prefix-isolated simulation environment:
 * - Tournament: "SIM_BIDWAR_PREMIER_LEAGUE" (Auction Code: "SIMBPL01")
 * - 5 Synthetic Teams (SIM_TITANS, SIM_WARRIORS, SIM_ROYALS, SIM_KINGS, SIM_STRIKERS)
 * - 24 Synthetic Players (6 Batsmen, 6 Bowlers, 6 All-Rounders, 6 Wicketkeepers)
 * - Active auction session initialized with status: 'active', revision: 0
 *
 * SAFETY GUARD:
 * Refuses execution if DATABASE_URL points to the production host ep-late-math-aohd4iep.
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  teamsTable,
  playersTable,
  auctionSessionsTable,
  bidsTable,
  auctionBidEventsTable,
  auctionPlayerEventsTable,
  auctionTimerEventsTable,
} from "@workspace/db";

// Load root .env
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const PROD_HOST_FRAGMENT = "ep-late-math-aohd4iep";
const DEV_HOST_FRAGMENT = "ep-long-sky-aorboyzr";

export function assertSafeDatabaseUrl(databaseUrl?: string): void {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error("[SAFETY CRITICAL] DATABASE_URL is not defined in environment.");
  }

  if (url.includes(PROD_HOST_FRAGMENT)) {
    throw new Error(
      `[CRITICAL SAFETY VIOLATION] DATABASE_URL contains production host fragment "${PROD_HOST_FRAGMENT}". ` +
      `Provisioning on production is STRICTLY PROHIBITED!`
    );
  }

  if (!url.includes(DEV_HOST_FRAGMENT)) {
    console.warn(
      `[SAFETY WARNING] DATABASE_URL host does not explicitly match dev fragment "${DEV_HOST_FRAGMENT}". ` +
      `Proceeding only because production host was verified absent.`
    );
  } else {
    console.log(`[SAFETY CHECK PASSED] Connected to Development database (${DEV_HOST_FRAGMENT}).`);
  }
}

export interface ProvisioningResult {
  tournament: {
    id: number;
    name: string;
    auctionCode: string;
    sport: string;
    sportId: number | null;
    licenseStatus: string;
    basePurse: number;
    minBid: number;
    bidIncrement: number;
    timerSeconds: number;
    bidTimerSeconds: number;
    status: string;
    auctionEnabled: boolean;
    scoringEnabled: boolean;
  };
  teamsCount: number;
  teams: Array<{
    id: number;
    name: string;
    shortCode: string;
    accessCode: string | null;
    ownerName: string;
    ownerMobile: string;
    purse: number;
  }>;
  playersCount: number;
  playersBreakdown: {
    batsmen: number;
    bowlers: number;
    allRounders: number;
    wicketkeepers: number;
  };
  session: {
    id: number;
    status: string;
    currentPlayerId: number | null;
    revision: number;
    timerSeconds: number | null;
  };
}

export async function provisionSimulationTournament(): Promise<ProvisioningResult> {
  // Step 1: Enforce safety assertions
  assertSafeDatabaseUrl();

  console.log("\n========================================================");
  console.log("   PROVISIONING SIMULATION ENVIRONMENT: SIM_BIDWAR_PREMIER_LEAGUE");
  console.log("========================================================\n");

  const SIM_TOURNAMENT_CODE = "SIMBPL01";
  const SIM_TOURNAMENT_NAME = "SIM_BIDWAR_PREMIER_LEAGUE";

  // Step 2: Idempotent lookup
  const existingTournaments = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.auctionCode, SIM_TOURNAMENT_CODE));

  let tournamentId: number;

  if (existingTournaments.length > 0) {
    tournamentId = existingTournaments[0].id;
    console.log(`Found existing simulation tournament (ID: ${tournamentId}). Cleaning up child records for pristine idempotency...`);

    // Clean up child tables to guarantee 100% clean initial state
    await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tournamentId));
    await db.delete(auctionBidEventsTable).where(eq(auctionBidEventsTable.tournamentId, tournamentId));
    await db.delete(auctionPlayerEventsTable).where(eq(auctionPlayerEventsTable.tournamentId, tournamentId));
    await db.delete(auctionTimerEventsTable).where(eq(auctionTimerEventsTable.tournamentId, tournamentId));
    await db.delete(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, tournamentId));
    await db.delete(playersTable).where(eq(playersTable.tournamentId, tournamentId));
    await db.delete(teamsTable).where(eq(teamsTable.tournamentId, tournamentId));

    // Update tournament settings to exact specification
    const [updated] = await db
      .update(tournamentsTable)
      .set({
        name: SIM_TOURNAMENT_NAME,
        sport: "cricket",
        sportId: 1,
        auctionCode: SIM_TOURNAMENT_CODE,
        venue: "Simulation Arena (Isolated Dev)",
        city: "Varanasi",
        auctionDate: "2026-11-01",
        auctionTime: "10:00",
        organizerId: 1,
        organizerName: "Simulation Organizer",
        organizerMobile: "9999000000",
        organizerEmail: "sim_organizer@bidwar.local",
        logoUrl: "https://res.cloudinary.com/dja0upxxe/image/upload/v1789905899/bidwar/hzypg3q4yzwx2ydgg3ra.webp",
        auctionUnit: "points",
        basePurse: 1000000,
        minBid: 10000,
        bidIncrement: 5000,
        bidTiers: JSON.stringify([{ increment: 5000 }]),
        timerSeconds: 10,
        bidTimerSeconds: 10,
        bidExtensionEnabled: false,
        ownerBiddingEnabled: true,
        playerSelectionMode: "random",
        status: "active",
        licenseStatus: "trial", // Ensures zero SMS, WhatsApp, or email leakage
        minimumSquadSize: 6,
        maximumSquadSize: 0,
        audioEnabled: true,
        masterVolume: 100,
        countdownSoundVolume: 70,
        soldSoundVolume: 80,
        auctionEnabled: true,
        scoringEnabled: true,
      })
      .where(eq(tournamentsTable.id, tournamentId))
      .returning();

    console.log(`Updated tournament ID ${tournamentId} to pristine configuration.`);
  } else {
    // Insert new tournament
    const [created] = await db
      .insert(tournamentsTable)
      .values({
        name: SIM_TOURNAMENT_NAME,
        sport: "cricket",
        sportId: 1,
        auctionCode: SIM_TOURNAMENT_CODE,
        venue: "Simulation Arena (Isolated Dev)",
        city: "Varanasi",
        auctionDate: "2026-11-01",
        auctionTime: "10:00",
        organizerId: 1,
        organizerName: "Simulation Organizer",
        organizerMobile: "9999000000",
        organizerEmail: "sim_organizer@bidwar.local",
        logoUrl: "https://res.cloudinary.com/dja0upxxe/image/upload/v1789905899/bidwar/hzypg3q4yzwx2ydgg3ra.webp",
        auctionUnit: "points",
        basePurse: 1000000,
        minBid: 10000,
        bidIncrement: 5000,
        bidTiers: JSON.stringify([{ increment: 5000 }]),
        timerSeconds: 10,
        bidTimerSeconds: 10,
        bidExtensionEnabled: false,
        ownerBiddingEnabled: true,
        playerSelectionMode: "random",
        status: "active",
        licenseStatus: "trial", // Ensures zero SMS, WhatsApp, or email leakage
        minimumSquadSize: 6,
        maximumSquadSize: 0,
        audioEnabled: true,
        masterVolume: 100,
        countdownSoundVolume: 70,
        soldSoundVolume: 80,
        auctionEnabled: true,
        scoringEnabled: true,
      })
      .returning();

    tournamentId = created.id;
    console.log(`Created new simulation tournament ID ${tournamentId}.`);
  }

  // Step 3: Insert 5 Synthetic Teams
  const targetTeams = [
    {
      tournamentId,
      name: "SIM_TITANS",
      shortCode: "ST101",
      accessCode: "SIMT01",
      ownerName: "Owner Titans",
      ownerMobile: "9999000001",
      purse: 1000000,
      purseUsed: 0,
      color: "#1D4ED8",
      isBiddingEnabled: true,
      lifecycleStatus: "active",
    },
    {
      tournamentId,
      name: "SIM_WARRIORS",
      shortCode: "SW102",
      accessCode: "SIMW02",
      ownerName: "Owner Warriors",
      ownerMobile: "9999000002",
      purse: 1000000,
      purseUsed: 0,
      color: "#DC2626",
      isBiddingEnabled: true,
      lifecycleStatus: "active",
    },
    {
      tournamentId,
      name: "SIM_ROYALS",
      shortCode: "SR103",
      accessCode: "SIMR03",
      ownerName: "Owner Royals",
      ownerMobile: "9999000003",
      purse: 1000000,
      purseUsed: 0,
      color: "#BE185D",
      isBiddingEnabled: true,
      lifecycleStatus: "active",
    },
    {
      tournamentId,
      name: "SIM_KINGS",
      shortCode: "SK104",
      accessCode: "SIMK04",
      ownerName: "Owner Kings",
      ownerMobile: "9999000004",
      purse: 1000000,
      purseUsed: 0,
      color: "#7C3AED",
      isBiddingEnabled: true,
      lifecycleStatus: "active",
    },
    {
      tournamentId,
      name: "SIM_STRIKERS",
      shortCode: "SS105",
      accessCode: "SIMS05",
      ownerName: "Owner Strikers",
      ownerMobile: "9999000005",
      purse: 1000000,
      purseUsed: 0,
      color: "#059669",
      isBiddingEnabled: true,
      lifecycleStatus: "active",
    },
  ];

  const insertedTeams = await db.insert(teamsTable).values(targetTeams).returning();
  console.log(`Inserted ${insertedTeams.length} simulation teams:`);
  for (const team of insertedTeams) {
    console.log(`  - [ID: ${team.id}] ${team.name} (${team.shortCode}) | Owner: ${team.ownerName} | Mobile: ${team.ownerMobile} | AccessCode: ${team.accessCode}`);
  }

  // Step 4: Insert 24 Synthetic Players (6 Batsmen, 6 Bowlers, 6 All-Rounders, 6 Wicketkeepers)
  // Graduated base prices across ₹10,000, ₹15,000, ₹20,000, ₹25,000, ₹50,000
  // Serials 1–24, status 'available', blank mobile numbers
  const avatar = (name: string, bg: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.replace("#", "")}&color=fff&size=200&bold=true`;

  const targetPlayers = [
    // 6 Batsmen (Serials 1 - 6)
    {
      tournamentId,
      serialNo: 1,
      name: "Aarav Sharma (Sim)",
      role: "Batsman",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm medium",
      basePrice: 10000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Aarav Sharma", "1D4ED8"),
    },
    {
      tournamentId,
      serialNo: 2,
      name: "Rohit Verma (Sim)",
      role: "Batsman",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm off break",
      basePrice: 15000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Rohit Verma", "1D4ED8"),
    },
    {
      tournamentId,
      serialNo: 3,
      name: "Shikhar Dhawan (Sim)",
      role: "Batsman",
      battingStyle: "Left-hand bat",
      bowlingStyle: "None",
      basePrice: 20000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Shikhar Dhawan", "1D4ED8"),
    },
    {
      tournamentId,
      serialNo: 4,
      name: "Virat Kohli (Sim)",
      role: "Batsman",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm medium",
      basePrice: 25000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Virat Kohli", "1D4ED8"),
    },
    {
      tournamentId,
      serialNo: 5,
      name: "Suryakumar Yadav (Sim)",
      role: "Batsman",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm off break",
      basePrice: 50000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Suryakumar Yadav", "1D4ED8"),
    },
    {
      tournamentId,
      serialNo: 6,
      name: "Shubman Gill (Sim)",
      role: "Batsman",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm off break",
      basePrice: 25000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Shubman Gill", "1D4ED8"),
    },

    // 6 Bowlers (Serials 7 - 12)
    {
      tournamentId,
      serialNo: 7,
      name: "Jasprit Bumrah (Sim)",
      role: "Bowler",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm fast",
      basePrice: 50000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Jasprit Bumrah", "DC2626"),
    },
    {
      tournamentId,
      serialNo: 8,
      name: "Mohammed Shami (Sim)",
      role: "Bowler",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm fast-medium",
      basePrice: 25000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Mohammed Shami", "DC2626"),
    },
    {
      tournamentId,
      serialNo: 9,
      name: "Kuldeep Yadav (Sim)",
      role: "Bowler",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Slow left-arm chinaman",
      basePrice: 20000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Kuldeep Yadav", "DC2626"),
    },
    {
      tournamentId,
      serialNo: 10,
      name: "Yuzvendra Chahal (Sim)",
      role: "Bowler",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm leg break",
      basePrice: 15000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Yuzvendra Chahal", "DC2626"),
    },
    {
      tournamentId,
      serialNo: 11,
      name: "Arshdeep Singh (Sim)",
      role: "Bowler",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Left-arm medium-fast",
      basePrice: 10000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Arshdeep Singh", "DC2626"),
    },
    {
      tournamentId,
      serialNo: 12,
      name: "Mohammed Siraj (Sim)",
      role: "Bowler",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm fast",
      basePrice: 20000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Mohammed Siraj", "DC2626"),
    },

    // 6 All-Rounders (Serials 13 - 18)
    {
      tournamentId,
      serialNo: 13,
      name: "Hardik Pandya (Sim)",
      role: "All-Rounder",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm fast-medium",
      basePrice: 50000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Hardik Pandya", "7C3AED"),
    },
    {
      tournamentId,
      serialNo: 14,
      name: "Ravindra Jadeja (Sim)",
      role: "All-Rounder",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Slow left-arm orthodox",
      basePrice: 25000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Ravindra Jadeja", "7C3AED"),
    },
    {
      tournamentId,
      serialNo: 15,
      name: "Axar Patel (Sim)",
      role: "All-Rounder",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Slow left-arm orthodox",
      basePrice: 20000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Axar Patel", "7C3AED"),
    },
    {
      tournamentId,
      serialNo: 16,
      name: "Washington Sundar (Sim)",
      role: "All-Rounder",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Right-arm off break",
      basePrice: 15000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Washington Sundar", "7C3AED"),
    },
    {
      tournamentId,
      serialNo: 17,
      name: "Shivam Dube (Sim)",
      role: "All-Rounder",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Right-arm medium",
      basePrice: 15000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Shivam Dube", "7C3AED"),
    },
    {
      tournamentId,
      serialNo: 18,
      name: "Nitish Kumar Reddy (Sim)",
      role: "All-Rounder",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm medium-fast",
      basePrice: 10000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Nitish Reddy", "7C3AED"),
    },

    // 6 Wicketkeepers (Serials 19 - 24)
    {
      tournamentId,
      serialNo: 19,
      name: "Rishabh Pant (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Left-hand bat",
      bowlingStyle: "None",
      basePrice: 50000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Rishabh Pant", "059669"),
    },
    {
      tournamentId,
      serialNo: 20,
      name: "KL Rahul (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Right-hand bat",
      bowlingStyle: "None",
      basePrice: 25000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("KL Rahul", "059669"),
    },
    {
      tournamentId,
      serialNo: 21,
      name: "Sanju Samson (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Right-hand bat",
      bowlingStyle: "None",
      basePrice: 20000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Sanju Samson", "059669"),
    },
    {
      tournamentId,
      serialNo: 22,
      name: "Ishan Kishan (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Left-hand bat",
      bowlingStyle: "None",
      basePrice: 15000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Ishan Kishan", "059669"),
    },
    {
      tournamentId,
      serialNo: 23,
      name: "Jitesh Sharma (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Right-hand bat",
      bowlingStyle: "None",
      basePrice: 10000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Jitesh Sharma", "059669"),
    },
    {
      tournamentId,
      serialNo: 24,
      name: "Dhruv Jurel (Sim)",
      role: "Wicketkeeper",
      battingStyle: "Right-hand bat",
      bowlingStyle: "None",
      basePrice: 10000,
      status: "available",
      mobileNumber: "",
      photoUrl: avatar("Dhruv Jurel", "059669"),
    },
  ];

  const insertedPlayers = await db.insert(playersTable).values(targetPlayers).returning();
  console.log(`Inserted ${insertedPlayers.length} simulation players across 4 roles:`);
  console.log(`  - Batsmen: 6 (Serials 1–6)`);
  console.log(`  - Bowlers: 6 (Serials 7–12)`);
  console.log(`  - All-Rounders: 6 (Serials 13–18)`);
  console.log(`  - Wicketkeepers: 6 (Serials 19–24)`);

  // Step 5: Initialize Auction Session
  const [session] = await db
    .insert(auctionSessionsTable)
    .values({
      tournamentId,
      status: "active",
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerSeconds: 10,
      revision: 0,
      soldPlayersCount: 0,
      unsoldPlayersCount: 0,
    })
    .returning();

  console.log(`Initialized auction session (ID: ${session.id}) with status: "${session.status}", revision: ${session.revision}.`);

  const [tRow] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const result: ProvisioningResult = {
    tournament: {
      id: tRow.id,
      name: tRow.name,
      auctionCode: tRow.auctionCode!,
      sport: tRow.sport,
      sportId: tRow.sportId,
      licenseStatus: tRow.licenseStatus,
      basePurse: tRow.basePurse,
      minBid: tRow.minBid,
      bidIncrement: tRow.bidIncrement,
      timerSeconds: tRow.timerSeconds,
      bidTimerSeconds: tRow.bidTimerSeconds,
      status: tRow.status,
      auctionEnabled: tRow.auctionEnabled,
      scoringEnabled: tRow.scoringEnabled,
    },
    teamsCount: insertedTeams.length,
    teams: insertedTeams.map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      accessCode: t.accessCode,
      ownerName: t.ownerName,
      ownerMobile: t.ownerMobile,
      purse: t.purse,
    })),
    playersCount: insertedPlayers.length,
    playersBreakdown: {
      batsmen: insertedPlayers.filter((p) => p.role === "Batsman").length,
      bowlers: insertedPlayers.filter((p) => p.role === "Bowler").length,
      allRounders: insertedPlayers.filter((p) => p.role === "All-Rounder").length,
      wicketkeepers: insertedPlayers.filter((p) => p.role === "Wicketkeeper").length,
    },
    session: {
      id: session.id,
      status: session.status,
      currentPlayerId: session.currentPlayerId,
      revision: session.revision,
      timerSeconds: session.timerSeconds,
    },
  };

  console.log("\n========================================================");
  console.log(`   PROVISIONING COMPLETED SUCCESSFULLY! TOURNAMENT ID: ${tRow.id}`);
  console.log("========================================================\n");

  return result;
}

// Direct execution entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  provisionSimulationTournament()
    .then((res) => {
      console.log("Summary:", JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[FATAL ERROR during provisioning]:", err);
      process.exit(1);
    });
}
