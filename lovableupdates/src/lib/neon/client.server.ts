import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

declare global {
  // eslint-disable-next-line no-var
  var __neonSql: NeonQueryFunction<false, false> | undefined;
}

/**
 * Returns an HTTP-based Neon query function. Works inside Cloudflare Workers
 * where raw TCP (the `pg` Pool) hangs.
 *
 * Usage:
 *   const sql = getNeonSql();
 *   const rows = await sql`SELECT * FROM tournaments WHERE id = ${id}`;
 *   // or parameterized:
 *   const rows = await sql.query("SELECT * FROM t WHERE id = $1", [id]);
 */
export function getNeonSql(): NeonQueryFunction<false, false> {
  if (!globalThis.__neonSql) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error("NEON_DATABASE_URL not set");
    globalThis.__neonSql = neon(url);
  }
  return globalThis.__neonSql;
}

/**
 * Back-compat shim mimicking the `pg` Pool API surface this project uses
 * (`pool.query(text, params)` returning `{ rows }`). Lets existing code keep
 * its shape while running on Neon's HTTP driver.
 */
export function getNeonPool() {
  const sql = getNeonSql();
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: async (text: string, params: unknown[] = []): Promise<{ rows: any[] }> => {
      const rows = (await sql.query(text, params)) as unknown[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { rows: rows as any[] };
    },
  };
}
