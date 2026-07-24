/**
 * Trace which modules from the App entry still pull framer-motion / recharts.
 * Run after a production build isn't required — uses source imports.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const visited = new Set();
const hits = { motion: [], charts: [] };

function resolveImport(fromFile, spec) {
  if (!spec.startsWith("@/") && !spec.startsWith(".")) return null;
  let target = spec.startsWith("@/")
    ? path.join(root, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    path.join(target, "index.ts"),
    path.join(target, "index.tsx"),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

function walk(file, chain) {
  if (visited.has(file)) return;
  visited.add(file);
  let code;
  try {
    code = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (code.includes("from \"framer-motion\"") || code.includes("from 'framer-motion'")) {
    hits.motion.push([...chain, file]);
  }
  if (
    code.includes("from \"recharts\"") ||
    code.includes("from 'recharts'") ||
    code.includes("from \"@/components/ui/chart\"") ||
    code.includes("from '@/components/ui/chart'")
  ) {
    hits.charts.push([...chain, file]);
  }
  // Only follow static imports (not lazy(() => import()))
  const staticImports = [
    ...code.matchAll(/import\s+(?:type\s+)?[^'"]*['"]([^'"]+)['"]/g),
  ]
    .map((m) => m[1])
    .filter((s) => !code.includes(`lazy(() => import("${s}")`) && !code.includes(`lazy(() => import('${s}')`));

  // Also skip dynamic import() strings that aren't lazy-wrapped by checking lines
  for (const spec of staticImports) {
    if (spec.includes("framer-motion") || spec.includes("recharts")) continue;
    const resolved = resolveImport(file, spec);
    if (!resolved) continue;
    if (!resolved.includes(`${path.sep}src${path.sep}`)) continue;
    walk(resolved, [...chain, file]);
  }
}

walk(path.join(root, "App.tsx"), []);
console.log("motion hits", hits.motion.length);
for (const h of hits.motion.slice(0, 10)) {
  console.log("  ", h.map((f) => path.relative(root, f)).join(" -> "));
}
console.log("charts hits", hits.charts.length);
for (const h of hits.charts.slice(0, 10)) {
  console.log("  ", h.map((f) => path.relative(root, f)).join(" -> "));
}
console.log("visited modules", visited.size);
