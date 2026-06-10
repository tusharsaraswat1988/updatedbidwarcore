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
import { getPageMeta, getAllBlogUrls } from "./lib/page-meta.js";
import { BLOG_POSTS_META } from "@workspace/blog-data";
import { loadIndexHtml, injectPageMeta } from "./lib/html-meta-injector.js";

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

    // Load the built index.html into memory once for meta injection.
    loadIndexHtml(auctionDist);
    logger.info("SEO: page-meta injector loaded");

    // ── Server-side meta injection for marketing pages ────────────────────────
    // For every known public marketing URL, we replace the PAGE_META_START/END
    // and PAGE_SCHEMA_START/END blocks in index.html with route-specific
    // <title>, <meta>, canonical, OG/Twitter tags, and JSON-LD schemas.
    // This ensures social crawlers and bots that don't run JavaScript see the
    // correct metadata for each page.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== "GET") return next();
      const meta = getPageMeta(req.path);
      if (!meta) return next();

      const html = injectPageMeta(meta);
      if (!html) return next();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(html);
    });

    // ── Dynamic sitemap ───────────────────────────────────────────────────────
    // Dynamically generated XML sitemap that includes marketing pages AND all
    // blog posts, category pages, and author pages from @workspace/blog-data.
    app.get("/sitemap.xml", (_req: express.Request, res: express.Response) => {
      const today = new Date().toISOString().slice(0, 10);

      type SitemapEntry = { loc: string; changefreq: string; priority: string; lastmod?: string };

      const urls: SitemapEntry[] = [
        // ── Core marketing pages
        { loc: "https://www.bidwar.in/",                   changefreq: "weekly",  priority: "1.0", lastmod: today },
        { loc: "https://www.bidwar.in/upcoming-auctions",  changefreq: "daily",   priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/contact",            changefreq: "monthly", priority: "0.7", lastmod: today },
        { loc: "https://www.bidwar.in/legal/terms",        changefreq: "yearly",  priority: "0.3" },
        { loc: "https://www.bidwar.in/legal/privacy",      changefreq: "yearly",  priority: "0.3" },
        { loc: "https://www.bidwar.in/legal/acceptable-use", changefreq: "yearly", priority: "0.3" },
        // ── SEO landing pages
        { loc: "https://www.bidwar.in/cricket-auction-software",    changefreq: "monthly", priority: "0.9", lastmod: today },
        { loc: "https://www.bidwar.in/football-player-auction",     changefreq: "monthly", priority: "0.9", lastmod: today },
        { loc: "https://www.bidwar.in/kabaddi-auction-platform",    changefreq: "monthly", priority: "0.9", lastmod: today },
        { loc: "https://www.bidwar.in/tournament-auction-platform", changefreq: "monthly", priority: "0.9", lastmod: today },
        { loc: "https://www.bidwar.in/basketball-auction-software", changefreq: "monthly", priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/badminton-auction-platform",  changefreq: "monthly", priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/volleyball-player-auction",   changefreq: "monthly", priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/esports-auction-system",      changefreq: "monthly", priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/business-league-auction",     changefreq: "monthly", priority: "0.8", lastmod: today },
        { loc: "https://www.bidwar.in/live-player-bidding",         changefreq: "monthly", priority: "0.8", lastmod: today },
        // ── Blog index
        { loc: "https://www.bidwar.in/blog", changefreq: "weekly", priority: "0.8", lastmod: today },
        // ── Blog posts — use actual publishedAt / updatedAt for accuracy
        ...BLOG_POSTS_META.map((p) => ({
          loc: p.canonical,
          changefreq: "monthly",
          priority: "0.7",
          lastmod: p.updatedAt ?? p.publishedAt,
        })),
        // ── Blog category pages
        ...getAllBlogUrls()
          .filter((u) => u.includes("/blog/category/") || u.includes("/blog/author/"))
          .map((u) => ({ loc: u, changefreq: "weekly" as const, priority: "0.6", lastmod: today })),
      ];

      const urlXml = urls.map((u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`
      ).join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlXml}\n\n</urlset>`;

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
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
