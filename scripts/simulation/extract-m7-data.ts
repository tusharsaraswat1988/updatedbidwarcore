import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../.env") });

async function main() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("Missing DATABASE_URL");

  const client = new pg.Client({ connectionString: devUrl });
  await client.connect();

  const teams = await client.query(
    "SELECT id, name, short_code, purse, purse_used FROM teams WHERE tournament_id = 18 ORDER BY id"
  );
  const players = await client.query(
    "SELECT id, name, status, team_id, sold_price, category_id, base_price FROM players WHERE tournament_id = 18 ORDER BY id"
  );
  const categories = await client.query(
    "SELECT id, name FROM categories WHERE tournament_id = 18 ORDER BY id"
  );
  const bids = await client.query(
    "SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = 18 ORDER BY player_id"
  );
  const bidEvents = await client.query(
    "SELECT id, player_id, team_id, bid_amount, bid_sequence_number, became_leader FROM auction_bid_events WHERE tournament_id = 18 ORDER BY player_id, bid_sequence_number"
  );

  const catMap = new Map();
  categories.rows.forEach((c) => catMap.set(c.id, c.name));

  const teamMap = new Map();
  teams.rows.forEach((t) => teamMap.set(t.id, t.name));

  console.log("=== TEAMS DATA ===");
  console.table(
    teams.rows.map((t) => {
      const roster = players.rows.filter((p) => p.team_id === t.id);
      return {
        id: t.id,
        name: t.name,
        short_code: t.short_code,
        purse: Number(t.purse),
        purse_used: Number(t.purse_used),
        purse_remaining: Number(t.purse) - Number(t.purse_used),
        roster_size: roster.length,
      };
    })
  );

  console.log("\n=== PLAYERS DATA ===");
  const pData = players.rows.map((p) => {
    const pEvents = bidEvents.rows.filter((e) => e.player_id === p.id);
    const winningBid = bids.rows.find((b) => b.player_id === p.id);
    return {
      id: p.id,
      name: p.name,
      category: catMap.get(p.category_id) || `Cat ${p.category_id}`,
      base_price: Number(p.base_price),
      status: p.status,
      team: teamMap.get(p.team_id) || "—",
      sold_price: p.sold_price ? Number(p.sold_price) : "—",
      bid_count: pEvents.length,
      max_bid: winningBid ? Number(winningBid.amount) : "—",
    };
  });
  console.table(pData);

  // Group by status
  console.log("\n=== STATUS BREAKDOWN ===");
  const statusCounts: Record<string, number> = {};
  players.rows.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  console.log(statusCounts);

  await client.end();
}

main().catch(console.error);
