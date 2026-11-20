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
import {
  isFanRequest,
  getFanOrigin,
  buildFanRobotsTxt,
  buildFanSitemapIndex,
  buildFanSitemapTournaments,
} from "./fan-seo-policy.js";

/** Paths served as crawl assets — must bypass HTML meta injection. */
export const SEO_ASSET_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemap-tournaments.xml",
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
 * Host-aware: fan.bidwar.in receives dedicated Fan robots and sitemap index,
 * while bidwar.in receives marketing robots and marketing sitemap index.
 *
 * Called unconditionally so crawlers can discover URLs even when
 * SERVE_STATIC=false (API-only deployments behind a CDN).
 */
export function registerSeoRoutes(app: Express): void {
  app.get("/robots.txt", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    if (isFanRequest(req)) {
      res.send(buildFanRobotsTxt(getFanOrigin(req)));
      return;
    }
    res.send(buildRobotsTxt());
  });

  app.get("/sitemap-index.xml", (req: Request, res: Response) => {
    if (isFanRequest(req)) {
      sendSitemapOrError(res, "fan-sitemap-index", () => buildFanSitemapIndex(getFanOrigin(req)));
      return;
    }
    sendSitemapOrError(res, "sitemap-index", buildSitemapIndex);
  });

  app.get("/sitemap-tournaments.xml", (req: Request, res: Response) => {
    if (isFanRequest(req)) {
      sendSitemapOrError(res, "fan-sitemap-tournaments", () => buildFanSitemapTournaments(getFanOrigin(req)));
      return;
    }
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send("Not Found");
  });

  const handleMarketingSitemap = (
    label: string,
    builder: () => string | Promise<string>,
  ) => (req: Request, res: Response) => {
    if (isFanRequest(req)) {
      res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send("Not Found");
      return;
    }
    sendSitemapOrError(res, label, builder);
  };

  app.get("/sitemap-pages.xml", handleMarketingSitemap("sitemap-pages", buildSitemapPages));
  app.get("/sitemap-academy.xml", handleMarketingSitemap("sitemap-academy", buildSitemapAcademy));
  app.get("/sitemap-blog.xml", handleMarketingSitemap("sitemap-blog", buildSitemapBlog));
  app.get("/sitemap-taxonomy.xml", handleMarketingSitemap("sitemap-taxonomy", buildSitemapTaxonomy));
  app.get("/sitemap-images.xml", handleMarketingSitemap("sitemap-images", buildSitemapImages));

  // Legacy URL — permanent redirect so old Search Console submissions still resolve.
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.redirect(301, "/sitemap-index.xml");
  });
}
