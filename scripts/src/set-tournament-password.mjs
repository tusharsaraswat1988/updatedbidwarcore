import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('ep-hidden-band-aogw7hho')) {
  console.error('Target database is not Dev Neon');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query("UPDATE tournaments SET organizer_password = 'testpass123' WHERE id = 30");
console.log('✓ Successfully set organizer_password on Tournament #30 to testpass123');
await client.end();
