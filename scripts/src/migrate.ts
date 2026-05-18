import pg from "pg";

const { Client } = pg;

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL is not set");
}

const client = new Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const migrations: Array<{ label: string; sql: string }> = [
  {
    label: "organizers_google_id_unique",
    sql: `ALTER TABLE organizers ADD CONSTRAINT organizers_google_id_unique UNIQUE (google_id)`,
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
