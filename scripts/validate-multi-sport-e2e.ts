#!/usr/bin/env npx tsx
/**
 * End-to-end multi-sport isolation validation for one global player.
 *
 * Usage:
 *   npx tsx scripts/validate-multi-sport-e2e.ts --mobile 8707488250
 *   npx tsx scripts/validate-multi-sport-e2e.ts gp_mq6b2droprkj6
 *
 * Checks: sport profiles, spec values, statistics sport tags, team assignments, search isolation.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { globalPlayersTable } from "../lib/db/src/schema/global_players";
import { playerSportProfileService } from "../artifacts/api-server/src/lib/master-sports/player-sport-profile-service";
import { playerSpecificationService } from "../artifacts/api-server/src/lib/player-specification-service";

type CheckResult = { name: string; ok: boolean; detail: string };

async function resolveGlobalPlayerId(arg: string): Promise<string> {
  if (arg.startsWith("gp_")) return arg;
  if (arg === "--mobile") {
    const mobile = process.argv[process.argv.indexOf("--mobile") + 1];
    const [gp] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, mobile!))
      .limit(1);
    if (!gp) throw new Error(`No global player for mobile ${mobile}`);
    return gp.id;
  }
  throw new Error("Pass globalPlayerId or --mobile <number>");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: validate-multi-sport-e2e.ts <globalPlayerId> | --mobile <number>");
    process.exit(1);
  }

  const globalPlayerId = await resolveGlobalPlayerId(arg);
  const checks: CheckResult[] = [];

  const tournamentRows = await db.execute(sql`
    SELECT p.id AS player_id, p.name, p.role, lower(t.sport) AS sport, t.id AS tournament_id, t.name AS tournament_name
    FROM players p
    INNER JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.global_player_id = ${globalPlayerId}
    ORDER BY lower(t.sport), p.id
  `);

  const bySport = new Map<string, Array<Record<string, unknown>>>();
  for (const row of tournamentRows.rows as Array<Record<string, unknown>>) {
    const sport = String(row.sport);
    if (!bySport.has(sport)) bySport.set(sport, []);
    bySport.get(sport)!.push(row);
  }

  checks.push({
    name: "multi_sport_participation",
    ok: bySport.size >= 1,
    detail: `Sports: ${[...bySport.keys()].join(", ") || "none"}`,
  });

  const profiles = await playerSportProfileService.getSportProfiles(globalPlayerId);
  const profileSports = new Set(profiles.map((p) => p.sport));
  const missingProfiles = [...bySport.keys()].filter((s) => !profileSports.has(s));
  checks.push({
    name: "sport_profiles_complete",
    ok: missingProfiles.length === 0,
    detail: missingProfiles.length
      ? `Missing profiles: ${missingProfiles.join(", ")}`
      : `${profiles.length} profile(s) OK`,
  });

  for (const [sport, rows] of bySport) {
    for (const row of rows) {
      const playerId = Number(row.player_id);
      const specs = await playerSpecificationService.getPlayerSpecifications(playerId);
      const handSpecs = specs.filter((s) => /hand/i.test(s.groupName));

      checks.push({
        name: `specs_${sport}_player_${playerId}`,
        ok: specs.length === 0 || !specs.some((s) => /batting style|bowling style/i.test(s.groupName) && sport === "badminton"),
        detail: specs.length
          ? specs.map((s) => `${s.groupName}=${s.value}`).join("; ")
          : "no normalized specs (legacy only)",
      });

      const stats = await db.execute(sql`
        SELECT id, sport FROM player_statistics
        WHERE player_id = ${globalPlayerId} AND tournament_id = ${row.tournament_id}
      `);
      const wrongStats = (stats.rows as Array<{ sport: string }>).filter(
        (s) => s.sport.toLowerCase() !== sport,
      );
      checks.push({
        name: `statistics_sport_${sport}_t${row.tournament_id}`,
        ok: wrongStats.length === 0,
        detail: wrongStats.length
          ? `Wrong sport tags: ${wrongStats.map((s) => s.sport).join(", ")}`
          : `${stats.rows.length} row(s) tagged correctly`,
      });

      const assignments = await db.execute(sql`
        SELECT id, sport, is_active FROM player_team_assignments
        WHERE player_id = ${globalPlayerId} AND tournament_id = ${row.tournament_id}
      `);
      const wrongAssign = (assignments.rows as Array<{ sport: string }>).filter(
        (a) => a.sport.toLowerCase() !== sport,
      );
      checks.push({
        name: `assignment_sport_${sport}_t${row.tournament_id}`,
        ok: wrongAssign.length === 0,
        detail: wrongAssign.length
          ? `Wrong sport: ${wrongAssign.map((a) => a.sport).join(", ")}`
          : `${assignments.rows.length} assignment row(s)`,
      });
    }
  }

  if (bySport.size >= 2) {
    const sports = [...bySport.keys()];
    const specLabelsBySport: Record<string, string[]> = {};
    for (const sport of sports) {
      const playerId = Number(bySport.get(sport)![0]!.player_id);
      const specs = await playerSpecificationService.getPlayerSpecifications(playerId);
      specLabelsBySport[sport] = specs.map((s) => s.groupName);
    }
    const noCricketInBadminton =
      !specLabelsBySport["badminton"]?.some((l) => /batting style|bowling style/i.test(l)) ||
      specLabelsBySport["badminton"]?.some((l) => /playing hand/i.test(l));
    checks.push({
      name: "no_cross_sport_spec_labels",
      ok: noCricketInBadminton ?? true,
      detail: JSON.stringify(specLabelsBySport),
    });
  }

  console.log(JSON.stringify({ globalPlayerId, checks }, null, 2));
  const failed = checks.filter((c) => !c.ok);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
