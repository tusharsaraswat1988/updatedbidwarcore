import fs from "node:fs";

const c = fs.readFileSync("dist/public/assets/academy-shared-CXGfCNrK.js", "utf8");
console.log("has charts", c.includes("vendor-charts") || c.includes("recharts"));
console.log("has motion", c.includes("vendor-motion") || c.includes("framer"));
const froms = [...c.matchAll(/from"\.\/([^"]+)"/g)].map((m) => m[1]);
console.log("imports from", [...new Set(froms)]);
// Guess shared modules by looking for common strings
for (const s of ["clsx", "tailwind-merge", "OptimizedImage", "HomepageMedia", "cloudinary"]) {
  console.log("contains", s, c.includes(s));
}
