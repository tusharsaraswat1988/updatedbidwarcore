import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createLocalDb } from "@workspace/db-local";
import { createTournamentsRouter } from "./routes/tournaments.js";
import { createTeamsRouter } from "./routes/teams.js";
import { createPlayersRouter } from "./routes/players.js";
import { createCategoriesRouter } from "./routes/categories.js";
import { createAuctionRouter } from "./routes/auction.js";
import { createLocalRouter } from "./routes/local.js";
import { createSyncWorker } from "./sync-worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "3741");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "auction.db");
const CLOUD_BASE_URL = process.env.CLOUD_BASE_URL || "";

async function main() {
  const db = await createLocalDb(DB_PATH);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true, mode: "local" }));

  app.use("/api", createTournamentsRouter(db));
  app.use("/api", createTeamsRouter(db));
  app.use("/api", createPlayersRouter(db));
  app.use("/api", createCategoriesRouter(db));
  app.use("/api", createAuctionRouter(db));
  app.use("/local", createLocalRouter(db, CLOUD_BASE_URL));

  // Serve auction-platform static build
  const frontendDist = path.join(__dirname, "../../frontend-dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BidWar Local server running on port ${PORT}`);
  });

  // Start auto-sync worker
  if (CLOUD_BASE_URL) {
    createSyncWorker(db, CLOUD_BASE_URL);
  }
}

main().catch(console.error);
