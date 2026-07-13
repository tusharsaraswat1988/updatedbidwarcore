/**
 * Compare Drizzle pgTable schemas vs ensure-schema.ts + System C DDL text.
 * Output: JSON report of columns/indexes declared in Drizzle that lack ADD COLUMN / CREATE in boot DDL.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(root, "lib/db/src/schema");
const ensurePath = path.join(root, "lib/db/src/ensure-schema.ts");
const systemCPath = path.join(root, "lib/db/src/index.ts");

function extractDrizzleTables(src, file) {
  const tables = {};
  // Match pgTable("name", { ... }) or pgTable("name", { ... }, (t) => [...])
  const starts = [];
  const re = /pgTable\(\s*["']([^"']+)["']\s*,/g;
  let m;
  while ((m = re.exec(src))) starts.push({ name: m[1], idx: m.index + m[0].length });

  for (let i = 0; i < starts.length; i++) {
    const { name, idx } = starts[i];
    // Find opening brace of columns object
    let j = idx;
    while (j < src.length && src[j] !== "{") j++;
    if (src[j] !== "{") continue;
    let depth = 0;
    let end = j;
    for (; end < src.length; end++) {
      if (src[end] === "{") depth++;
      else if (src[end] === "}") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    const body = src.slice(j + 1, end - 1);
    const cols = new Map();
    const colRe = /(\w+)\s*:\s*[\w.]+\(\s*["']([^"']+)["']/g;
    let cm;
    while ((cm = colRe.exec(body))) {
      cols.set(cm[2], cm[1]);
    }
    // Capture indexes in trailing callback if present
    const after = src.slice(end, end + 800);
    const indexNames = [];
    for (const im of after.matchAll(/(?:uniqueIndex|index)\(\s*["']([^"']+)["']\s*\)/g)) {
      indexNames.push(im[1]);
      // stop if we hit next export/const
      if (after.indexOf(im[0]) > 0 && /export const/.test(after.slice(0, after.indexOf(im[0])))) break;
    }
    // Only take indexes until we hit `);` that closes pgTable — heuristic: until next `\nexport `
    const closeMatch = after.match(/^[\s\S]*?\n\);/);
    const indexBlock = closeMatch ? closeMatch[0] : after.slice(0, 400);
    const idxs = [...indexBlock.matchAll(/(?:uniqueIndex|index)\(\s*["']([^"']+)["']\s*\)/g)].map((x) => x[1]);

    tables[name] = { file, columns: [...cols.keys()].sort(), fields: Object.fromEntries(cols), indexes: idxs };
  }
  return tables;
}

function parseBootDdl(text) {
  const addColumns = new Map(); // table -> Set(column)
  const createTables = new Set();
  const createIndexes = new Set();

  for (const m of text.matchAll(/ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/gi)) {
    const t = m[1].toLowerCase();
    const c = m[2].toLowerCase();
    if (!addColumns.has(t)) addColumns.set(t, new Set());
    addColumns.get(t).add(c);
  }

  for (const m of text.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*;/gi)) {
    const t = m[1].toLowerCase();
    createTables.add(t);
    if (!addColumns.has(t)) addColumns.set(t, new Set());
    // column names at start of lines in CREATE TABLE
    for (const cm of m[2].matchAll(/^\s*(\w+)\s+/gm)) {
      const col = cm[1].toLowerCase();
      if (["primary", "unique", "constraint", "foreign", "check", "references"].includes(col)) continue;
      addColumns.get(t).add(col);
    }
  }

  for (const m of text.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX IF NOT EXISTS\s+(\w+)/gi)) {
    createIndexes.add(m[1].toLowerCase());
  }

  return { addColumns, createTables, createIndexes };
}

const allTables = {};
for (const file of fs.readdirSync(schemaDir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const src = fs.readFileSync(path.join(schemaDir, file), "utf8");
  Object.assign(allTables, extractDrizzleTables(src, file));
}

const ensureText = fs.readFileSync(ensurePath, "utf8");
const systemCText = fs.readFileSync(systemCPath, "utf8");
const ensure = parseBootDdl(ensureText);
const systemC = parseBootDdl(systemCText);

function covered(table, column) {
  const t = table.toLowerCase();
  const c = column.toLowerCase();
  return (
    (ensure.addColumns.get(t)?.has(c) ?? false) ||
    (systemC.addColumns.get(t)?.has(c) ?? false)
  );
}

function tableCreatedInBoot(table) {
  const t = table.toLowerCase();
  return ensure.createTables.has(t) || systemC.createTables.has(t);
}

const missingColumns = [];
const tablesOnlyInDrizzle = [];
const drizzleIndexesMissingFromBoot = [];

for (const [table, meta] of Object.entries(allTables).sort(([a], [b]) => a.localeCompare(b))) {
  const missing = meta.columns.filter((c) => !covered(table, c));
  // If table is created in boot with columns, those count as covered.
  // Columns only in Drizzle and never mentioned in boot DDL = risk for existing prod tables
  // OR new tables that rely on drizzle-kit push / manual create.
  if (!tableCreatedInBoot(table) && missing.length === meta.columns.length) {
    tablesOnlyInDrizzle.push({ table, file: meta.file, columnCount: meta.columns.length, columns: meta.columns });
  } else if (missing.length) {
    missingColumns.push({ table, file: meta.file, missing, presentInDrizzle: meta.columns.length });
  }
  for (const idx of meta.indexes) {
    const inBoot =
      ensure.createIndexes.has(idx.toLowerCase()) || systemC.createIndexes.has(idx.toLowerCase());
    if (!inBoot) drizzleIndexesMissingFromBoot.push({ table, index: idx, file: meta.file });
  }
}

const report = {
  summary: {
    drizzleTables: Object.keys(allTables).length,
    tablesFullyAbsentFromBootDdl: tablesOnlyInDrizzle.length,
    tablesWithMissingColumnEnsures: missingColumns.length,
    missingColumnEntries: missingColumns.reduce((n, t) => n + t.missing.length, 0),
    drizzleNamedIndexesNotInBoot: drizzleIndexesMissingFromBoot.length,
  },
  // High priority: table exists historically in prod but column not ensured
  missingColumnsOnLikelyExistingTables: missingColumns,
  // Tables with zero boot coverage (created only via drizzle push / older deploys / other paths)
  tablesWithNoBootDdlCoverage: tablesOnlyInDrizzle,
  indexesDeclaredInDrizzleMissingFromBoot: drizzleIndexesMissingFromBoot,
  drizzleTableList: Object.keys(allTables).sort(),
};

fs.writeFileSync(path.join(root, "docs/SCHEMA_DRIFT_REPORT.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log("\n=== Missing columns on tables that HAVE some boot coverage ===");
for (const row of missingColumns) {
  console.log(`\n${row.table} (${row.file}):`);
  console.log("  " + row.missing.join(", "));
}
console.log("\n=== Tables with NO boot DDL at all ===");
for (const row of tablesOnlyInDrizzle) {
  console.log(`- ${row.table} (${row.file}) cols=${row.columnCount}`);
}
