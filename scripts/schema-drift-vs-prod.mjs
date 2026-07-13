/**
 * Three-way schema drift: Drizzle ↔ ensure/System-C boot DDL ↔ live production DB dump.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(root, "lib/db/src/schema");
const ensurePath = path.join(root, "lib/db/src/ensure-schema.ts");
const systemCPath = path.join(root, "lib/db/src/index.ts");
const prodColsPath = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-win-10-updatedbidwarcore/agent-tools/e04419ed-594a-40aa-9108-660970a6eaab.txt",
);
const prodIdxPath = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-win-10-updatedbidwarcore/agent-tools/098acb8c-c1d4-47cd-8e4b-93a178f8f355.txt",
);

function extractDrizzleTables(src, file) {
  const tables = {};
  const starts = [];
  const re = /pgTable\(\s*["']([^"']+)["']\s*,/g;
  let m;
  while ((m = re.exec(src))) starts.push({ name: m[1], idx: m.index + m[0].length });

  for (const { name, idx } of starts) {
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
    while ((cm = colRe.exec(body))) cols.set(cm[2], cm[1]);

    const after = src.slice(end, end + 1200);
    const closeMatch = after.match(/^[\s\S]*?\n\);/);
    const indexBlock = closeMatch ? closeMatch[0] : after.slice(0, 500);
    const idxs = [...indexBlock.matchAll(/(?:uniqueIndex|index)\(\s*["']([^"']+)["']\s*\)/g)].map((x) => x[1]);

    tables[name] = { file, columns: [...cols.keys()].sort(), indexes: idxs };
  }
  return tables;
}

function parseBootDdl(text) {
  const addColumns = new Map();
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

function parseProdColumns(raw) {
  // Neon MCP dumps JSON array
  const data = JSON.parse(raw);
  const map = new Map();
  for (const row of data) {
    const t = row.table_name;
    if (!map.has(t)) map.set(t, new Set());
    map.get(t).add(row.column_name);
  }
  return map;
}

function parseProdIndexes(raw) {
  const data = JSON.parse(raw);
  return new Set(data.map((r) => r.indexname.toLowerCase()));
}

const allTables = {};
for (const file of fs.readdirSync(schemaDir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  Object.assign(allTables, extractDrizzleTables(fs.readFileSync(path.join(schemaDir, file), "utf8"), file));
}

const ensure = parseBootDdl(fs.readFileSync(ensurePath, "utf8"));
const systemC = parseBootDdl(fs.readFileSync(systemCPath, "utf8"));
const bootCols = (table, col) => {
  const t = table.toLowerCase();
  const c = col.toLowerCase();
  return (ensure.addColumns.get(t)?.has(c) ?? false) || (systemC.addColumns.get(t)?.has(c) ?? false);
};
const bootTable = (table) =>
  ensure.createTables.has(table.toLowerCase()) || systemC.createTables.has(table.toLowerCase());
const bootIndex = (name) =>
  ensure.createIndexes.has(name.toLowerCase()) || systemC.createIndexes.has(name.toLowerCase());

const prodCols = parseProdColumns(fs.readFileSync(prodColsPath, "utf8"));
const prodIndexes = parseProdIndexes(fs.readFileSync(prodIdxPath, "utf8"));

const criticalMissingInProd = []; // in Drizzle, missing in production (breaks SELECT *)
const missingBootEnsure = []; // in Drizzle, missing from boot DDL (future deploys / fresh DBs risk)
const prodOnlyColumns = []; // in prod, not in Drizzle (orphan / legacy)
const drizzleTablesMissingInProd = [];
const prodTablesNotInDrizzle = [];

for (const [table, meta] of Object.entries(allTables)) {
  const live = prodCols.get(table);
  if (!live) {
    drizzleTablesMissingInProd.push({ table, file: meta.file, columns: meta.columns });
    continue;
  }
  const missingLive = meta.columns.filter((c) => !live.has(c));
  if (missingLive.length) {
    criticalMissingInProd.push({
      table,
      file: meta.file,
      missingInProduction: missingLive,
      alsoMissingFromBootDdl: missingLive.filter((c) => !bootCols(table, c)),
      ensuredInBootButMissingInProd: missingLive.filter((c) => bootCols(table, c)),
    });
  }
  const orphan = [...live].filter((c) => !meta.columns.includes(c)).sort();
  if (orphan.length) prodOnlyColumns.push({ table, orphanColumns: orphan });
}

for (const table of [...prodCols.keys()].sort()) {
  if (!allTables[table]) prodTablesNotInDrizzle.push(table);
}

for (const [table, meta] of Object.entries(allTables)) {
  const missingBoot = meta.columns.filter((c) => !bootCols(table, c));
  // Skip reporting every column on tables that have zero boot coverage as "missing ensures"
  // — those belong in tablesWithNoBootCoverage
  const hasAnyBoot = bootTable(table) || meta.columns.some((c) => bootCols(table, c));
  if (hasAnyBoot && missingBoot.length) {
    missingBootEnsure.push({ table, file: meta.file, missingFromBootDdl: missingBoot });
  }
}

const tablesWithNoBootCoverage = Object.entries(allTables)
  .filter(([table, meta]) => !bootTable(table) && !meta.columns.some((c) => bootCols(table, c)))
  .map(([table, meta]) => ({
    table,
    file: meta.file,
    inProduction: prodCols.has(table),
    columnCount: meta.columns.length,
  }))
  .sort((a, b) => a.table.localeCompare(b.table));

const indexGaps = [];
for (const [table, meta] of Object.entries(allTables)) {
  for (const idx of meta.indexes) {
    const inProd = prodIndexes.has(idx.toLowerCase());
    const inBoot = bootIndex(idx);
    if (!inProd || !inBoot) {
      indexGaps.push({ table, index: idx, inProduction: inProd, inBootDdl: inBoot, file: meta.file });
    }
  }
}

const migrationSql = [];
for (const row of criticalMissingInProd) {
  for (const col of row.missingInProduction) {
    // Infer type from drizzle is hard here — emit placeholder with TODO
    migrationSql.push({
      priority: "P0",
      sql: `ALTER TABLE ${row.table} ADD COLUMN IF NOT EXISTS ${col} /* TODO: confirm type from lib/db/src/schema/${row.file} */ text;`,
      reason: `Drizzle maps ${row.table}.${col} but production is missing it — SELECT * will 500`,
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  productionProject: "jolly-tree-42208228 (Bidwar Prduction Database)",
  summary: {
    drizzleTables: Object.keys(allTables).length,
    productionTables: prodCols.size,
    criticalColumnsMissingInProduction: criticalMissingInProd.reduce(
      (n, r) => n + r.missingInProduction.length,
      0,
    ),
    tablesWithCriticalDrift: criticalMissingInProd.length,
    drizzleTablesAbsentInProduction: drizzleTablesMissingInProd.length,
    productionTablesNotInDrizzle: prodTablesNotInDrizzle.length,
    tablesWithNoBootDdlCoverage: tablesWithNoBootCoverage.length,
    tablesWithPartialBootGaps: missingBootEnsure.length,
    namedIndexGaps: indexGaps.length,
  },
  critical: {
    columnsInDrizzleMissingInProduction: criticalMissingInProd,
    tablesInDrizzleMissingInProduction: drizzleTablesMissingInProd,
  },
  bootDdlCoverage: {
    tablesWithNoBootDdlCoverage: tablesWithNoBootCoverage,
    columnsMissingFromBootOnCoveredTables: missingBootEnsure,
  },
  indexes: {
    drizzleNamedIndexesMissingInProdOrBoot: indexGaps,
  },
  informational: {
    productionColumnsNotInDrizzle: prodOnlyColumns,
    productionTablesNotInDrizzle: prodTablesNotInDrizzle,
  },
  proposedMigrationStatements: migrationSql,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/SCHEMA_DRIFT_REPORT.json"), JSON.stringify(report, null, 2));

// Human markdown report
const md = [];
md.push("# Schema Drift Migration Report");
md.push("");
md.push(`Generated: ${report.generatedAt}`);
md.push(`Production: BidWar Production Neon (\`jolly-tree-42208228\`)`);
md.push("");
md.push("## Summary");
md.push("");
md.push("| Metric | Count |");
md.push("|--------|------:|");
for (const [k, v] of Object.entries(report.summary)) {
  md.push(`| ${k} | ${v} |`);
}
md.push("");
md.push("## P0 — Columns in Drizzle but missing in production");
md.push("");
md.push("These break `db.select().from(table)` (Drizzle emits all mapped columns).");
md.push("");
if (!criticalMissingInProd.length) {
  md.push("_None._");
} else {
  for (const row of criticalMissingInProd) {
    md.push(`### \`${row.table}\` (\`${row.file}\`)`);
    md.push("");
    md.push("| Column | In boot DDL? |");
    md.push("|--------|--------------|");
    for (const c of row.missingInProduction) {
      const inBoot = !row.alsoMissingFromBootDdl.includes(c);
      md.push(`| \`${c}\` | ${inBoot ? "yes (ensure failed or never ran)" : "**no**"} |`);
    }
    md.push("");
  }
}
md.push("## P0 — Tables in Drizzle but missing in production");
md.push("");
if (!drizzleTablesMissingInProd.length) md.push("_None._");
else {
  for (const row of drizzleTablesMissingInProd) {
    md.push(`- \`${row.table}\` (${row.file}) — ${row.columns.length} columns`);
  }
}
md.push("");
md.push("## P1 — Proposed production migration SQL");
md.push("");
md.push("```sql");
if (!migrationSql.length) md.push("-- no P0 column migrations required");
else {
  md.push("-- Review types against Drizzle schema before applying.");
  for (const s of migrationSql) md.push(s.sql);
}
md.push("```");
md.push("");
md.push("## P2 — Boot DDL coverage gaps (ensure-schema / System C)");
md.push("");
md.push("Tables with **zero** CREATE/ALTER coverage in boot DDL (rely on pre-existing prod or drizzle-kit):");
md.push("");
for (const row of tablesWithNoBootCoverage) {
  md.push(
    `- \`${row.table}\` (${row.file}) — inProduction=${row.inProduction} cols=${row.columnCount}`,
  );
}
md.push("");
md.push("Partial gaps (table has some ensures, but these Drizzle columns are not in boot DDL):");
md.push("");
for (const row of missingBootEnsure) {
  md.push(`### \`${row.table}\``);
  md.push("");
  md.push(row.missingFromBootDdl.map((c) => `\`${c}\``).join(", "));
  md.push("");
}
md.push("## Indexes (named in Drizzle)");
md.push("");
md.push("| Table | Index | In prod | In boot |");
md.push("|-------|-------|---------|---------|");
for (const row of indexGaps) {
  md.push(
    `| ${row.table} | ${row.index} | ${row.inProduction} | ${row.inBootDdl} |`,
  );
}
md.push("");
md.push("## Informational — production-only (not in Drizzle)");
md.push("");
md.push(`Production tables not mapped in Drizzle: ${prodTablesNotInDrizzle.length}`);
md.push("");
if (prodTablesNotInDrizzle.length) {
  md.push(prodTablesNotInDrizzle.map((t) => `\`${t}\``).join(", "));
  md.push("");
}

fs.writeFileSync(path.join(root, "docs/SCHEMA_DRIFT_MIGRATION_REPORT.md"), md.join("\n"));
console.log(JSON.stringify(report.summary, null, 2));
console.log("\nCritical missing in production:");
console.log(JSON.stringify(criticalMissingInProd, null, 2));
console.log("\nWrote docs/SCHEMA_DRIFT_MIGRATION_REPORT.md");
