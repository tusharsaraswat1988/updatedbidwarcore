/**
 * Minimal query surface shared by pg.Pool and pg.PoolClient.
 * Schema boot prefers a single client so SET lock/statement timeouts apply.
 */
export type DbQueryable = {
  query: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <T extends import("pg").QueryResultRow = any>(
      queryTextOrConfig: string | import("pg").QueryConfig,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values?: any[],
    ): Promise<import("pg").QueryResult<T>>;
  };
};

/** Default wall-clock budget for schema validate/heal before refusing to start. */
export const DEFAULT_SCHEMA_BOOT_TIMEOUT_MS = 90_000;

/** Per-statement timeout applied on the schema-boot DB client. */
export const DEFAULT_SCHEMA_STATEMENT_TIMEOUT_MS = 30_000;

/** Lock wait timeout on the schema-boot DB client (fail instead of hang). */
export const DEFAULT_SCHEMA_LOCK_TIMEOUT_MS = 15_000;

export function resolveSchemaBootTimeoutMs(
  raw: string | undefined = process.env.SCHEMA_BOOT_TIMEOUT_MS,
): number {
  if (!raw?.trim()) return DEFAULT_SCHEMA_BOOT_TIMEOUT_MS;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 5_000) return DEFAULT_SCHEMA_BOOT_TIMEOUT_MS;
  return Math.floor(n);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
