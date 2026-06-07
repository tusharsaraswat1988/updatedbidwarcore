import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env" });
import pg from "pg";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const { Client } = pg;

const client = new Client({
  connectionString: resolveDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const migrations: Array<{ label: string; sql: string }> = [
  {
    label: "organizers_google_id_unique",
    sql: `ALTER TABLE organizers ADD CONSTRAINT organizers_google_id_unique UNIQUE (google_id)`,
  },
  {
    label: "teams_tournament_owner_mobile_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_tournament_owner_mobile ON teams (tournament_id, owner_mobile)`,
  },
  {
    label: "teams_owner_photo_url",
    sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text`,
  },
  {
    label: "players_email",
    sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS email text`,
  },
  {
    label: "teams_owner_email",
    sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text`,
  },
  {
    label: "create_sessions_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid"    varchar      NOT NULL COLLATE "default",
        "sess"   json         NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire");
    `,
  },
];

for (const m of migrations) {
  try {
    await client.query(m.sql);
    console.log(`[migrate] applied: ${m.label}`);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "42710" || code === "42P07") {
      console.log(`[migrate] already exists, skipping: ${m.label}`);
    } else {
      await client.end();
      throw e;
    }
  }
}

await client.end();
process.exit(0);
