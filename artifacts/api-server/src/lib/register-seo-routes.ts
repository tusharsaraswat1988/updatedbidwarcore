import type { Express, Request, Response } from "express";
import { logger } from "./logger.js";
import {
  buildRobotsTxt,
  buildSitemapAcademy,
  buildSitemapBlog,
  buildSitemapImages,
  buildSitemapIndex,
  buildSitemapPages,
  buildSitemapTaxonomy,
} from "./seo-route-policy.js";

/** Paths served as crawl assets — must bypass HTML meta injection. */
export const SEO_ASSET_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemap-pages.xml",
  "/sitemap-academy.xml",
  "/sitemap-blog.xml",
  "/sitemap-taxonomy.xml",
  "/sitemap-images.xml",
]);

export function isSeoAssetPath(pathname: string): boolean {
  return SEO_ASSET_PATHS.has(pathname);
}

function sendSitemapXml(res: Response, body: string) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Match robots.txt — crawlers must always receive the latest sitemap.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.send(body);
}

function sendSitemapOrError(
  res: Response,
  label: string,
  build: () => string | Promise<string>,
) {
  try {
    Promise.resolve(build())
      .then((body) => sendSitemapXml(res, body))
      .catch((err) => {
        logger.error({ err, label }, "Failed to generate sitemap");
        res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send("Sitemap temporarily unavailable");
      });
  } catch (err) {
    logger.error({ err, label }, "Failed to generate sitemap");
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send("Sitemap temporarily unavailable");
  }
}

/**
 * Register robots.txt and all sitemap endpoints.
 * Called unconditionally so crawlers can discover URLs even when
 * SERVE_STATIC=false (API-only deployments behind a CDN).
 */
export function registerSeoRoutes(app: Express): void {
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.send(buildRobotsTxt());
  });

  app.get("/sitemap-index.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-index", buildSitemapIndex),
  );
  app.get("/sitemap-pages.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-pages", buildSitemapPages),
  );
  app.get("/sitemap-academy.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-academy", buildSitemapAcademy),
  );
  app.get("/sitemap-blog.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-blog", buildSitemapBlog),
  );
  app.get("/sitemap-taxonomy.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-taxonomy", buildSitemapTaxonomy),
  );
  app.get("/sitemap-images.xml", (_req, res) =>
    sendSitemapOrError(res, "sitemap-images", buildSitemapImages),
  );
  // Legacy URL — permanent redirect so old Search Console submissions still resolve.
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.redirect(301, "/sitemap-index.xml");
  });
}
