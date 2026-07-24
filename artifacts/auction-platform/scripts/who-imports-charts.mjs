import fs from "node:fs";

const p = "dist/public/assets";
for (const f of fs.readdirSync(p)) {
  if (!f.endsWith(".js") || f.includes(".gz") || f.includes(".br")) continue;
  if (!f.startsWith("index-") && !f.startsWith("public-navbar") && !f.startsWith("landing") && !f.startsWith("brand")) continue;
  const c = fs.readFileSync(`${p}/${f}`, "utf8");
  if (c.includes("vendor-charts") || c.includes("recharts")) {
    console.log(f, "references charts");
    const i = c.indexOf("vendor-charts");
    if (i >= 0) console.log(" ", c.slice(i - 40, i + 50).replace(/\n/g, " "));
  }
}
