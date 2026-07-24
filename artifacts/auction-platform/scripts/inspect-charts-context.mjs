import fs from "node:fs";

const p = "dist/public/assets";
const idx = fs
  .readdirSync(p)
  .find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes(".gz") && !f.includes(".br"));
const code = fs.readFileSync(`${p}/${idx}`, "utf8");
const i = code.indexOf('from"./vendor-charts');
console.log("index size", code.length);
console.log("charts context", code.slice(Math.max(0, i - 200), i + 100));
const j = code.indexOf('from"./vendor-motion');
console.log("motion context", code.slice(Math.max(0, j - 200), j + 100));
