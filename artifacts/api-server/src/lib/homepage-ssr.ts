import path from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";
import type { DehydratedState } from "@tanstack/react-query";
import { getPageMeta } from "./page-meta.js";
import { existsSync } from "node:fs";
import {
  getSpaIndexHtml,
  getSpaIndexShellPath,
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
  clients: HomepagePageData["clients"];
  branding: Record<string, unknown>;
  generatedAt: string;
};

type RenderHomePageFn = (initialData: HomeInitialDataWire) => {
  appHtml: string;
  dehydratedState: DehydratedState;
  initialData: HomeInitialDataWire;
};

let renderHomePageFn: RenderHomePageFn | null | undefined;

export function getCandidateSsrBundlePaths(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [];

  if (process.env.SSR_BUNDLE_PATH?.trim()) {
    candidates.push(path.resolve(process.env.SSR_BUNDLE_PATH.trim()));
  }

  const spaShell = getSpaIndexShellPath();
  if (spaShell) {
    candidates.push(path.resolve(path.dirname(spaShell), "../server/entry-server.js"));
  }

  // Two levels up from dist/ in bundled server (artifacts/api-server/dist -> artifacts/auction-platform)
  candidates.push(path.resolve(here, "../../auction-platform/dist/server/entry-server.js"));

  // Four levels up when executing unbundled from src/lib (artifacts/api-server/src/lib -> artifacts/auction-platform)
  candidates.push(path.resolve(here, "../../../../auction-platform/dist/server/entry-server.js"));

  // From process.cwd() (workspace root)
  candidates.push(path.resolve(process.cwd(), "artifacts/auction-platform/dist/server/entry-server.js"));

  // From process.cwd() when cwd is artifacts/api-server
  candidates.push(path.resolve(process.cwd(), "../auction-platform/dist/server/entry-server.js"));

  return [...new Set(candidates)];
}

export function resolveSsrBundlePath(): string {
  const candidates = getCandidateSsrBundlePaths();
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0] ?? path.resolve(process.cwd(), "artifacts/auction-platform/dist/server/entry-server.js");
}

function ssrBundlePath(): string {
  return resolveSsrBundlePath();
}

export async function loadRenderHomePage(): Promise<RenderHomePageFn | null> {
  if (renderHomePageFn !== undefined) {
    return renderHomePageFn;
  }

  const resolvedPath = resolveSsrBundlePath();
  if (!existsSync(resolvedPath)) {
    logger.warn(
      {
        resolvedPath,
        candidates: getCandidateSsrBundlePaths(),
        cwd: process.cwd(),
      },
      "Homepage SSR bundle does not exist on disk",
    );
    return null;
  }

  try {
    const fileUrl = pathToFileURL(resolvedPath).href;
    const mod = (await import(fileUrl)) as {
      renderHomePage?: RenderHomePageFn;
    };
    if (typeof mod.renderHomePage !== "function") {
      logger.warn(
        { path: resolvedPath, exports: Object.keys(mod) },
        "Homepage SSR bundle missing renderHomePage function export",
      );
      return null;
    }
    renderHomePageFn = mod.renderHomePage;
    logger.info({ path: resolvedPath }, "Homepage SSR renderer successfully loaded");
    return renderHomePageFn;
  } catch (err) {
    const errorDetails = err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) };
    logger.warn(
      { err: errorDetails, path: resolvedPath, cwd: process.cwd() },
      "Homepage SSR bundle failed to load via dynamic import",
    );
    return null;
  }
}

function toHomeInitialData(page: HomepagePageData): HomeInitialDataWire {
  return {
    auctions: page.auctions,
    showcaseEvents: page.showcaseEvents,
    clients: page.clients,
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

    res.setHeader("X-BidWar-SSR", "rendered");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
    return true;
  } catch (err) {
    const errorDetails = err instanceof Error
      ? { message: err.message, stack: err.stack, phase }
      : { message: String(err), phase };
    logHomepageSsrFailure({
      cacheHit,
      phase,
      totalMs: Math.round(performance.now() - started),
      err: errorDetails,
    });
    res.setHeader("X-BidWar-SSR", `fallback; phase=${phase}`);
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
