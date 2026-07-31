import fs from "node:fs";

const p = "dist/public/assets";
const land = fs
  .readdirSync(p)
  .find((f) => f.startsWith("landing-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"));
const c = fs.readFileSync(`${p}/${land}`, "utf8");
const i = c.indexOf("academy-shared");
console.log("landing file", land);
console.log("context:\n", c.slice(Math.max(0, i - 120), i + 120));
const dyn = [...c.matchAll(/import\("\.\/([^"]+)"\)/g)].map((m) => m[1]);
console.log("landing dyn imports", dyn);
