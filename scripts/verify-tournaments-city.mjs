import { createRequire } from "module";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(".env") });
const require = createRequire(resolve("lib/db/package.json"));
const { Pool } = require("pg");

const p = new Pool({ connectionString: process.env.DATABASE_URL });
const host = (process.env.DATABASE_URL || "").match(/@([^/]+)/)?.[1];
console.log("DB host:", host);

const col = await p.query(
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'city'`,
);
console.log("city column:", col.rows);

if (col.rows.length === 0) {
  await p.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text`);
  console.log("Added city column");
}

const sample = await p.query(
  `SELECT id, name, city FROM tournaments ORDER BY id DESC LIMIT 3`,
);
console.log("sample tournaments:", sample.rows);

// Simulate Drizzle SELECT list including city (the failing query shape)
const sim = await p.query(
  `SELECT id, organizer_id, name, sport, city, venue, created_at
   FROM tournaments
   WHERE organizer_id IS NOT NULL
   LIMIT 5`,
);
console.log("select-with-city OK, rows:", sim.rowCount);

await p.end();
console.log("Phase 1 DB verification passed");
