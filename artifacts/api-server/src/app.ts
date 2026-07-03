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
import { getPageMeta } from "./lib/page-meta.js";
import { isCricketPublicPath, resolveCricketPageMeta } from "./lib/cricket-page-meta.js";
import {
  isRegistrationPublicPath,
  resolveRegistrationPageMeta,
} from "./lib/registration-page-meta.js";
import {
  loadIndexHtml,
  injectPageMeta,
  sendInjectedHtml,
} from "./lib/html-meta-injector.js";
import {
  classifyRoute,
  expectsPublicMeta,
  getNotFoundPageMeta,
  getPrivatePageMeta,
} from "./lib/seo-route-policy.js";
import { isSeoAssetPath, registerSeoRoutes } from "./lib/register-seo-routes.js";
import { registerOgImageRoutes } from "./routes/og-images.js";
import { trySendHomepageSsr } from "./lib/homepage-ssr.js";
import { registerBrandingIconRoutes } from "./lib/branding-asset-resolver.js";
import {
  buildAdminAppManifest,
  buildAuctionPlatformManifest,
  buildOwnerAppManifest,
} from "./lib/branding-manifest.js";

const app: Express = express();

const { isProduction: isProd, serveStatic } = getRuntimeConfig();

// Most production setups run behind a reverse proxy.
// This tells Express to trust the X-Forwarded-For header so that
// rate limiting and secure cookies work correctly.
app.set("trust proxy", 1);

// ── Canonical hostname redirect (opt-in) ───────────────────────────────────
// IMPORTANT:
// Host redirects are often also configured at Cloudflare/Render edge.
// If both edge and app perform opposite redirects (www→non-www at edge, and
// non-www→www in app), a production redirect loop occurs.
//
// Therefore app-level host redirect is disabled by default and can be enabled
// explicitly with ENABLE_APP_HOST_REDIRECT=true once edge rules are aligned.
const CANONICAL_HOST = "bidwar.in";
const NON_CANONICAL_HOST = "bidwar.in";
const ENABLE_APP_HOST_REDIRECT = process.env.ENABLE_APP_HOST_REDIRECT === "true";

if (isProd && ENABLE_APP_HOST_REDIRECT) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const xfh = req.headers["x-forwarded-host"];
    const rawXfh = Array.isArray(xfh) ? xfh[0] : (xfh ?? "");
    const host = (rawXfh.split(",")[0].trim() || req.headers["host"] || "")
      .split(":")[0]
      .toLowerCase()
      .trim();

    if (host === NON_CANONICAL_HOST) {
      return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
    }
    next();
  });
}

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

// ── Crawl assets (robots.txt + sitemaps) — always registered ───────────────
registerSeoRoutes(app, CANONICAL_HOST);

// ── Dynamic branding icons (Google-canonical favicon URLs → DB assets) ────────
registerBrandingIconRoutes(app);

// ── Dynamic PWA manifests (BrandingService → install icons) ───────────────────
app.get("/site.webmanifest", async (_req, res) => {
  try {
    const manifest = await buildAuctionPlatformManifest();
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(manifest);
  } catch (err) {
    logger.error({ err }, "Failed to build auction-platform manifest");
    res.status(500).json({ error: "Manifest unavailable" });
  }
});

app.get("/owner-app/manifest.webmanifest", async (_req, res) => {
  try {
    const manifest = await buildOwnerAppManifest();
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(manifest);
  } catch (err) {
    logger.error({ err }, "Failed to build owner-app manifest");
    res.status(500).json({ error: "Manifest unavailable" });
  }
});

app.get("/admin.webmanifest", async (_req, res) => {
  try {
    const manifest = await buildAdminAppManifest();
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(manifest);
  } catch (err) {
    logger.error({ err }, "Failed to build admin manifest");
    res.status(500).json({ error: "Manifest unavailable" });
  }
});

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
  const scoringDist = path.resolve(__dirname, "../../scoring-app/dist/public");

  assertServeStaticBuild(auctionDist);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staticOpts: any = {
      enableBrotli: true,
      orderPreference: ["br", "gz"],
      serveStatic: {
        setHeaders(res: express.Response, filePath: string) {
          const base = path.basename(filePath).replace(/\.(br|gz)$/, "");
          // Never apply immutable cache to files that are not content-hashed.
          // robots.txt, sitemap.xml, site.webmanifest, and index.html must
          // always be re-fetched so crawlers pick up changes promptly.
          const noCacheFiles = new Set([
            "index.html",
            "robots.txt",
            "sitemap.xml",
            "sitemap-index.xml",
            "sitemap-pages.xml",
            "sitemap-blog.xml",
            "sitemap-taxonomy.xml",
            "sitemap-images.xml",
          ]);
          if (noCacheFiles.has(base) || base.endsWith(".webmanifest")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else {
            // Vite content-hashes every JS/CSS asset — safe to cache forever
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      },
    };

    // Load the built index.html into memory once for meta injection.
    loadIndexHtml(auctionDist);
    logger.info("SEO: page-meta injector loaded");

    registerOgImageRoutes(app);

    // ── Homepage SSR (exact GET / only) — fail-open to SPA shell on error ─────
    app.get("/", async (_req: express.Request, res: express.Response) => {
      await trySendHomepageSsr(res);
    });

    // ── Server-side meta injection for marketing pages ────────────────────────
    // For every known public marketing URL, we replace the PAGE_META_START/END
    // and PAGE_SCHEMA_START/END blocks in index.html with route-specific
    // <title>, <meta>, canonical, OG/Twitter tags, and JSON-LD schemas.
    // This ensures social crawlers and bots that don't run JavaScript see the
    // correct metadata for each page.
    app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== "GET") return next();
      if (req.path === "/") return next();
      if (isSeoAssetPath(req.path)) return next();

      let meta = getPageMeta(req.path);
      if (!meta && isCricketPublicPath(req.path)) {
        try {
          meta = await resolveCricketPageMeta(req.path);
        } catch {
          meta = null;
        }
      }
      if (!meta && isRegistrationPublicPath(req.path)) {
        try {
          meta = await resolveRegistrationPageMeta(req.path);
        } catch {
          meta = null;
        }
      }

      if (!meta && expectsPublicMeta(req.path)) {
        return sendInjectedHtml(res, getNotFoundPageMeta(), 404) || next();
      }

      if (!meta) return next();

      const html = injectPageMeta(meta);
      if (!html) return next();

      res.status(200);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(html);
    });

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

    // Owner app at /owner-app/ — must be registered before the root catch-all
    if (existsSync(ownerDist)) {
      app.use("/owner-app", expressStaticGzip(ownerDist, staticOpts));
      app.use("/owner-app", (_req: express.Request, res: express.Response) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(ownerDist, "index.html"));
      });
      logger.info({ path: ownerDist }, "Static: owner-app at /owner-app");
    }

    // Scoring app at /scoring-app/ — before auction catch-all
    if (existsSync(scoringDist)) {
      app.use("/scoring-app", expressStaticGzip(scoringDist, staticOpts));
      app.use("/scoring-app", (_req: express.Request, res: express.Response) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(scoringDist, "index.html"));
      });
      logger.info({ path: scoringDist }, "Static: scoring-app at /scoring-app");
    }

    // Canonical SPA entry is / — never serve the built index.html at /index.html.
    app.get("/index.html", (req: express.Request, res: express.Response) => {
      const qs = req.url.slice("/index.html".length);
      res.redirect(301, `/${qs}`);
    });

    // Auction platform catch-all — route-aware HTML responses (404 / private / SPA)
    app.use("/", expressStaticGzip(auctionDist, staticOpts));
    app.use((req: express.Request, res: express.Response) => {
      if (req.method !== "GET") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const disposition = classifyRoute(req.path, false);

      if (disposition === "noindex-app") {
        if (sendInjectedHtml(res, getPrivatePageMeta(req.path), 200)) return;
      }

      if (sendInjectedHtml(res, getNotFoundPageMeta(), 404)) return;

      res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send("Not Found");
    });
  logger.info({ path: auctionDist }, "Static: auction-platform at /");
}

export default app;
