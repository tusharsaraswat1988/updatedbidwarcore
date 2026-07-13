import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import http from "http";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });

const requireDb = createRequire(resolve(root, "lib/db/package.json"));
const requireApi = createRequire(resolve(root, "artifacts/api-server/package.json"));
const { Pool } = requireDb("pg");
const jwt = requireApi("jsonwebtoken");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const orgs = await pool.query(`SELECT id, name FROM organizers ORDER BY id LIMIT 3`);
console.log("organizers", orgs.rows);
await pool.end();

const secret = process.env.SESSION_SECRET?.trim();
if (!secret || !orgs.rows[0]) {
  console.error("missing secret or organizer");
  process.exit(1);
}

const organizerId = orgs.rows[0].id;
const token = jwt.sign({ organizerAccountId: organizerId, organizer: {} }, secret, {
  expiresIn: "1h",
});

function get(path) {
  return new Promise((resolveP, reject) => {
    http
      .get(
        {
          hostname: "localhost",
          port: 8080,
          path,
          headers: { Cookie: `bidwar_auth=${token}` },
        },
        (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () =>
            resolveP({
              status: res.statusCode,
              body: d.slice(0, 600),
              ct: res.headers["content-type"],
            }),
          );
        },
      )
      .on("error", reject);
  });
}

const me = await get("/api/auth/me");
const ome = await get("/api/auth/organizer-account/me");
console.log("auth/me", me.status, me.body);
console.log("organizer-account/me", ome.status, ome.ct, ome.body);
if (ome.status !== 200 || !String(ome.ct || "").includes("json")) {
  console.error("FAIL organizer-account/me");
  process.exit(1);
}
const parsed = JSON.parse(ome.body);
if (!parsed.loggedIn) {
  console.error("FAIL not loggedIn", parsed);
  process.exit(1);
}
console.log("Phase 1 auth verification passed");
