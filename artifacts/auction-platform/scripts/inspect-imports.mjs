import fs from "node:fs";

const p = "dist/public/assets";
const idx = fs
  .readdirSync(p)
  .find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"));
const land = fs
  .readdirSync(p)
  .find((f) => f.startsWith("landing-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"));
const code = fs.readFileSync(`${p}/${idx}`, "utf8");
const lcode = fs.readFileSync(`${p}/${land}`, "utf8");
console.log("index", idx, "bytes", code.length);
console.log("landing", land);
for (const name of ["academy-shared", "vendor-charts", "vendor-motion", "academy-search"]) {
  console.log("index has", name, code.includes(name));
  console.log("landing has", name, lcode.includes(name));
}
const dyn = [...code.matchAll(/import\("\.\/([^"]+)"\)/g)].map((m) => m[1]);
console.log(
  "interesting dyn",
  dyn.filter(
    (d) =>
      d.includes("academy") ||
      d.includes("chart") ||
      d.includes("motion") ||
      d.includes("landing") ||
      d.includes("report"),
  ),
);
