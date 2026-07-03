import path from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";
import type { DehydratedState } from "@tanstack/react-query";
import { getPageMeta } from "./page-meta.js";
import {
  getSpaIndexHtml,
  injectPageMeta,
  injectSsrHomepageDocument,
  sendSpaIndexHtml,
} from "./html-meta-injector.js";
import {
  fetchHomepagePageData,
  type HomepagePageData,
} from "./homepage-data.js";
import {
  logHomepageCacheHit,
  logHomepageCacheMiss,
  logHomepageSsrFailure,
  logHomepageSsrSuccess,
  measureJsonBytes,
} from "./homepage-ssr-diagnostics.js";
import { logger } from "./logger.js";

type HomeInitialDataWire = {
  auctions: HomepagePageData["auctions"];
  showcaseEvents: HomepagePageData["showcaseEvents"];
  branding: Record<string, unknown>;
  generatedAt: string;
};

type RenderHomePageFn = (initialData: HomeInitialDataWire) => {
  appHtml: string;
  dehydratedState: DehydratedState;
  initialData: HomeInitialDataWire;
};

let renderHomePageFn: RenderHomePageFn | null | undefined;

function ssrBundlePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Bundled into dist/index.mjs — two levels up reaches artifacts/ (see app.ts).
  return path.resolve(here, "../../auction-platform/dist/server/entry-server.js");
}

async function loadRenderHomePage(): Promise<RenderHomePageFn | null> {
  if (renderHomePageFn !== undefined) return renderHomePageFn;
  try {
    const mod = await import(pathToFileURL(ssrBundlePath()).href) as {
      renderHomePage?: RenderHomePageFn;
    };
    renderHomePageFn = mod.renderHomePage ?? null;
    if (!renderHomePageFn) {
      logger.warn({ path: ssrBundlePath() }, "Homepage SSR bundle missing renderHomePage export");
    }
  } catch (err) {
    logger.warn({ err, path: ssrBundlePath() }, "Homepage SSR bundle failed to load");
    renderHomePageFn = null;
  }
  return renderHomePageFn;
}

function toHomeInitialData(page: HomepagePageData): HomeInitialDataWire {
  return {
    auctions: page.auctions,
    showcaseEvents: page.showcaseEvents,
    branding: page.branding,
    generatedAt: page.generatedAt,
  };
}

export function sendSpaHomepageFallback(res: {
  setHeader: (k: string, v: string) => void;
  send: (body: string) => void;
}): boolean {
  const meta = getPageMeta("/");
  const shell = meta ? injectPageMeta(meta) : getSpaIndexHtml();
  if (!shell) return sendSpaIndexHtml(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(shell);
  return true;
}

export async function trySendHomepageSsr(
  res: { setHeader: (k: string, v: string) => void; send: (body: string) => void },
): Promise<boolean> {
  const started = performance.now();
  let cacheHit = false;
  let phase: "data" | "render" | "compose" = "data";

  try {
    const pageResult = await fetchHomepagePageData();
    cacheHit = pageResult.cacheHit;
    if (cacheHit) logHomepageCacheHit();
    else logHomepageCacheMiss();

    const cacheLoadMs = performance.now() - started;
    phase = "render";
    const renderFn = await loadRenderHomePage();
    if (!renderFn) {
      throw new Error("Homepage SSR renderer unavailable");
    }

    const renderStarted = performance.now();
    const { appHtml, dehydratedState, initialData } = renderFn(toHomeInitialData(pageResult.data));
    const renderMs = performance.now() - renderStarted;

    phase = "compose";
    const meta = getPageMeta("/");
    const shell = meta ? injectPageMeta(meta) : getSpaIndexHtml();
    if (!shell) {
      throw new Error("SPA index shell unavailable");
    }

    const html = injectSsrHomepageDocument(shell, appHtml, initialData, dehydratedState);
    const payloadBytes = measureJsonBytes(initialData);
    const dehydratedBytes = measureJsonBytes(dehydratedState);
    const totalMs = performance.now() - started;

    logHomepageSsrSuccess({
      cacheHit,
      cacheLoadMs: Math.round(cacheLoadMs),
      renderMs: Math.round(renderMs),
      payloadBytes,
      dehydratedBytes,
      htmlBytes: Buffer.byteLength(html, "utf8"),
      totalMs: Math.round(totalMs),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
    return true;
  } catch (err) {
    logHomepageSsrFailure({
      cacheHit,
      phase,
      totalMs: Math.round(performance.now() - started),
      err,
    });
    return sendSpaHomepageFallback(res);
  }
}

/** Test hook: reset or override cached SSR import between tests. */
export function resetHomepageSsrRendererForTests(): void {
  renderHomePageFn = undefined;
}

export function setHomepageSsrRendererForTests(fn: RenderHomePageFn | null | undefined): void {
  renderHomePageFn = fn;
}
