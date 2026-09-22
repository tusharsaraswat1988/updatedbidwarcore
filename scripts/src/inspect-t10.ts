import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  teamsTable,
  playersTable,
  scoringMatchesTable,
  scoringFixturesTable,
  scoringDrawsTable,
  scoringGroupsTable,
  scoringGroupMembersTable,
} from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function main() {
  const tournaments = await db.select().from(tournamentsTable);
  console.log("ALL TOURNAMENTS:", tournaments.map((t) => ({ id: t.id, name: t.name, sport: t.sport, status: t.status })));

  const t10 = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, 10));
  console.log("TOURNAMENT 10:", t10);

  if (t10.length > 0) {
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, 10));
    console.log("TEAMS count:", teams.length, teams.map(t => ({ id: t.id, name: t.name, code: t.shortCode })));

    const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, 10));
    console.log("PLAYERS count:", players.length);

    const matches = await db.select().from(scoringMatchesTable).where(eq(scoringMatchesTable.tournamentId, 10));
    console.log("MATCHES count:", matches.length, matches.map(m => ({ id: m.id, label: m.matchLabel, status: m.status, home: m.homeTeamId, away: m.awayTeamId })));

    const groups = await db.select().from(scoringGroupsTable).where(eq(scoringGroupsTable.tournamentId, 10));
    console.log("GROUPS:", groups);

    const groupMembers = await db.select().from(scoringGroupMembersTable);
    console.log("GROUP MEMBERS:", groupMembers);
  }
}

main().catch(console.error).finally(() => process.exit(0));
