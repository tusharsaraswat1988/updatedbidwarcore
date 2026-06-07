/**
 * Prepares a cricket tournament for local scoring demo:
 * - Sets organizer password
 * - Ensures two teams have 11 sold players each (for playing XI picker)
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { db, playersTable, teamsTable, tournamentsTable } from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const ORGANIZER_PASSWORD = process.env.LOCAL_ORGANIZER_PASSWORD?.trim() || "demo123";

async function main() {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.sport, "cricket"))
    .orderBy(tournamentsTable.id)
    .limit(1);

  if (!tournament) {
    console.error("No cricket tournament found. Run: pnpm --filter @workspace/scripts run seed:demo");
    process.exit(1);
  }

  await db
    .update(tournamentsTable)
    .set({
      organizerPassword: ORGANIZER_PASSWORD,
      scoringEnabled: true,
      scoringPhase: "active",
    })
    .where(eq(tournamentsTable.id, tournament.id));

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournament.id))
    .orderBy(teamsTable.id)
    .limit(2);

  if (teams.length < 2) {
    console.error("Need at least 2 teams in tournament");
    process.exit(1);
  }

  const [teamA, teamB] = teams;

  for (const [idx, team] of [teamA, teamB].entries()) {
    const existing = await db
      .select()
      .from(playersTable)
      .where(
        and(
          eq(playersTable.tournamentId, tournament.id),
          eq(playersTable.teamId, team.id),
          eq(playersTable.status, "sold"),
        ),
      );

    const need = 11 - existing.length;
    if (need <= 0) {
      console.log(`  ${team.shortCode}: already has ${existing.length} sold players`);
      continue;
    }

    const available = await db
      .select()
      .from(playersTable)
      .where(
        and(
          eq(playersTable.tournamentId, tournament.id),
          eq(playersTable.status, "available"),
        ),
      )
      .limit(need);

    for (const p of available) {
      await db
        .update(playersTable)
        .set({ status: "sold", teamId: team.id, soldPrice: p.basePrice })
        .where(eq(playersTable.id, p.id));
    }

    const created = need - available.length;
    for (let i = 0; i < created; i++) {
      const n = idx * 20 + existing.length + available.length + i + 1;
      await db.insert(playersTable).values({
        tournamentId: tournament.id,
        teamId: team.id,
        name: `${team.shortCode} Player ${n}`,
        role: "All-rounder",
        basePrice: 200000,
        soldPrice: 200000,
        status: "sold",
      });
    }

    console.log(`  ${team.shortCode}: squad ready (${11} sold players)`);
  }

  console.log("\n=== Scoring local demo ready ===");
  console.log(`Tournament: ${tournament.name} (id=${tournament.id})`);
  console.log(`Teams: ${teamA.shortCode} vs ${teamB.shortCode}`);
  console.log(`Organizer password: ${ORGANIZER_PASSWORD}`);
  console.log(`Scorer URL: http://localhost:3000/tournament/${tournament.id}/score`);
  console.log(`Admin login:  http://localhost:3000/admin/login  (password: ${process.env.ADMIN_PASSWORD ?? "see .env"})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
