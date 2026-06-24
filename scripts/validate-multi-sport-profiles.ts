#!/usr/bin/env npx tsx
/**
 * Validate multi-sport profile isolation for a global player.
 *
 * Usage:
 *   PLAYER_SPORT_PROFILES_ENABLED=true npx tsx scripts/validate-multi-sport-profiles.ts <globalPlayerId>
 *
 * Or pass mobile to resolve global player:
 *   npx tsx scripts/validate-multi-sport-profiles.ts --mobile 9876543210
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { globalPlayersTable } from "../lib/db/src/schema/global_players";
import { playerSportProfileService } from "../artifacts/api-server/src/lib/master-sports/player-sport-profile-service";

async function main() {
  const mobileArg = process.argv.find((a, i) => argvHasMobile(i));
  const gpArg = process.argv.find((a) => a.startsWith("gp_"));

  let globalPlayerId = gpArg ?? null;

  if (mobileArg) {
    const mobile = process.argv[process.argv.indexOf("--mobile") + 1];
    const [gp] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, mobile))
      .limit(1);
    if (!gp) {
      console.error("No global player for mobile:", mobile);
      process.exit(1);
    }
    globalPlayerId = gp.id;
  }

  if (!globalPlayerId) {
    console.error("Usage: validate-multi-sport-profiles.ts <globalPlayerId> | --mobile <number>");
    process.exit(1);
  }

  const [gp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, globalPlayerId))
    .limit(1);

  if (!gp) {
    console.error("Global player not found:", globalPlayerId);
    process.exit(1);
  }

  const tournamentRows = await db.execute(sql`
    SELECT
      lower(t.sport) AS sport,
      p.role,
      p.name,
      t.name AS tournament_name,
      p.updated_at
    FROM players p
    INNER JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.global_player_id = ${globalPlayerId}
    ORDER BY lower(t.sport), p.updated_at DESC
  `);

  const profiles = await playerSportProfileService.getSportProfiles(globalPlayerId);

  const bySport = new Map<string, { role: string | null; tournaments: string[] }>();
  for (const row of tournamentRows.rows as Array<Record<string, unknown>>) {
    const sport = String(row.sport);
    const entry = bySport.get(sport) ?? { role: row.role ? String(row.role) : null, tournaments: [] };
    entry.tournaments.push(String(row.tournament_name));
    if (!bySport.has(sport)) bySport.set(sport, entry);
  }

  console.log("=== Global Player (identity) ===");
  console.log(
    JSON.stringify(
      {
        id: gp.id,
        canonicalName: gp.canonicalName,
        mobileNumber: gp.mobileNumber,
        city: gp.city,
        age: gp.age,
        gender: gp.gender,
        photoUrl: gp.photoUrl,
        legacySport: gp.sport,
        legacyDefaultRole: gp.defaultRole,
        legacyAuctionPlayerId: gp.auctionPlayerId,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Tournament appearances by sport ===");
  console.log(JSON.stringify(Object.fromEntries(bySport), null, 2));

  console.log("\n=== player_sport_profiles ===");
  console.log(JSON.stringify(profiles, null, 2));

  const profileSports = new Set(profiles.map((p) => p.sport));
  const tournamentSports = new Set(bySport.keys());

  const missingProfiles = [...tournamentSports].filter((s) => !profileSports.has(s));
  const ok = missingProfiles.length === 0 && profiles.length >= tournamentSports.size;

  console.log("\n=== Validation ===");
  console.log(
    JSON.stringify(
      {
        ok,
        profileCount: profiles.length,
        sportCount: tournamentSports.size,
        missingProfiles,
        multiSport: profiles.length > 1,
        noSingleSportOverwrite: profiles.length === tournamentSports.size || profiles.length > 1,
      },
      null,
      2,
    ),
  );

  process.exit(ok ? 0 : 1);
}

function argvHasMobile(index: number): boolean {
  return process.argv[index] === "--mobile";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
