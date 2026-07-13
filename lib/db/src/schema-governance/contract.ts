import { createHash } from "node:crypto";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../schema/index.js";
import type { SchemaColumnExpectation, SchemaContract, SchemaTableExpectation } from "./types.js";

/** Map Drizzle columnType → PostgreSQL type for idempotent ADD COLUMN. */
function drizzleColumnToSqlType(columnType: string, dataType: string): string {
  switch (columnType) {
    case "PgText":
    case "PgVarchar":
    case "PgChar":
      return "text";
    case "PgInteger":
    case "PgSerial":
      return "integer";
    case "PgBigInt53":
    case "PgBigInt64":
    case "PgBigSerial53":
    case "PgBigSerial64":
      return "bigint";
    case "PgBoolean":
      return "boolean";
    case "PgJsonb":
      return "jsonb";
    case "PgJson":
      return "json";
    case "PgUUID":
      return "uuid";
    case "PgTimestamp":
      return "timestamptz";
    case "PgTimestampString":
      return "timestamptz";
    case "PgNumeric":
    case "PgReal":
    case "PgDoublePrecision":
      return "numeric";
    default:
      if (dataType === "date") return "date";
      if (dataType === "number") return "integer";
      if (dataType === "boolean") return "boolean";
      if (dataType === "json") return "jsonb";
      return "text";
  }
}

/**
 * Build the expected schema contract directly from Drizzle table exports.
 * No duplicate hand-written schema definitions.
 */
export function buildSchemaContractFromDrizzle(): SchemaContract {
  const tables: SchemaTableExpectation[] = [];

  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const tableName = getTableName(value);
    const cols = getTableColumns(value);
    const columns: SchemaColumnExpectation[] = Object.values(cols).map((col) => ({
      name: col.name,
      sqlType: drizzleColumnToSqlType(col.columnType, col.dataType),
      notNull: Boolean(col.notNull),
      hasDefault: Boolean(col.hasDefault) || col.columnType.includes("Serial"),
    }));
    columns.sort((a, b) => a.name.localeCompare(b.name));
    tables.push({ name: tableName, columns });
  }

  tables.sort((a, b) => a.name.localeCompare(b.name));

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        tables.map((t) => ({
          n: t.name,
          c: t.columns.map((c) => [c.name, c.sqlType, c.notNull ? 1 : 0]),
        })),
      ),
    )
    .digest("hex")
    .slice(0, 16);

  return {
    schemaVersion: `drizzle-${fingerprint}`,
    generatedAt: new Date().toISOString(),
    tables,
  };
}
