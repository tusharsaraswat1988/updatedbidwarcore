#!/usr/bin/env node
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDatabaseUrl() {
  const envPath = join(root, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^DATABASE_URL="?([^"\n]+)"?/);
      if (m) return m[1];
    }
  }
  return process.env.DATABASE_URL;
}

const LEGACY_SPEC_KEYS = ["battingStyle", "bowlingStyle", "specialization"];
const LEGACY_COLS = ["batting_style", "bowling_style", "specialization"];

function resolveSpecs(player, specGroupLabels, specifications) {
  if (specifications?.length) {
    return specifications
      .filter((s) => s.value?.trim())
      .map((s) => ({ label: s.groupName, value: s.value.trim(), specGroupId: s.specGroupId }));
  }
  return LEGACY_SPEC_KEYS.flatMap((key, idx) => {
    const col = LEGACY_COLS[idx];
    const value = player[col]?.trim?.() ?? player[col];
    if (!value) return [];
    const label = specGroupLabels[idx]?.trim() || `Spec ${idx + 1}`;
    return [{ label, value: String(value) }];
  });
}

function toLedPlayer(player, categoryName, specGroupLabels, specifications) {
  const specs = resolveSpecs(player, specGroupLabels, specifications);
  return {
    id: String(player.id),
    name: player.name,
    roleRaw: player.role?.trim() || "Player",
    specs,
    basePrice: player.base_price,
    city: player.city ?? "",
    age: player.age ?? 0,
    serialNo: player.serial_no ?? player.id,
    portrait: player.photo_url ?? "",
    gender: player.gender ?? null,
    status: player.status,
    soldToTeamId: player.team_id != null ? String(player.team_id) : null,
    soldPrice: player.sold_price ?? null,
    achievements: player.achievements?.trim?.() || "",
    categoryName: categoryName ?? null,
  };
}

const pool = new pg.Pool({ connectionString: loadDatabaseUrl() });

try {
  const { rows } = await pool.query(`
    SELECT p.*, t.sport AS tournament_sport, t.name AS tournament_name
    FROM players p
    JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.name ILIKE '%Animesh Thakur%'
    ORDER BY p.id
    LIMIT 5
  `);

  for (const player of rows) {
    const specValues = await pool.query(
      `SELECT psv.spec_group_id, rsg.group_name, rsg.display_order, psv.value_text AS value
       FROM player_spec_values psv
       JOIN role_spec_groups rsg ON rsg.id = psv.spec_group_id
       WHERE psv.player_id = $1
       ORDER BY rsg.display_order`,
      [player.id],
    );

    const roleGroups = await pool.query(
      `SELECT rsg.group_name, rsg.display_order
       FROM role_spec_groups rsg
       JOIN sport_roles sr ON sr.id = rsg.role_id
       JOIN sports s ON s.id = sr.sport_id
       WHERE lower(sr.role_name) = lower($1)
         AND lower(s.slug) = lower($2)
         AND rsg.active = true
       ORDER BY rsg.display_order`,
      [player.role, player.tournament_sport],
    );

    const specGroupLabels = roleGroups.rows.map((r) => r.group_name);
    const specifications = specValues.rows.map((r) => ({
      specGroupId: r.spec_group_id,
      groupName: r.group_name,
      value: r.value,
    }));

    const ledPlayer = toLedPlayer(player, null, specGroupLabels, specifications);

    console.log(JSON.stringify({
      playerId: player.id,
      tournamentId: player.tournament_id,
      tournamentSport: player.tournament_sport,
      apiLegacy: {
        battingStyle: player.batting_style,
        bowlingStyle: player.bowling_style,
        specialization: player.specialization,
      },
      apiSpecifications: specifications,
      roleSpecGroupLabels: specGroupLabels,
      ledPlayer,
      specsRenderedOnPortrait: ledPlayer.specs[0] ?? null,
      specsAvailableButNotRendered: ledPlayer.specs.slice(1),
    }, null, 2));
  }
} finally {
  await pool.end();
}
