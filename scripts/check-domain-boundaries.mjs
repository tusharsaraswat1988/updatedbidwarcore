#!/usr/bin/env node
/**
 * Lightweight domain-boundary check (no eslint plugin required).
 * Fails if sport packages import auction, or auction imports sports.
 *
 * Run: node scripts/check-domain-boundaries.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const FORBIDDEN = [
  {
    zone: "lib/sports-badminton",
    deny: ["@workspace/auction", "@workspace/sports-cricket", "@workspace/sports-football"],
  },
  {
    zone: "lib/sports-cricket",
    deny: ["@workspace/auction", "@workspace/sports-badminton", "@workspace/sports-football"],
  },
  {
    zone: "lib/sports-football",
    deny: ["@workspace/auction", "@workspace/sports-badminton", "@workspace/sports-cricket"],
  },
  {
    zone: "lib/auction",
    deny: [
      "@workspace/sports-badminton",
      "@workspace/sports-cricket",
      "@workspace/sports-football",
      "@workspace/badminton-core",
      "@workspace/scoring-core",
    ],
  },
  {
    zone: "lib/platform-core",
    deny: [
      "@workspace/auction",
      "@workspace/sports-badminton",
      "@workspace/sports-cricket",
      "@workspace/player-registry",
    ],
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const importRe = /from\s+["']([^"']+)["']/g;
let violations = 0;

for (const rule of FORBIDDEN) {
  const zonePath = join(root, rule.zone);
  let files;
  try {
    files = walk(zonePath);
  } catch {
    continue;
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let m;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(text))) {
      const spec = m[1];
      for (const deny of rule.deny) {
        if (spec === deny || spec.startsWith(`${deny}/`)) {
          console.error(
            `BOUNDARY: ${relative(root, file)} imports ${spec} (denied in ${rule.zone})`,
          );
          violations++;
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} domain boundary violation(s).`);
  process.exit(1);
}
console.log("Domain boundaries OK.");
