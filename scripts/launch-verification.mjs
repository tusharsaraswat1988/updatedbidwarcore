#!/usr/bin/env node
/**
 * Production launch verification — read-only counts.
 * Usage: node scripts/launch-verification.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

function loadDatabaseUrl() {
  const envPath = join(root, ".env");
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^DATABASE_URL="?([^"\n]+)"?/);
      if (m) return m[1];
      const n = line.match(/^NEON_DATABASE_URL="?([^"\n]+)"?/);
      if (n) return n[1];
    }
  }
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
}

const url = loadDatabaseUrl();
if (!url) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 30000 });

async function count(q, params = []) {
  const r = await pool.query(q, params);
  return parseInt(r.rows[0]?.cnt ?? r.rows[0]?.count ?? "0", 10);
}

async function main() {
  const result = { auditedAt: new Date().toISOString(), tables: {} };

  // ── player_statistics ──
  const psTotal = await count(`SELECT COUNT(*)::int AS cnt FROM player_statistics`);
  const psWrongSport = await count(`
    SELECT COUNT(*)::int AS cnt FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE ps.tournament_id IS NOT NULL AND lower(ps.sport) <> lower(t.sport)
  `);
  const psBadmintonCricket = await count(`
    SELECT COUNT(*)::int AS cnt FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE lower(t.sport) = 'badminton' AND lower(ps.sport) = 'cricket'
  `);
  const psDuplicates = await count(`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT player_id, sport, tournament_id FROM player_statistics
      GROUP BY player_id, sport, tournament_id HAVING COUNT(*) > 1
    ) d
  `);
  const psOrphans = await count(`
    SELECT COUNT(*)::int AS cnt FROM player_statistics ps
    LEFT JOIN global_players gp ON gp.id = ps.player_id
    WHERE gp.id IS NULL
  `);

  result.tables.player_statistics = {
    totalRows: psTotal,
    needingRepair: psWrongSport + psDuplicates,
    wrongSport: psWrongSport,
    badmintonTaggedCricket: psBadmintonCricket,
    duplicateGroups: psDuplicates,
    orphanRows: psOrphans,
  };

  // ── player_team_assignments ──
  const ptaTotal = await count(`SELECT COUNT(*)::int AS cnt FROM player_team_assignments`);
  const ptaWrongSport = await count(`
    SELECT COUNT(*)::int AS cnt FROM player_team_assignments pta
    INNER JOIN tournaments t ON t.id = pta.tournament_id
    WHERE pta.tournament_id IS NOT NULL AND lower(pta.sport) <> lower(t.sport)
  `);
  const ptaMultiActive = await count(`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT player_id, tournament_id, sport FROM player_team_assignments
      WHERE is_active = true AND tournament_id IS NOT NULL
      GROUP BY player_id, tournament_id, sport HAVING COUNT(*) > 1
    ) d
  `);
  const ptaOrphans = await count(`
    SELECT COUNT(*)::int AS cnt FROM player_team_assignments pta
    LEFT JOIN global_players gp ON gp.id = pta.player_id
    WHERE gp.id IS NULL
  `);

  result.tables.player_team_assignments = {
    totalRows: ptaTotal,
    needingRepair: ptaWrongSport + ptaMultiActive,
    wrongSport: ptaWrongSport,
    multipleActiveGroups: ptaMultiActive,
    orphanRows: ptaOrphans,
  };

  // ── player_sport_profiles ──
  let pspTableMissing = false;
  try {
    const pspTotal = await count(`SELECT COUNT(*)::int AS cnt FROM player_sport_profiles`);
    const pspMissing = await count(`
      SELECT COUNT(*)::int AS cnt FROM (
        SELECT DISTINCT p.global_player_id, lower(t.sport) AS sport_slug
        FROM players p
        INNER JOIN tournaments t ON t.id = p.tournament_id
        WHERE p.global_player_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM player_sport_profiles psp
            WHERE psp.global_player_id = p.global_player_id
              AND lower(psp.sport_slug) = lower(t.sport)
          )
      ) m
    `);
    const pspDuplicates = await count(`
      SELECT COUNT(*)::int AS cnt FROM (
        SELECT global_player_id, sport_slug FROM player_sport_profiles
        GROUP BY global_player_id, sport_slug HAVING COUNT(*) > 1
      ) d
    `);
    const pspOrphans = await count(`
      SELECT COUNT(*)::int AS cnt FROM player_sport_profiles psp
      WHERE NOT EXISTS (
        SELECT 1 FROM players p
        INNER JOIN tournaments t ON t.id = p.tournament_id
        WHERE p.global_player_id = psp.global_player_id
          AND lower(t.sport) = lower(psp.sport_slug)
      )
    `);
    result.tables.player_sport_profiles = {
      totalRows: pspTotal,
      needingRepair: pspMissing,
      missingProfileLinks: pspMissing,
      duplicateProfiles: pspDuplicates,
      orphanProfiles: pspOrphans,
    };
  } catch (e) {
    pspTableMissing = true;
    result.tables.player_sport_profiles = {
      totalRows: null,
      tableMissing: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── player_spec_values ──
  try {
    const psvTotal = await count(`SELECT COUNT(*)::int AS cnt FROM player_spec_values`);
    const psvMissing = await count(`
      SELECT COUNT(*)::int AS cnt FROM players p
      WHERE (
        p.batting_style IS NOT NULL AND trim(p.batting_style) <> ''
        OR p.bowling_style IS NOT NULL AND trim(p.bowling_style) <> ''
        OR p.specialization IS NOT NULL AND trim(p.specialization) <> ''
      )
      AND NOT EXISTS (SELECT 1 FROM player_spec_values psv WHERE psv.player_id = p.id)
    `);
    const playersWithLegacySpecs = await count(`
      SELECT COUNT(*)::int AS cnt FROM players p
      WHERE p.batting_style IS NOT NULL OR p.bowling_style IS NOT NULL OR p.specialization IS NOT NULL
    `);
    const playersTotal = await count(`SELECT COUNT(*)::int AS cnt FROM players`);
    result.tables.player_spec_values = {
      totalRows: psvTotal,
      needingRepair: psvMissing,
      missingSpecValues: psvMissing,
      playersWithLegacySpecsOnly: psvMissing,
      playersTotal,
      coveragePct: playersTotal > 0 ? Math.round(((playersTotal - psvMissing) / playersTotal) * 100) : 100,
    };
  } catch (e) {
    result.tables.player_spec_values = {
      totalRows: null,
      tableMissing: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Summary
  const repairNeeded =
    (result.tables.player_statistics?.needingRepair ?? 0) +
    (result.tables.player_team_assignments?.needingRepair ?? 0) +
    (result.tables.player_sport_profiles?.needingRepair ?? 0) +
    (result.tables.player_spec_values?.needingRepair ?? 0);

  result.summary = {
    repairScriptsRequiredBeforeLaunch: repairNeeded > 0,
    totalRepairItems: repairNeeded,
    negligibleThreshold: repairNeeded <= 5,
  };

  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
