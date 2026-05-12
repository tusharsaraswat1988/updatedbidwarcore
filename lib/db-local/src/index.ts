import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { setupTables } from "./setup";

export * from "./schema";

export type LocalDb = Awaited<ReturnType<typeof createLocalDb>>;

export async function createLocalDb(filePath: string) {
  const client = createClient({ url: `file:${filePath}` });
  await setupTables(client);
  return drizzle(client, { schema });
}
