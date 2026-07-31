import fs from "node:fs";

const p = "dist/public/assets";
const idx = fs
  .readdirSync(p)
  .find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"));
const code = fs.readFileSync(`${p}/${idx}`, "utf8");

for (const name of ["vendor-charts", "vendor-motion"]) {
  const re = new RegExp(`from"\\./${name}[^"]*"`, "g");
  const staticImports = [...code.matchAll(re)].map((m) => m[0]);
  const dynRe = new RegExp(`import\\("\\./${name}[^"]*"\\)`, "g");
  const dynImports = [...code.matchAll(dynRe)].map((m) => m[0]);
  console.log(name, { staticImports, dynImports: dynImports.slice(0, 5), countDyn: dynImports.length });
  const i = code.indexOf(name);
  console.log("first context", code.slice(i - 60, i + 80).replace(/\n/g, " "));
}

// Check HTML preloads
const html = fs.readFileSync("dist/public/index.html", "utf8");
console.log(
  "preloads",
  [...html.matchAll(/modulepreload[^>]+href="([^"]+)"/g)].map((m) => m[1]),
);
