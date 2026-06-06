import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });
export const db = drizzle(pool, { schema });

export * from "./schema";
