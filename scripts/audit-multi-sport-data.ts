#!/usr/bin/env npx tsx
/**
 * Multi-sport data integrity audit (read-only).
 *
 * Usage:
 *   npx tsx scripts/audit-multi-sport-data.ts [--json] [--write-reports]
 *
 * Writes JSON to stdout; with --write-reports updates docs/*_DATA_REPAIR_REPORT.md summaries.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";

type AuditFinding = {
  category: string;
  severity: "P0" | "P1" | "P2";
  count: number;
  sample: Record<string, unknown>[];
  description: string;
};

export type MultiSportAuditResult = {
  auditedAt: string;
  statistics: AuditFinding[];
  teamAssignments: AuditFinding[];
  sportProfiles: AuditFinding[];
  totals: {
    statisticsIssues: number;
    teamAssignmentIssues: number;
    sportProfileIssues: number;
  };
};

async function auditStatistics(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const wrongSport = await db.execute(sql`
    SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id, lower(t.sport) AS expected_sport, t.name AS tournament_name
    FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE ps.tournament_id IS NOT NULL
      AND lower(ps.sport) <> lower(t.sport)
    ORDER BY ps.id
    LIMIT 500
  `);
  findings.push({
    category: "wrong_sport_tag",
    severity: "P0",
    count: wrongSport.rows.length,
    sample: wrongSport.rows.slice(0, 10) as Record<string, unknown>[],
    description: "player_statistics.sport does not match tournaments.sport",
  });

  const badmintonTaggedCricket = await db.execute(sql`
    SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id, t.name AS tournament_name
    FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE lower(t.sport) = 'badminton' AND lower(ps.sport) = 'cricket'
    LIMIT 500
  `);
  findings.push({
    category: "badminton_tournament_cricket_sport",
    severity: "P0",
    count: badmintonTaggedCricket.rows.length,
    sample: badmintonTaggedCricket.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Badminton tournaments with statistics rows tagged sport=cricket",
  });

  const duplicates = await db.execute(sql`
    SELECT player_id, sport, tournament_id, COUNT(*)::int AS cnt
    FROM player_statistics
    GROUP BY player_id, sport, tournament_id
    HAVING COUNT(*) > 1
    LIMIT 200
  `);
  findings.push({
    category: "duplicate_rows",
    severity: "P1",
    count: duplicates.rows.length,
    sample: duplicates.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Duplicate (player_id, sport, tournament_id) groups",
  });

  const orphans = await db.execute(sql`
    SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id
    FROM player_statistics ps
    LEFT JOIN global_players gp ON gp.id = ps.player_id
    WHERE gp.id IS NULL
    LIMIT 500
  `);
  findings.push({
    category: "orphan_player_id",
    severity: "P1",
    count: orphans.rows.length,
    sample: orphans.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Statistics rows whose player_id is not a global_players.id",
  });

  const preSpecEra = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM players p
    WHERE NOT EXISTS (SELECT 1 FROM player_spec_values psv WHERE psv.player_id = p.id)
      AND (p.batting_style IS NOT NULL OR p.bowling_style IS NOT NULL OR p.specialization IS NOT NULL)
  `);
  const preSpecCount = Number((preSpecEra.rows[0] as Record<string, unknown>)?.cnt ?? 0);
  findings.push({
    category: "players_missing_spec_values",
    severity: "P2",
    count: preSpecCount,
    sample: [],
    description: "Players with legacy spec columns but no player_spec_values rows",
  });

  return findings;
}

async function auditTeamAssignments(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const wrongSport = await db.execute(sql`
    SELECT pta.id, pta.player_id, pta.sport, pta.tournament_id, lower(t.sport) AS expected_sport
    FROM player_team_assignments pta
    INNER JOIN tournaments t ON t.id = pta.tournament_id
    WHERE pta.tournament_id IS NOT NULL
      AND lower(pta.sport) <> lower(t.sport)
    LIMIT 500
  `);
  findings.push({
    category: "wrong_sport_tag",
    severity: "P0",
    count: wrongSport.rows.length,
    sample: wrongSport.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Assignment sport does not match tournament sport",
  });

  const multiActive = await db.execute(sql`
    SELECT player_id, tournament_id, sport, COUNT(*)::int AS active_count
    FROM player_team_assignments
    WHERE is_active = true AND tournament_id IS NOT NULL
    GROUP BY player_id, tournament_id, sport
    HAVING COUNT(*) > 1
    LIMIT 200
  `);
  findings.push({
    category: "multiple_active_same_sport",
    severity: "P1",
    count: multiActive.rows.length,
    sample: multiActive.rows.slice(0, 10) as Record<string, unknown>[],
    description: "More than one active assignment per (player, tournament, sport)",
  });

  const crossSportActive = await db.execute(sql`
    SELECT pta.player_id, pta.tournament_id, array_agg(DISTINCT pta.sport) AS sports, COUNT(*)::int AS active_count
    FROM player_team_assignments pta
    WHERE pta.is_active = true AND pta.tournament_id IS NOT NULL
    GROUP BY pta.player_id, pta.tournament_id
    HAVING COUNT(DISTINCT pta.sport) > 1
    LIMIT 200
  `);
  findings.push({
    category: "multi_sport_active_same_tournament",
    severity: "P2",
    count: crossSportActive.rows.length,
    sample: crossSportActive.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Active assignments for multiple sports in same tournament (may be valid for multi-sport events)",
  });

  const orphans = await db.execute(sql`
    SELECT pta.id, pta.player_id, pta.tournament_id, pta.sport
    FROM player_team_assignments pta
    LEFT JOIN global_players gp ON gp.id = pta.player_id
    WHERE gp.id IS NULL
    LIMIT 500
  `);
  findings.push({
    category: "orphan_player_id",
    severity: "P1",
    count: orphans.rows.length,
    sample: orphans.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Assignments referencing unknown global player ids",
  });

  return findings;
}

async function auditSportProfiles(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const missing = await db.execute(sql`
    SELECT DISTINCT p.global_player_id, lower(t.sport) AS sport_slug
    FROM players p
    INNER JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.global_player_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM player_sport_profiles psp
        WHERE psp.global_player_id = p.global_player_id
          AND lower(psp.sport_slug) = lower(t.sport)
      )
    LIMIT 500
  `);
  findings.push({
    category: "missing_profile",
    severity: "P0",
    count: missing.rows.length,
    sample: missing.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Global players with tournament appearances but no player_sport_profiles row",
  });

  const duplicates = await db.execute(sql`
    SELECT global_player_id, sport_slug, COUNT(*)::int AS cnt
    FROM player_sport_profiles
    GROUP BY global_player_id, sport_slug
    HAVING COUNT(*) > 1
    LIMIT 100
  `);
  findings.push({
    category: "duplicate_profiles",
    severity: "P1",
    count: duplicates.rows.length,
    sample: duplicates.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Duplicate (global_player_id, sport_slug) — should be impossible with unique index",
  });

  const noTournamentLink = await db.execute(sql`
    SELECT psp.id, psp.global_player_id, psp.sport_slug
    FROM player_sport_profiles psp
    WHERE NOT EXISTS (
      SELECT 1 FROM players p
      INNER JOIN tournaments t ON t.id = p.tournament_id
      WHERE p.global_player_id = psp.global_player_id
        AND lower(t.sport) = lower(psp.sport_slug)
    )
    LIMIT 200
  `);
  findings.push({
    category: "orphan_profiles",
    severity: "P2",
    count: noTournamentLink.rows.length,
    sample: noTournamentLink.rows.slice(0, 10) as Record<string, unknown>[],
    description: "Sport profiles with no matching tournament player row",
  });

  return findings;
}

function sumCounts(findings: AuditFinding[]): number {
  return findings.reduce((n, f) => n + f.count, 0);
}

function renderReport(title: string, findings: AuditFinding[], repairScript: string): string {
  const lines = [
    `# ${title}`,
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "Run live audit:",
    "",
    "```bash",
    "npx tsx scripts/audit-multi-sport-data.ts --json",
    "```",
    "",
    "Apply repairs:",
    "",
    "```bash",
    `npx tsx scripts/${repairScript} --dry-run`,
    `npx tsx scripts/${repairScript} --apply`,
    "```",
    "",
    "## Findings",
    "",
  ];

  for (const f of findings) {
    lines.push(`### ${f.category} (${f.severity})`);
    lines.push("");
    lines.push(f.description);
    lines.push("");
    lines.push(`- **Count:** ${f.count}`);
    if (f.sample.length > 0) {
      lines.push("- **Sample:**");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(f.sample, null, 2));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function runMultiSportAudit(): Promise<MultiSportAuditResult> {
  const statistics = await auditStatistics();
  const teamAssignments = await auditTeamAssignments();
  const sportProfiles = await auditSportProfiles();

  return {
    auditedAt: new Date().toISOString(),
    statistics,
    teamAssignments,
    sportProfiles,
    totals: {
      statisticsIssues: sumCounts(statistics.filter((f) => f.severity !== "P2" || f.category !== "players_missing_spec_values")),
      teamAssignmentIssues: sumCounts(teamAssignments),
      sportProfileIssues: sumCounts(sportProfiles),
    },
  };
}

async function main() {
  const writeReports = process.argv.includes("--write-reports");
  const json = process.argv.includes("--json");

  console.log("Multi-sport data audit (read-only)…\n");
  const result = await runMultiSportAudit();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(JSON.stringify(result.totals, null, 2));
    for (const domain of ["statistics", "teamAssignments", "sportProfiles"] as const) {
      console.log(`\n## ${domain}`);
      for (const f of result[domain]) {
        console.log(`  ${f.category}: ${f.count} (${f.severity})`);
      }
    }
  }

  if (writeReports) {
    const docs = join(process.cwd(), "docs");
    writeFileSync(join(docs, "STATISTICS_DATA_REPAIR_REPORT.md"), renderReport("Statistics Data Repair Report", result.statistics, "repair-player-statistics.ts"));
    writeFileSync(join(docs, "TEAM_ASSIGNMENT_DATA_REPAIR_REPORT.md"), renderReport("Team Assignment Data Repair Report", result.teamAssignments, "repair-team-assignments.ts"));
    writeFileSync(join(docs, "SPORT_PROFILE_DATA_REPAIR_REPORT.md"), renderReport("Sport Profile Data Repair Report", result.sportProfiles, "repair-player-sport-profiles.ts"));
    console.log("\nWrote docs/*_DATA_REPAIR_REPORT.md");
  }

  const hasP0 =
    result.statistics.some((f) => f.severity === "P0" && f.count > 0) ||
    result.teamAssignments.some((f) => f.severity === "P0" && f.count > 0) ||
    result.sportProfiles.some((f) => f.severity === "P0" && f.count > 0);

  process.exit(hasP0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
