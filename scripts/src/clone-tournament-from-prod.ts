#!/usr/bin/env tsx
/**
 * Clone a tournament from production (read-only source) into local DB as a NEW tournament.
 *
 * Safety:
 * - Source tournament is never UPDATE'd or DELETE'd — only SELECT.
 * - Writes go to target DB only (defaults to same DATABASE_URL as .env when LOCAL_DATABASE_URL unset).
 * - New tournament gets fresh auction_code, cleared export/local-mode sync tokens.
 *
 * Usage:
 *   pnpm exec tsx --env-file=../.env src/clone-tournament-from-prod.ts --source-id 5
 *   pnpm exec tsx --env-file=../.env src/clone-tournament-from-prod.ts --source-id 5 --dry-run
 *
 * Env:
 *   PRODUCTION_DATABASE_URL — source (defaults to DATABASE_URL / NEON_DATABASE_URL)
 *   LOCAL_DATABASE_URL      — target (defaults to DATABASE_URL / NEON_DATABASE_URL)
 */

import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sourceIdArg = args.find((a) => a.startsWith("--source-id="));
const nameSuffixArg = args.find((a) => a.startsWith("--name-suffix="));
const organizerEmailArg = args.find((a) => a.startsWith("--organizer-email="));

const SOURCE_TOURNAMENT_ID = sourceIdArg
  ? Number(sourceIdArg.split("=")[1])
  : 5;
const NAME_SUFFIX = nameSuffixArg?.split("=")[1] ?? " (Local Copy)";
const ORGANIZER_EMAIL = organizerEmailArg?.split("=")[1] ?? "tusharsaraswat1988@gmail.com";

const repoRoot = join(import.meta.dirname, "../..");

function loadUrlFromFile(file: string): string | null {
  const path = join(repoRoot, file);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^NEON_DATABASE_URL="?([^"\n]+)"?/);
    if (m) return m[1];
    const n = line.match(/^DATABASE_URL="?([^"\n]+)"?/);
    if (n) return n[1];
  }
  return null;
}

function resolveUrl(kind: "source" | "target"): string {
  const fromEnv =
    kind === "source"
      ? process.env.PRODUCTION_DATABASE_URL?.trim()
      : process.env.LOCAL_DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  const fromDotEnv = loadUrlFromFile(".env");
  if (fromDotEnv) return fromDotEnv;

  const fallback = process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!fallback) {
    throw new Error("No database URL found. Set DATABASE_URL or PRODUCTION_DATABASE_URL / LOCAL_DATABASE_URL.");
  }
  return fallback;
}

function buildAuctionCode(name: string, auctionDate?: string | null): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const tt =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : (words[0]?.substring(0, 2) ?? "XX").toUpperCase();
  const nn = String(Math.floor(Math.random() * 90) + 10);
  const d = auctionDate ? new Date(auctionDate) : new Date();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tt}${nn}${dd}${mm}`;
}

async function generateUniqueAuctionCode(
  client: pg.PoolClient,
  name: string,
  auctionDate?: string | null,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = buildAuctionCode(name, auctionDate);
    const existing = await client.query("SELECT id FROM tournaments WHERE auction_code = $1 LIMIT 1", [
      code,
    ]);
    if (existing.rows.length === 0) return code;
  }
  return buildAuctionCode(name, auctionDate) + String(Math.floor(Math.random() * 90) + 10);
}

function omitKeys(row: Row, keys: string[]): Row {
  const out: Row = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

function remapSideJson(
  side: unknown,
  badmintonPlayerMap: Map<number, number>,
): unknown {
  if (!side || typeof side !== "object") return side;
  const s = { ...(side as Record<string, unknown>) };
  if (Array.isArray(s.playerIds)) {
    s.playerIds = (s.playerIds as number[]).map((id) => badmintonPlayerMap.get(id) ?? id);
  }
  return s;
}

function remapPlayerIdsInJson(
  value: unknown,
  badmintonPlayerMap: Map<number, number>,
): unknown {
  if (value == null) return value;
  if (typeof value === "number") return badmintonPlayerMap.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remapPlayerIdsInJson(v, badmintonPlayerMap));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "playerIds" && Array.isArray(v)) {
        out[k] = (v as number[]).map((id) => badmintonPlayerMap.get(id) ?? id);
      } else if (k.endsWith("PlayerId") && typeof v === "number") {
        out[k] = badmintonPlayerMap.get(v) ?? v;
      } else {
        out[k] = remapPlayerIdsInJson(v, badmintonPlayerMap);
      }
    }
    return out;
  }
  return value;
}

function parseDeferredPlayerIds(raw: unknown): number[] {
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
    } catch {
      return raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter(Boolean);
    }
  }
  if (Array.isArray(raw)) return raw.map(Number).filter(Boolean);
  return [];
}

async function insertRow(
  client: pg.PoolClient,
  table: string,
  row: Row,
  returning = "id",
): Promise<number> {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const q = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders}) RETURNING ${returning}`;
  const res = await client.query(q, vals);
  return Number(res.rows[0][returning]);
}

async function copySimpleTable(
  client: pg.PoolClient,
  table: string,
  sourceId: number,
  newTournamentId: number,
  transform: (row: Row) => Row,
): Promise<Map<number, number>> {
  const idMap = new Map<number, number>();
  const { rows } = await client.query(`SELECT * FROM "${table}" WHERE tournament_id = $1 ORDER BY id`, [
    sourceId,
  ]);
  for (const row of rows as Row[]) {
    const oldId = Number(row.id);
    const payload = transform({
      ...omitKeys(row, ["id"]),
      tournament_id: newTournamentId,
    });
    if (dryRun) {
      idMap.set(oldId, -oldId);
      continue;
    }
    const newId = await insertRow(client, table, payload);
    idMap.set(oldId, newId);
  }
  return idMap;
}

async function main() {
  const sourceUrl = resolveUrl("source");
  const targetUrl = resolveUrl("target");
  const sameDb = sourceUrl === targetUrl;

  console.log(`Source tournament id: ${SOURCE_TOURNAMENT_ID}`);
  console.log(`Target: ${sameDb ? "same database (insert-only clone)" : "separate database"}`);
  console.log(`Dry run: ${dryRun}`);

  const sourcePool = sameDb ? null : new pg.Pool({ connectionString: sourceUrl, max: 3 });
  const targetPool = new pg.Pool({ connectionString: targetUrl, max: 3 });

  const read = async <T extends pg.QueryResultRow>(q: string, params: unknown[] = []) => {
    const pool = sourcePool ?? targetPool;
    return pool.query<T>(q, params);
  };

  try {
    const srcTournament = await read("SELECT * FROM tournaments WHERE id = $1", [SOURCE_TOURNAMENT_ID]);
    if (srcTournament.rows.length === 0) {
      throw new Error(`Source tournament ${SOURCE_TOURNAMENT_ID} not found`);
    }
    const source = srcTournament.rows[0] as Row;
    console.log(`Source tournament: "${source.name}" (${source.sport})`);

    const orgRes = await read("SELECT * FROM organizers WHERE lower(email) = lower($1) LIMIT 1", [
      ORGANIZER_EMAIL,
    ]);
    if (orgRes.rows.length === 0) {
      throw new Error(`Organizer not found in target DB: ${ORGANIZER_EMAIL}`);
    }
    const organizer = orgRes.rows[0] as Row;

    const client = dryRun ? null : await targetPool.connect();
    try {
      if (client) await client.query("BEGIN");

      const newName = `${String(source.name)}${NAME_SUFFIX}`;
      const auctionCode = client
        ? await generateUniqueAuctionCode(client, newName, source.auction_date as string | null)
        : buildAuctionCode(newName, source.auction_date as string | null);

      const tournamentPayload: Row = {
        ...omitKeys(source, ["id", "created_at", "updated_at"]),
        name: newName,
        organizer_id: organizer.id,
        organizer_name: organizer.name,
        organizer_email: organizer.email,
        organizer_mobile: organizer.mobile ?? source.organizer_mobile,
        auction_code: auctionCode,
        local_mode_enabled: false,
        export_token: null,
        export_token_expires_at: null,
        export_token_synced_at: null,
        export_token_last_mirror_at: null,
        license_status: source.license_status ?? "trial",
        admin_locked: false,
        reset_count: 0,
        last_reset_at: null,
        last_reset_by: null,
      };

      let newTournamentId: number;
      if (dryRun) {
        newTournamentId = -1;
        console.log(`[dry-run] Would create tournament "${newName}" with code ${auctionCode}`);
      } else {
        newTournamentId = await insertRow(client!, "tournaments", tournamentPayload);
        console.log(`Created tournament id=${newTournamentId} name="${newName}" code=${auctionCode}`);
      }

      const teamMap = client
        ? await copySimpleTable(client, "teams", SOURCE_TOURNAMENT_ID, newTournamentId, (r) => r)
        : new Map<number, number>();

      const categoryMap = client
        ? await copySimpleTable(client, "categories", SOURCE_TOURNAMENT_ID, newTournamentId, (r) => r)
        : new Map<number, number>();

      const playerMap = new Map<number, number>();
      if (client) {
        const { rows } = await client.query("SELECT * FROM players WHERE tournament_id = $1 ORDER BY id", [
          SOURCE_TOURNAMENT_ID,
        ]);
        for (const row of rows as Row[]) {
          const oldId = Number(row.id);
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          if (row.team_id != null) payload.team_id = teamMap.get(Number(row.team_id)) ?? row.team_id;
          if (row.category_id != null) {
            payload.category_id = categoryMap.get(Number(row.category_id)) ?? row.category_id;
          }
          const newId = await insertRow(client, "players", payload);
          playerMap.set(oldId, newId);
        }
      }

      if (client) {
        await copySimpleTable(client, "purse_boosters", SOURCE_TOURNAMENT_ID, newTournamentId, (r) => {
          if (r.team_id != null) r.team_id = teamMap.get(Number(r.team_id)) ?? r.team_id;
          r.local_uuid = randomUUID();
          return r;
        });

        const sessions = await client.query(
          "SELECT * FROM auction_sessions WHERE tournament_id = $1",
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of sessions.rows as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          if (row.current_player_id != null) {
            payload.current_player_id = playerMap.get(Number(row.current_player_id)) ?? null;
          }
          if (row.current_bid_team_id != null) {
            payload.current_bid_team_id = teamMap.get(Number(row.current_bid_team_id)) ?? null;
          }
          if (row.deferred_player_ids != null) {
            const ids = parseDeferredPlayerIds(row.deferred_player_ids).map(
              (id) => playerMap.get(id) ?? id,
            );
            payload.deferred_player_ids = JSON.stringify(ids);
          }
          await insertRow(client, "auction_sessions", payload);
        }

        const { rows: bids } = await client.query("SELECT * FROM bids WHERE tournament_id = $1 ORDER BY id", [
          SOURCE_TOURNAMENT_ID,
        ]);
        for (const row of bids as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          payload.player_id = playerMap.get(Number(row.player_id)) ?? row.player_id;
          payload.team_id = teamMap.get(Number(row.team_id)) ?? row.team_id;
          await insertRow(client, "bids", payload);
        }

        await copySimpleTable(
          client,
          "tournament_player_profiles",
          SOURCE_TOURNAMENT_ID,
          newTournamentId,
          (r) => r,
        );

        const { rows: mappings } = await client.query(
          `SELECT * FROM master_player_id_mappings
           WHERE tournament_id = $1 AND source_module <> 'badminton'
           ORDER BY id`,
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of mappings as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          if (row.source_module === "auction" || row.source_module === "players") {
            payload.source_player_id = playerMap.get(Number(row.source_player_id)) ?? row.source_player_id;
          }
          await insertRow(client, "master_player_id_mappings", payload);
        }

        await copySimpleTable(
          client,
          "player_statistics",
          SOURCE_TOURNAMENT_ID,
          newTournamentId,
          (r) => r,
        );
        await copySimpleTable(
          client,
          "player_team_assignments",
          SOURCE_TOURNAMENT_ID,
          newTournamentId,
          (r) => r,
        );
        await copySimpleTable(client, "display_auctions", SOURCE_TOURNAMENT_ID, newTournamentId, (r) => r);
      }

      const badmintonPlayerMap = client
        ? await copySimpleTable(
            client,
            "badminton_players",
            SOURCE_TOURNAMENT_ID,
            newTournamentId,
            (r) => r,
          )
        : new Map<number, number>();

      const badmintonCourtMap = client
        ? await copySimpleTable(
            client,
            "badminton_courts",
            SOURCE_TOURNAMENT_ID,
            newTournamentId,
            (r) => r,
          )
        : new Map<number, number>();

      const badmintonCategoryMap = client
        ? await copySimpleTable(
            client,
            "badminton_categories",
            SOURCE_TOURNAMENT_ID,
            newTournamentId,
            (r) => r,
          )
        : new Map<number, number>();

      const badmintonRegistrationMap = new Map<number, number>();
      if (client) {
        const { rows } = await client.query(
          "SELECT * FROM badminton_registrations WHERE tournament_id = $1 ORDER BY id",
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of rows as Row[]) {
          const oldId = Number(row.id);
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          payload.category_id = badmintonCategoryMap.get(Number(row.category_id)) ?? row.category_id;
          payload.player1_id = badmintonPlayerMap.get(Number(row.player1_id)) ?? row.player1_id;
          if (row.player2_id != null) {
            payload.player2_id = badmintonPlayerMap.get(Number(row.player2_id)) ?? row.player2_id;
          }
          const newId = await insertRow(client, "badminton_registrations", payload);
          badmintonRegistrationMap.set(oldId, newId);
        }
      }

      const badmintonDrawMap = client
        ? await copySimpleTable(
            client,
            "badminton_draws",
            SOURCE_TOURNAMENT_ID,
            newTournamentId,
            (r) => {
              r.category_id = badmintonCategoryMap.get(Number(r.category_id)) ?? r.category_id;
              return r;
            },
          )
        : new Map<number, number>();

      const badmintonFixtureMap = new Map<number, number>();
      if (client) {
        const { rows: fixtureRows } = await client.query(
          "SELECT * FROM badminton_fixtures WHERE tournament_id = $1 ORDER BY id",
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of fixtureRows as Row[]) {
          const oldId = Number(row.id);
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          payload.category_id = badmintonCategoryMap.get(Number(row.category_id)) ?? row.category_id;
          payload.draw_id = badmintonDrawMap.get(Number(row.draw_id)) ?? row.draw_id;
          if (row.registration_a_id != null) {
            payload.registration_a_id =
              badmintonRegistrationMap.get(Number(row.registration_a_id)) ?? row.registration_a_id;
          }
          if (row.registration_b_id != null) {
            payload.registration_b_id =
              badmintonRegistrationMap.get(Number(row.registration_b_id)) ?? row.registration_b_id;
          }
          if (row.court_id != null) {
            payload.court_id = badmintonCourtMap.get(Number(row.court_id)) ?? row.court_id;
          }
          payload.winner_advances_to = null;
          payload.loser_advances_to = null;
          payload.scoring_match_id = null;
          payload.winner_registration_id = null;
          const newId = await insertRow(client, "badminton_fixtures", payload);
          badmintonFixtureMap.set(oldId, newId);
        }

        for (const row of fixtureRows as Row[]) {
          const newFixtureId = badmintonFixtureMap.get(Number(row.id));
          if (!newFixtureId) continue;
          const updates: Row = {};
          if (row.winner_advances_to != null) {
            updates.winner_advances_to = badmintonFixtureMap.get(Number(row.winner_advances_to)) ?? null;
          }
          if (row.loser_advances_to != null) {
            updates.loser_advances_to = badmintonFixtureMap.get(Number(row.loser_advances_to)) ?? null;
          }
          if (row.winner_registration_id != null) {
            updates.winner_registration_id =
              badmintonRegistrationMap.get(Number(row.winner_registration_id)) ?? null;
          }
          if (Object.keys(updates).length > 0) {
            const sets = Object.keys(updates)
              .map((k, i) => `"${k}" = $${i + 2}`)
              .join(", ");
            await client.query(`UPDATE badminton_fixtures SET ${sets} WHERE id = $1`, [
              newFixtureId,
              ...Object.values(updates),
            ]);
          }
        }
      }

      const scoringMatchMap = new Map<number, number>();
      if (client) {
        const { rows } = await client.query(
          "SELECT * FROM scoring_matches WHERE tournament_id = $1 ORDER BY id",
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of rows as Row[]) {
          const oldId = Number(row.id);
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          if (row.fixture_id != null) {
            payload.fixture_id = badmintonFixtureMap.get(Number(row.fixture_id)) ?? null;
          }
          payload.home_side_json = remapSideJson(row.home_side_json, badmintonPlayerMap);
          payload.away_side_json = remapSideJson(row.away_side_json, badmintonPlayerMap);
          const newId = await insertRow(client, "scoring_matches", payload);
          scoringMatchMap.set(oldId, newId);

          const fixtureOld = row.fixture_id != null ? Number(row.fixture_id) : null;
          if (fixtureOld != null) {
            const newFixtureId = badmintonFixtureMap.get(fixtureOld);
            if (newFixtureId) {
              await client.query("UPDATE badminton_fixtures SET scoring_match_id = $1 WHERE id = $2", [
                newId,
                newFixtureId,
              ]);
            }
          }
        }

        const { rows: details } = await client.query(
          "SELECT * FROM badminton_match_details WHERE tournament_id = $1 ORDER BY id",
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of details as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          payload.scoring_match_id = scoringMatchMap.get(Number(row.scoring_match_id)) ?? row.scoring_match_id;
          if (row.category_id != null) {
            payload.category_id = badmintonCategoryMap.get(Number(row.category_id)) ?? row.category_id;
          }
          if (row.fixture_id != null) {
            payload.fixture_id = badmintonFixtureMap.get(Number(row.fixture_id)) ?? row.fixture_id;
          }
          if (row.court_id != null) {
            payload.court_id = badmintonCourtMap.get(Number(row.court_id)) ?? row.court_id;
          }
          payload.left_side_json = remapSideJson(row.left_side_json, badmintonPlayerMap);
          payload.right_side_json = remapSideJson(row.right_side_json, badmintonPlayerMap);
          payload.state_snapshot_json = remapPlayerIdsInJson(row.state_snapshot_json, badmintonPlayerMap);
          await insertRow(client, "badminton_match_details", payload);
        }

        const { rows: events } = await client.query(
          `SELECT se.* FROM scoring_events se
           INNER JOIN scoring_matches sm ON sm.id = se.match_id
           WHERE sm.tournament_id = $1
           ORDER BY se.id`,
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of events as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.match_id = scoringMatchMap.get(Number(row.match_id)) ?? row.match_id;
          payload.tournament_id = newTournamentId;
          if (row.fixture_id != null) {
            payload.fixture_id = badmintonFixtureMap.get(Number(row.fixture_id)) ?? null;
          }
          payload.payload_json = remapPlayerIdsInJson(row.payload_json, badmintonPlayerMap);
          payload.metadata_json = remapPlayerIdsInJson(row.metadata_json, badmintonPlayerMap);
          await insertRow(client, "scoring_events", payload);
        }

        const eventTables = [
          "auction_bid_events",
          "auction_player_events",
          "auction_timer_events",
        ] as const;
        for (const table of eventTables) {
          const { rows: evRows } = await client.query(
            `SELECT * FROM "${table}" WHERE tournament_id = $1 ORDER BY id`,
            [SOURCE_TOURNAMENT_ID],
          );
          for (const row of evRows as Row[]) {
            const payload = omitKeys(row, ["id"]);
            payload.tournament_id = newTournamentId;
            if (row.player_id != null) {
              payload.player_id = playerMap.get(Number(row.player_id)) ?? row.player_id;
            }
            if (row.category_id != null) {
              payload.category_id = categoryMap.get(Number(row.category_id)) ?? row.category_id;
            }
            if (row.team_id != null) {
              payload.team_id = teamMap.get(Number(row.team_id)) ?? row.team_id;
            }
            if (row.sold_to_team_id != null) {
              payload.sold_to_team_id = teamMap.get(Number(row.sold_to_team_id)) ?? row.sold_to_team_id;
            }
            await insertRow(client, table, payload);
          }
        }

        // Remap badminton mappings created after badminton_players insert
        const { rows: bmMappings } = await client.query(
          `SELECT * FROM master_player_id_mappings
           WHERE tournament_id = $1 AND source_module = 'badminton'
           ORDER BY id`,
          [SOURCE_TOURNAMENT_ID],
        );
        for (const row of bmMappings as Row[]) {
          const payload = omitKeys(row, ["id"]);
          payload.tournament_id = newTournamentId;
          payload.source_player_id =
            badmintonPlayerMap.get(Number(row.source_player_id)) ?? row.source_player_id;
          await insertRow(client, "master_player_id_mappings", payload);
        }
      }

      if (client) await client.query("COMMIT");

      if (!dryRun) {
        const verify = await targetPool.query(
          `
          SELECT
            (SELECT COUNT(*)::int FROM teams WHERE tournament_id = $1) AS teams,
            (SELECT COUNT(*)::int FROM players WHERE tournament_id = $1) AS players,
            (SELECT COUNT(*)::int FROM badminton_players WHERE tournament_id = $1) AS badminton_players,
            (SELECT COUNT(*)::int FROM badminton_fixtures WHERE tournament_id = $1) AS badminton_fixtures,
            (SELECT COUNT(*)::int FROM scoring_matches WHERE tournament_id = $1) AS scoring_matches,
            (SELECT COUNT(*)::int FROM bids WHERE tournament_id = $1) AS bids
          `,
          [newTournamentId],
        );
        console.log("\nClone complete.");
        console.log(`New tournament id: ${newTournamentId}`);
        console.log(`Organizer: ${organizer.name} <${organizer.email}>`);
        console.log("Row counts:", verify.rows[0]);

        const srcVerify = await read(
          "SELECT id, name, updated_at FROM tournaments WHERE id = $1",
          [SOURCE_TOURNAMENT_ID],
        );
        console.log(`\nSource tournament ${SOURCE_TOURNAMENT_ID} untouched:`, srcVerify.rows[0]);
      } else {
        const counts = await read(
          `
          SELECT
            (SELECT COUNT(*)::int FROM teams WHERE tournament_id = $1) AS teams,
            (SELECT COUNT(*)::int FROM players WHERE tournament_id = $1) AS players,
            (SELECT COUNT(*)::int FROM badminton_players WHERE tournament_id = $1) AS badminton_players,
            (SELECT COUNT(*)::int FROM badminton_fixtures WHERE tournament_id = $1) AS badminton_fixtures,
            (SELECT COUNT(*)::int FROM scoring_matches WHERE tournament_id = $1) AS scoring_matches,
            (SELECT COUNT(*)::int FROM bids WHERE tournament_id = $1) AS bids,
            (SELECT COUNT(*)::int FROM auction_bid_events WHERE tournament_id = $1) AS auction_bid_events,
            (SELECT COUNT(*)::int FROM scoring_events se INNER JOIN scoring_matches sm ON sm.id = se.match_id WHERE sm.tournament_id = $1) AS scoring_events
          `,
          [SOURCE_TOURNAMENT_ID],
        );
        console.log("\n[dry-run] Would copy rows:", counts.rows[0]);
        console.log(`[dry-run] New name: "${newName}"`);
        console.log(`[dry-run] Organizer: ${organizer.name} <${organizer.email}>`);
      }
    } catch (err) {
      if (client) await client.query("ROLLBACK");
      throw err;
    } finally {
      client?.release();
    }
  } finally {
    await sourcePool?.end();
    await targetPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
