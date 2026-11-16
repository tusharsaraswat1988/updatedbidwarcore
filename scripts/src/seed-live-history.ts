import { loadRootEnv } from "../load-root-env.mjs";
loadRootEnv();
import { db, playersTable, tournamentsTable, teamsTable, auctionSessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Seeding test player auction history for browser verification...");

  // 1. Ensure Tournament 999 (Historical Tournament: Alumni Premier League 2026) exists
  const [existingT999] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, 999)).limit(1);
  if (!existingT999) {
    await db.insert(tournamentsTable).values({
      id: 999,
      name: "Alumni Premier League 2026",
      sport: "cricket",
      status: "completed",
      auctionDate: "2026-01-15",
      createdAt: new Date("2026-01-01"),
    } as any);
    console.log("Created historical tournament 999 (Alumni Premier League 2026)");
  }

  // Ensure Team "The Dominators by 2005" exists in Tournament 999
  const [existingTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, 9991)).limit(1);
  if (!existingTeam) {
    await db.insert(teamsTable).values({
      id: 9991,
      tournamentId: 999,
      name: "The Dominators by 2005",
      ownerName: "Dominators Franchise",
      shortCode: "DOM",
      color: "#F59E0B",
    } as any);
    console.log("Created historical team The Dominators by 2005");
  }

  // 2. Set mobileNumber for player 518 in tournament 18
  const testMobile = "9876543210";
  await db
    .update(playersTable)
    .set({
      mobileNumber: testMobile,
      city: "Varanasi",
      role: "All-Rounder",
      basePrice: 10000,
    })
    .where(eq(playersTable.id, 518));
  console.log("Updated Player 518 (Sanju Samson) with mobile " + testMobile);

  // 3. Create historical sold player row in Tournament 999 with sold_price 125000 and top 5 ranking
  // Delete any existing row first
  await db.delete(playersTable).where(sql`${playersTable.tournamentId} = 999 AND ${playersTable.mobileNumber} = ${testMobile}`);
  await db.insert(playersTable).values({
    id: 99901,
    tournamentId: 999,
    serialNo: 1,
    name: "Sanju Samson (Sim)",
    mobileNumber: testMobile,
    role: "All-Rounder",
    status: "sold",
    soldPrice: 125000,
    teamId: 9991,
    createdAt: new Date("2026-01-15"),
  } as any);
  console.log("Created historical sold record for Sanju Samson (₹1.25 LAKH, The Dominators by 2005)");

  // Add dummy players in T999 so Sanju is ranked Top 5
  // rank 1: 500k, rank 2: 400k, rank 3: 300k, rank 4: 200k, rank 5: 125k (Sanju)
  const dummyP = [
    { id: 99902, name: "Top Star 1", soldPrice: 500000, serialNo: 2 },
    { id: 99903, name: "Top Star 2", soldPrice: 400000, serialNo: 3 },
    { id: 99904, name: "Top Star 3", soldPrice: 300000, serialNo: 4 },
    { id: 99905, name: "Top Star 4", soldPrice: 200000, serialNo: 5 },
  ];
  for (const d of dummyP) {
    const [exists] = await db.select().from(playersTable).where(eq(playersTable.id, d.id)).limit(1);
    if (!exists) {
      await db.insert(playersTable).values({
        id: d.id,
        tournamentId: 999,
        serialNo: d.serialNo,
        name: d.name,
        status: "sold",
        soldPrice: d.soldPrice,
        createdAt: new Date("2026-01-15"),
      } as any);
    }
  }

  // 4. Also set active current player in Tournament 18 to Player 518
  const [t18] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, 18)).limit(1);
  if (t18) {
    // Enable features in featuresJson and set organizer password
    await db.execute(sql`
      UPDATE tournaments
      SET features_json = jsonb_set(
        jsonb_set(
          COALESCE(features_json, '{}'::jsonb),
          '{liveAuctionHistory}',
          'true'::jsonb
        ),
        '{ownerApp}',
        'true'::jsonb
      ),
      organizer_password = 'Detailing@2026'
      WHERE id = 18
    `);
    console.log("Enabled liveAuctionHistory & ownerApp, set organizer_password on Tournament 18");

    // Clear accessCode for team 87 to bypass gate if present
    await db.update(teamsTable).set({ accessCode: null }).where(eq(teamsTable.id, 87));
    console.log("Cleared accessCode on Team 87");

    // Check teams in tournament 18
    const t18Teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, 18)).limit(5);
    console.log("Tournament 18 Teams:", t18Teams.map(t => ({ id: t.id, name: t.name })));
    const leadingTeamId = t18Teams[0]?.id ?? null;

    // Set auction session for tournament 18
    const [existingSession] = await db.select().from(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, 18)).limit(1);
    if (existingSession) {
      await db.update(auctionSessionsTable).set({
        status: "active",
        currentPlayerId: 518,
        currentBid: 125000,
        currentBidTeamId: leadingTeamId,
        timerSeconds: 30,
        revision: (existingSession.revision || 0) + 1,
      }).where(eq(auctionSessionsTable.tournamentId, 18));
      console.log("Updated auction session for T18 with currentPlayerId 518 and currentBid 125000");
    } else {
      await db.insert(auctionSessionsTable).values({
        tournamentId: 18,
        status: "active",
        currentPlayerId: 518,
        currentBid: 125000,
        currentBidTeamId: leadingTeamId,
        timerSeconds: 30,
        revision: 1,
      } as any);
      console.log("Created auction session for T18 with currentPlayerId 518");
    }
  }

  console.log("Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
