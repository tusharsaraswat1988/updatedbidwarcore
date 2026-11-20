import express, { type Express } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import expressStaticGzip from "express-static-gzip";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters";
import { jwtAuthMiddleware } from "./middleware/jwt-auth";
import { organizerAccountStatusMiddleware } from "./middleware/organizer-account-status";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import {
  assertFanPlatformBuild,
  assertServeStaticBuild,
  corsOriginDelegate,
  getRuntimeConfig,
} from "./lib/runtime-env";
import { getPageMeta } from "./lib/page-meta.js";
import { isCricketPublicPath, resolveCricketPageMeta } from "./lib/cricket-page-meta.js";
import { isAcademyPublicPath, resolveAcademyPageMeta } from "./lib/academy-page-meta.js";
import { trySendAcademyPage } from "./lib/academy-ssr.js";
import {
  isRegistrationPublicPath,
  resolveRegistrationPageMeta,
} from "./lib/registration-page-meta.js";
import {
  initSpaIndexShell,
  injectPageMeta,
  isIndexHtmlLoaded,
  sendInjectedHtml,
} from "./lib/html-meta-injector.js";
import {
  classifyRoute,
  expectsPublicMeta,
  getNotFoundPageMeta,
  getPrivatePageMeta,
} from "./lib/seo-route-policy.js";
import { isSeoAssetPath, registerSeoRoutes } from "./lib/register-seo-routes.js";
import {
  isFanRequest,
  getFanOrigin,
  buildFanRobotsTxt,
  buildFanSitemapIndex,
  buildFanSitemapTournaments,
  getFanNotFoundHtml,
  isTournamentExisting,
  handleFanTournamentRequest,
} from "./lib/fan-seo-policy.js";
import { registerOgImageRoutes } from "./routes/og-images.js";
import { trySendHomepageSsr } from "./lib/homepage-ssr.js";
import { registerBrandingIconRoutes } from "./lib/branding-asset-resolver.js";
import {
  buildAdminAppManifest,
  buildAuctionPlatformManifest,
  buildOwnerAppManifest,
  buildScoringAppManifest,
} from "./lib/branding-manifest.js";

const app: Express = express();

const { isProduction: isProd, serveStatic } = getRuntimeConfig();

const auctionDist = path.resolve(__dirname, "../../auction-platform/dist/public");
const auctionIndexSource = path.resolve(__dirname, "../../auction-platform/index.html");

let academyHtmlRoutesRegistered = false;

function registerAcademyHtmlRoutes(target: Express): void {
  if (academyHtmlRoutesRegistered) return;
  if (!isIndexHtmlLoaded()) {
    logger.warn("Academy HTML routes skipped — SPA index shell not loaded");
    return;
  }

  academyHtmlRoutesRegistered = true;

  target.get("/academy", async (_req: express.Request, res: express.Response) => {
    if (await trySendAcademyPage(res, "/academy")) return;
    res.status(500).send("Academy page unavailable");
  });

  target.get("/academy/:slug", async (req: express.Request, res: express.Response) => {
    if (await trySendAcademyPage(res, req.path)) return;
    res.status(404).send("Not Found");
  });

  logger.info("Academy HTML routes registered (/academy, /academy/:slug)");
}

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
const NON_CANONICAL_HOST = "www.bidwar.in";
// App-level host redirect 301s www.bidwar.in to bidwar.in
const ENABLE_APP_HOST_REDIRECT = process.env.ENABLE_APP_HOST_REDIRECT !== "false";

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
// flushing them immediately, freezing live badminton / auction displays.
function isSseUrlPath(pathname: string): boolean {
  // Explicit URL exclusions — do not rely on Content-Type alone.
  return (
    pathname.includes("/badminton/stream")
    || pathname.includes("/auction/events")
    || pathname.includes("/scoring/events")
    || pathname.includes("/admin-notifications/events")
    // Mounted badminton router may see path as "/stream" only.
    || pathname === "/stream"
    || pathname.endsWith("/stream")
  );
}

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter(req, res) {
      const rawUrl = req.originalUrl ?? req.url ?? "";
      const pathname = rawUrl.split("?")[0] ?? "";
      if (isSseUrlPath(pathname) || isSseUrlPath(req.path ?? "")) {
        return false;
      }
      // Belt-and-suspenders if a future SSE route misses the URL list.
      const ct = res.getHeader("Content-Type");
      const ctStr = Array.isArray(ct) ? ct.join(";") : String(ct ?? "");
      if (ctStr.includes("text/event-stream")) {
        return false;
      }
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
    origin: corsOriginDelegate,
    credentials: true,
  }),
);

// Images are now stored as Cloudinary URLs (not base64), so JSON payloads
// are small. 1 MB is ample for all API request bodies.
app.use(
  express.json({
    limit: "1mb",
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);

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
app.use(webhooksRouter);

// ── Fan platform host detection & crawl routing ────────────────────────────
// Ensure Fan hostname detection occurs before marketing SEO endpoint registration
// so Fan requests never inherit marketing robots.txt, marketing sitemaps, or marketing SPA shells.
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isFanRequest(req)) {
    return next();
  }

  // Allow API routes to be handled by /api (mounted above)
  if (req.path.startsWith("/api/") || req.path === "/healthz" || req.path === "/api/healthz") {
    return next();
  }

  // Dedicated Fan crawl assets
  if (req.path === "/robots.txt") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return res.send(buildFanRobotsTxt(getFanOrigin(req)));
  }

  if (req.path === "/sitemap-index.xml") {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return res.send(buildFanSitemapIndex(getFanOrigin(req)));
  }

  if (req.path === "/sitemap-tournaments.xml") {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    const xml = await buildFanSitemapTournaments(getFanOrigin(req));
    return res.send(xml);
  }

  if (req.path === "/sitemap.xml") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return res.redirect(301, "/sitemap-index.xml");
  }

  // Marketing sitemaps on fan domain: return 404
  if (
    req.path === "/sitemap-pages.xml" ||
    req.path === "/sitemap-academy.xml" ||
    req.path === "/sitemap-blog.xml" ||
    req.path === "/sitemap-taxonomy.xml" ||
    req.path === "/sitemap-images.xml"
  ) {
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send("Not Found");
  }

  next();
});

// ── Crawl assets (robots.txt + sitemaps) — always registered ───────────────
registerSeoRoutes(app);

// SPA shell for meta/SSR injection — production uses built index only; dev uses Vite source.
initSpaIndexShell({
  distDir: auctionDist,
  sourceIndexPath: auctionIndexSource,
  serveStatic,
});
registerAcademyHtmlRoutes(app);

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

app.get(["/scoring-app/manifest.webmanifest", "/scoring-app/site.webmanifest"], async (_req, res) => {
  try {
    const manifest = await buildScoringAppManifest();
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(manifest);
  } catch (err) {
    logger.error({ err }, "Failed to build scoring-app manifest");
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
  const ownerDist   = path.resolve(__dirname, "../../owner-app/dist/public");
  const scoringDist = path.resolve(__dirname, "../../scoring-app/dist/public");
  const mobileDist  = path.resolve(__dirname, "../../mobile-app/dist/public");
  const fanDist     = path.resolve(__dirname, "../../fan-platform/dist");

  assertServeStaticBuild(auctionDist);
  assertFanPlatformBuild(fanDist);

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
            "sitemap-tournaments.xml",
            "sitemap-pages.xml",
            "sitemap-academy.xml",
            "sitemap-blog.xml",
            "sitemap-taxonomy.xml",
            "sitemap-images.xml",
            "sw.js",
          ]);
          if (noCacheFiles.has(base) || base.endsWith(".webmanifest") || base === "sw.js") {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else {
            // Vite content-hashes every JS/CSS asset — safe to cache forever
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      },
    };

    // ── Dedicated fan platform (served on fan.bidwar.in / fan.* subdomain) ──
    // MUST be registered before marketing homepage SSR, meta-injection, and auction catch-all
    // so fan requests are completely isolated from auction-platform assets and SSR.
    if (existsSync(fanDist)) {
      app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!isFanRequest(req)) {
          return next();
        }

        // Never intercept API routes or health checks
        if (req.path.startsWith("/api/") || req.path === "/healthz" || req.path === "/api/healthz") {
          return next();
        }

        if (req.method !== "GET" && req.method !== "HEAD") {
          return res.status(405).send("Method Not Allowed");
        }

        // Try serving static assets (JS, CSS, images, webmanifest, etc.) from fanDist
        return expressStaticGzip(fanDist, staticOpts)(req, res, async () => {
          // If static file was not found:
          // Missing static assets (e.g. /assets/foo.js, /foo.css, /foo.png) must return 404,
          // NEVER returning index.html which causes MIME-type errors in the browser.
          const ext = path.extname(req.path);
          if (ext && ext !== ".html") {
            res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
            return res.send("Not Found");
          }

          // Root route "/" — always valid tournament discovery/search
          if (req.path === "/" || req.path === "") {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            return res.sendFile(path.join(fanDist, "index.html"));
          }

          // Canonical entry: redirect /index.html to /
          if (req.path === "/index.html") {
            return res.redirect(301, "/");
          }

          // Potential tournament slug: /:slug
          const slug = req.path.replace(/^\/+|\/+$/g, "");

          // Multi-segment non-API paths (e.g. /foo/bar) -> return 404 HTML
          if (slug.includes("/")) {
            res.status(404);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            return res.send(getFanNotFoundHtml({ origin: getFanOrigin(req), slug }));
          }

          // Phase 2: Server-Rendered Tournament Pages & Dynamic Metadata
          return await handleFanTournamentRequest({
            req,
            res,
            fanDist,
            slug,
          });
        });
      });

      logger.info({ path: fanDist }, "Static: fan-platform enabled for fan.bidwar.in / fan.*");
    }

    registerAcademyHtmlRoutes(app);
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
      if (req.method !== "GET" && req.method !== "HEAD") return next();
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
      if (!meta && isAcademyPublicPath(req.path)) {
        try {
          meta = await resolveAcademyPageMeta(req.path);
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

    // Typo redirect: /scoring/app → /scoring-app (auction SPA would otherwise 404)
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      const pathname = req.path || "/";
      if (pathname === "/scoring/app" || pathname.startsWith("/scoring/app/")) {
        const rest = pathname === "/scoring/app" ? "/" : pathname.slice("/scoring/app".length);
        const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        res.redirect(302, `/scoring-app${rest === "/" ? "/" : rest}${qs}`);
        return;
      }
      if (pathname === "/scoring-app/scoring-app" || pathname.startsWith("/scoring-app/scoring-app/")) {
        const rest = pathname === "/scoring-app/scoring-app" ? "/" : pathname.slice("/scoring-app/scoring-app".length);
        const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        res.redirect(301, `/scoring-app${rest === "/" ? "/" : rest}${qs}`);
        return;
      }
      next();
    });

    // Scoring app at /scoring-app/ — before auction catch-all
    if (existsSync(scoringDist)) {
      app.use("/scoring-app", expressStaticGzip(scoringDist, staticOpts));
      app.use("/scoring-app", (_req: express.Request, res: express.Response) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(scoringDist, "index.html"));
      });
      logger.info({ path: scoringDist }, "Static: scoring-app at /scoring-app");
    }

    // Shared mobile app (dual-auth shell) at /mobile/ — before auction catch-all
    if (existsSync(mobileDist)) {
      app.use("/mobile", expressStaticGzip(mobileDist, staticOpts));
      app.use("/mobile", (_req: express.Request, res: express.Response) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(mobileDist, "index.html"));
      });
      logger.info({ path: mobileDist }, "Static: mobile-app at /mobile");
    }

    // Canonical SPA entry is / — never serve the built index.html at /index.html.
    app.get("/index.html", (req: express.Request, res: express.Response) => {
      const qs = req.url.slice("/index.html".length);
      res.redirect(301, `/${qs}`);
    });

    // Auction platform catch-all — route-aware HTML responses (404 / private / SPA)
    app.use("/", expressStaticGzip(auctionDist, staticOpts));
    app.use((req: express.Request, res: express.Response) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
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
