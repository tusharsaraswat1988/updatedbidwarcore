import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { createLocalDb } from "@workspace/db-local";
import { localJwtAuthMiddleware } from "./middleware/local-jwt-auth.js";
import { createAuthRouter } from "./routes/auth.js";
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
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(localJwtAuthMiddleware);

  app.get("/healthz", (_req, res) => res.json({ ok: true, mode: "local" }));

  app.use("/api", createAuthRouter(db));
  app.use("/api", createTournamentsRouter(db));
  app.use("/api", createTeamsRouter(db));
  app.use("/api", createPlayersRouter(db));
  app.use("/api", createCategoriesRouter(db));
  app.use("/api", createAuctionRouter(db));
  app.use("/local", createLocalRouter(db, CLOUD_BASE_URL));

  const frontendDist = path.join(__dirname, "../frontend-dist");
  const ownerAppDist = path.join(__dirname, "../owner-app-dist");

  // Legacy owner URLs → canonical onboarding entry (full page loads only).
  app.get("/tournament/:tournamentId/owner/:teamId", (req, res) => {
    const tid = parseInt(req.params.tournamentId, 10);
    const teamId = parseInt(req.params.teamId, 10);
    res.redirect(
      302,
      ownerJoinPath(
        Number.isFinite(tid) ? tid : undefined,
        Number.isFinite(teamId) ? teamId : undefined,
      ),
    );
  });

  // Owner app at /owner-app/ — must be registered before the root catch-all.
  if (existsSync(ownerAppDist)) {
    app.use("/owner-app", express.static(ownerAppDist));
    app.use("/owner-app", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(ownerAppDist, "index.html"));
    });
    console.log(`Serving owner-app from ${ownerAppDist}`);
  } else {
    console.warn(`Owner-app dist not found at ${ownerAppDist} — run build:frontend`);
  }

  // Serve auction-platform static build at /
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    console.warn(`Auction-platform dist not found at ${frontendDist} — run build:frontend`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BidWar Local server running on port ${PORT}`);
  });

  // Start auto-sync worker unconditionally so queued mirror entries drain
  // when connectivity returns — even if CLOUD_BASE_URL is not set as an env var.
  // Per-entry payload.url (stored at enqueue time) provides the endpoint without
  // needing a global env-level base URL.
  createSyncWorker(db, CLOUD_BASE_URL);
}

main().catch(console.error);
