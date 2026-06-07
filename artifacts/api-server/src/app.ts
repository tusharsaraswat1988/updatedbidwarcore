import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import expressStaticGzip from "express-static-gzip";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters";
import { jwtAuthMiddleware } from "./middleware/jwt-auth";
import { organizerAccountStatusMiddleware } from "./middleware/organizer-account-status";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import {
  assertServeStaticBuild,
  getRuntimeConfig,
  isCorsOriginAllowed,
} from "./lib/runtime-env";

const app: Express = express();

const { isProduction: isProd, serveStatic } = getRuntimeConfig();

// Most production setups run behind a reverse proxy.
// This tells Express to trust the X-Forwarded-For header so that
// rate limiting and secure cookies work correctly.
app.set("trust proxy", 1);

// Gzip compression for all API JSON responses (level 6, skip payloads < 1 KB).
// SSE streams are excluded: gzip buffers internally and holds events instead of
// flushing them immediately, breaking live auction updates.
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter(req, res) {
      // Never compress SSE streams — gzip buffering delays event delivery
      if (res.getHeader("Content-Type") === "text/event-stream") return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

// Images are now stored as Cloudinary URLs (not base64), so JSON payloads
// are small. 1 MB is ample for all API request bodies.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Parse cookies so the JWT middleware can read bidwar_auth / bidwar_oauth
app.use(cookieParser());
// Populate req.jwtUser and req.oauthState from signed JWT cookies
app.use(jwtAuthMiddleware);
app.use(organizerAccountStatusMiddleware);

logger.info("Auth: stateless JWT cookies (bidwar_auth)");

// Global rate limiter — catches spam on all non-auction routes.
// Auction endpoints are automatically skipped inside globalLimiter
// so live bidding (2-3 req/sec) and polling (every 1s) are never throttled.
app.use(globalLimiter);

app.use("/api", router);

// ── Optional single-process static file serving ───────────────────────────────
// Enabled when SERVE_STATIC=true (or automatically in production when not
// explicitly disabled). Serves pre-built Vite frontends from the same Node
// process — no separate nginx or Vite dev server needed in production.
// In local dev Vite's HMR server handles the frontends instead.
if (serveStatic) {
  // __dirname is set by the esbuild banner to the dist/ directory of the bundle.
  // Two levels up from dist/ reaches the artifacts/ root.
  const auctionDist = path.resolve(__dirname, "../../auction-platform/dist/public");
  const ownerDist   = path.resolve(__dirname, "../../owner-app/dist/public");

  assertServeStaticBuild(auctionDist);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staticOpts: any = {
      enableBrotli: true,
      orderPreference: ["br", "gz"],
      serveStatic: {
        setHeaders(res: express.Response, filePath: string) {
          const base = path.basename(filePath).replace(/\.(br|gz)$/, "");
          if (base === "index.html" || base.endsWith(".webmanifest")) {
            // HTML and manifests must not be cached so SW updates propagate
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else {
            // Vite content-hashes every asset filename — safe to cache forever
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      },
    };

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
    app.get("/owner-app/tournament/:tournamentId/owner/:teamId", (req, res) => {
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

    // Owner app at /owner-app/ — must be registered before the root catch-all
    if (existsSync(ownerDist)) {
      app.use("/owner-app", expressStaticGzip(ownerDist, staticOpts));
      app.use("/owner-app", (_req: express.Request, res: express.Response) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(ownerDist, "index.html"));
      });
      logger.info({ path: ownerDist }, "Static: owner-app at /owner-app");
    }

    // Auction platform catch-all at /
    app.use("/", expressStaticGzip(auctionDist, staticOpts));
    app.use((_req: express.Request, res: express.Response) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(auctionDist, "index.html"));
    });
  logger.info({ path: auctionDist }, "Static: auction-platform at /");
}

export default app;
