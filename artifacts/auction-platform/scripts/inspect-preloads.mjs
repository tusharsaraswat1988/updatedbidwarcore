import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "dist/public");
const html = readFileSync(join(root, "index.html"), "utf8");
const preloads = [...html.matchAll(/href="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
console.log(
  "vendor/academy preloads:",
  preloads.filter((p) => p.includes("vendor") || p.includes("academy")),
);

const idx = readdirSync(join(root, "assets")).find(
  (f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"),
);
const code = readFileSync(join(root, "assets", idx), "utf8");
for (const name of ["vendor-charts", "vendor-motion", "academy-shared", "academy-search", "recharts", "framer"]) {
  console.log(name, code.includes(name));
}
