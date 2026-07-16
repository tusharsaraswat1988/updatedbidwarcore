import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { API_PREFIX, DEFAULT_API_DEV_PORT, DEFAULT_OWNER_DEV_PORT, DEFAULT_SCORING_DEV_PORT, DEFAULT_MOBILE_DEV_PORT } from "./index";

export type ViteApiProxyOptions = {
  target: string;
  changeOrigin: boolean;
  secure: boolean;
  ws: boolean;
  rewrite?: (path: string) => string;
  selfHandleResponse?: boolean;
  bypass?: (req: IncomingMessage) => false | string | null | undefined | void;
  configure?: (proxy: {
    on(
      event: "proxyRes",
      listener: (
        proxyRes: IncomingMessage,
        req: IncomingMessage,
        res: ServerResponse,
      ) => void,
    ): void;
  }) => void;
};

/**
 * Prefix root-relative Vite dev asset URLs so they route through `/owner-app`
 * proxy instead of being served by auction-platform's own Vite server.
 * Without this, `/src/main.tsx` resolves to the wrong app → blank owner page.
 */
export function rewriteOwnerAppHtmlAssets(html: string): string {
  const prefix = (path: string) =>
    path.startsWith("/owner-app/") || path === "/owner-app" ? path : `/owner-app${path}`;

  return html
    .replace(/(\s(?:src|href)=["'])(\/(?!owner-app\/)(?:@|src\/|node_modules\/\.vite\/|pwa-icon|manifest\.webmanifest|registerSW\.js)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`)
    .replace(/(from\s+["'])(\/(?!owner-app\/)(?:@|src\/|node_modules\/\.vite\/)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`);
}

/** Same as owner-app rewrite but for `/scoring-app` dev proxy. */
export function rewriteScoringAppHtmlAssets(html: string): string {
  const prefix = (path: string) =>
    path.startsWith("/scoring-app/") || path === "/scoring-app"
      ? path
      : `/scoring-app${path}`;

  return html
    .replace(
      /(\s(?:src|href)=["'])(\.\/?(?:src\/|@)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => {
        const normalized = path.startsWith("./") ? path.slice(1) : path.startsWith(".") ? `/${path.slice(1)}` : path;
        return `${lead}${prefix(normalized.startsWith("/") ? normalized : `/${normalized}`)}${tail}`;
      },
    )
    .replace(
      /(\s(?:src|href)=["'])(\/(?!scoring-app\/)(?:@|src\/|node_modules\/\.vite\/)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`,
    )
    .replace(
      /(from\s+["'])(\/(?!scoring-app\/)(?:@|src\/|node_modules\/\.vite\/)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`,
    );
}

function copyProxyHeaders(
  proxyRes: IncomingMessage,
  res: ServerResponse,
  skip: Set<string> = new Set(["content-length", "content-encoding"]),
): void {
  for (const [key, value] of Object.entries(proxyRes.headers)) {
    if (value === undefined || skip.has(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
}

/**
 * Target for Vite dev proxy (API server). Set API_DEV_PROXY_TARGET in .env, e.g.
 * http://127.0.0.1:8080
 */
export function getDevApiProxyTarget(): string {
  const raw =
    process.env.API_DEV_PROXY_TARGET?.trim() ||
    process.env.VITE_DEV_API_TARGET?.trim();
  if (raw) return raw.replace(/\/+$/, "");

  const port = process.env.API_PORT?.trim() || String(DEFAULT_API_DEV_PORT);
  return `http://127.0.0.1:${port}`;
}

/**
 * Target for owner-app Vite dev server. Set OWNER_APP_DEV_PROXY_TARGET in .env, e.g.
 * http://127.0.0.1:5174
 */
export function getDevOwnerAppProxyTarget(): string {
  const raw =
    process.env.OWNER_APP_DEV_PROXY_TARGET?.trim() ||
    process.env.VITE_DEV_OWNER_APP_TARGET?.trim();
  if (raw) return raw.replace(/\/+$/, "");

  const port =
    process.env.OWNER_APP_PORT?.trim() || String(DEFAULT_OWNER_DEV_PORT);
  return `http://127.0.0.1:${port}`;
}

/** Target for scoring-app Vite dev server. */
export function getDevScoringAppProxyTarget(): string {
  const raw =
    process.env.SCORING_APP_DEV_PROXY_TARGET?.trim() ||
    process.env.VITE_DEV_SCORING_APP_TARGET?.trim();
  if (raw) return raw.replace(/\/+$/, "");

  const port =
    process.env.SCORING_APP_PORT?.trim() || String(DEFAULT_SCORING_DEV_PORT);
  return `http://127.0.0.1:${port}`;
}

/** Target for mobile-app Vite dev server. */
export function getDevMobileAppProxyTarget(): string {
  const raw =
    process.env.MOBILE_APP_DEV_PROXY_TARGET?.trim() ||
    process.env.VITE_DEV_MOBILE_APP_TARGET?.trim();
  if (raw) return raw.replace(/\/+$/, "");

  const port =
    process.env.MOBILE_APP_PORT?.trim() || String(DEFAULT_MOBILE_DEV_PORT);
  return `http://127.0.0.1:${port}`;
}

/**
 * Vite server.proxy config: forwards `/api` (REST, SSE, uploads, OAuth) to the API server.
 */
export function createViteApiProxy(): Record<string, ViteApiProxyOptions> {
  const target = getDevApiProxyTarget();
  const manifestProxy: ViteApiProxyOptions = {
    target,
    changeOrigin: true,
    secure: false,
    ws: false,
  };
  const brandingIconProxy: ViteApiProxyOptions = manifestProxy;
  return {
    "/site.webmanifest": manifestProxy,
    "/admin.webmanifest": manifestProxy,
    "/owner-app/manifest.webmanifest": manifestProxy,
    "/favicon.ico": brandingIconProxy,
    "/favicon.svg": brandingIconProxy,
    "/favicon-32.png": brandingIconProxy,
    "/favicon-32x32.png": brandingIconProxy,
    "/apple-touch-icon.png": brandingIconProxy,
    "/pwa-icon-192.png": brandingIconProxy,
    "/pwa-icon-512.png": brandingIconProxy,
    "/bidwar-primary-logo.png": brandingIconProxy,
    "/bidwar-reverse-logo.png": brandingIconProxy,
    [API_PREFIX]: {
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
      configure: (proxy) => {
        proxy.on("error", (err, _req, res) => {
          // SSE / long-poll connections reset when the API restarts — avoid crashing Vite.
          if (res && !res.headersSent && typeof res.writeHead === "function") {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("API unavailable — retry after dev server restarts.");
          }
        });
      },
    },
  };
}

/**
 * Vite server.proxy config: forwards `/owner-app/*` to the owner-app dev server.
 * Path is kept as-is — owner-app Vite uses `base: "/owner-app/"` and expects `/owner-app/...` URLs.
 */
function ownerAppProxyUnavailableHtml(target: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Owner app unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { max-width: 32rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { color: #a1a1aa; line-height: 1.6; margin: 0 0 1rem; }
    code { color: #fbbf24; }
  </style>
</head>
<body>
  <main>
    <h1>Owner app is not running</h1>
    <p>
      This page is proxied to the owner-app dev server at
      <code>${target}</code>, but nothing is listening there.
    </p>
    <p>
      From the repo root, run <code>pnpm dev</code> or
      <code>pnpm dev:restart</code> to start API, auction-platform, and owner-app together.
    </p>
  </main>
</body>
</html>`;
}

export function createViteOwnerAppProxy(): Record<string, ViteApiProxyOptions> {
  const target = getDevOwnerAppProxyTarget();
  return {
    "/owner-app": {
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
      selfHandleResponse: true,
      bypass(req) {
        const pathname = (req.url ?? "/").split("?")[0] ?? "/";
        // Manifest is served by the API (dynamic branding). Do not SPA-fallback via owner-app Vite.
        if (pathname === OWNER_APP_MANIFEST_PATH) return false;
      },
      configure: (proxy) => {
        proxy.on("error", (err, _req, res) => {
          if (res && !res.headersSent && typeof res.writeHead === "function") {
            const body = ownerAppProxyUnavailableHtml(target);
            res.writeHead(502, {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Length": String(Buffer.byteLength(body)),
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
          console.error("[owner-app proxy]", err);
        });
        proxy.on("proxyRes", (proxyRes, _req, res) => {
          res.setHeader(
            "Set-Cookie",
            `${OWNER_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );

          const contentType = proxyRes.headers["content-type"] ?? "";
          const isHtml = contentType.includes("text/html");

          if (!isHtml) {
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            proxyRes.pipe(res);
            return;
          }

          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            let html = Buffer.concat(chunks).toString("utf8");
            html = rewriteOwnerAppHtmlAssets(html);

            const body = Buffer.from(html, "utf8");
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            res.setHeader("content-type", contentType);
            res.setHeader("content-length", String(body.length));
            res.end(body);
          });
        });
      },
    },
  };
}

/** Vite proxy: forwards `/scoring-app/*` to the scoring-app dev server. */
export function createViteScoringAppProxy(): Record<string, ViteApiProxyOptions> {
  const target = getDevScoringAppProxyTarget();
  return {
    "/scoring-app": {
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
      selfHandleResponse: true,
      configure: (proxy) => {
        proxy.on("error", (err, _req, res) => {
          if (res && !res.headersSent && typeof res.writeHead === "function") {
            const body = scoringAppProxyUnavailableHtml(target);
            res.writeHead(502, {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Length": String(Buffer.byteLength(body)),
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
          console.error("[scoring-app proxy]", err);
        });
        proxy.on("proxyRes", (proxyRes, _req, res) => {
          res.setHeader(
            "Set-Cookie",
            `${SCORING_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );

          const contentType = proxyRes.headers["content-type"] ?? "";
          const isHtml = contentType.includes("text/html");

          if (!isHtml) {
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            proxyRes.pipe(res);
            return;
          }

          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            let html = Buffer.concat(chunks).toString("utf8");
            html = rewriteScoringAppHtmlAssets(html);

            const body = Buffer.from(html, "utf8");
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            res.setHeader("content-type", contentType);
            res.setHeader("content-length", String(body.length));
            res.end(body);
          });
        });
      },
    },
  };
}

function scoringAppProxyUnavailableHtml(target: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scoring app unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { max-width: 32rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { color: #a1a1aa; line-height: 1.6; margin: 0 0 1rem; }
    code { color: #fbbf24; }
  </style>
</head>
<body>
  <main>
    <h1>Scoring app is not running</h1>
    <p>
      This page is proxied to the scoring-app dev server at
      <code>${target}</code>, but nothing is listening there.
    </p>
    <p>
      From the repo root, run <code>pnpm dev</code> or
      <code>pnpm dev:restart</code> to start API, auction-platform, owner-app, and scoring-app together.
    </p>
  </main>
</body>
</html>`;
}


/** Same as owner-app rewrite but for `/mobile` dev proxy. */
export function rewriteMobileAppHtmlAssets(html: string): string {
  const prefix = (path: string) =>
    path.startsWith("/mobile/") || path === "/mobile" ? path : `/mobile${path}`;

  return html
    .replace(
      /(\s(?:src|href)=["'])(\.\/?(?:src\/|@)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => {
        const normalized = path.startsWith("./") ? path.slice(1) : path.startsWith(".") ? `/${path.slice(1)}` : path;
        return `${lead}${prefix(normalized.startsWith("/") ? normalized : `/${normalized}`)}${tail}`;
      },
    )
    .replace(
      /(\s(?:src|href)=["'])(\/(?!mobile\/)(?:@|src\/|node_modules\/\.vite\/)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`,
    )
    .replace(
      /(from\s+["'])(\/(?!mobile\/)(?:@|src\/|node_modules\/\.vite\/)[^"']*)(["'])/g,
      (_m, lead: string, path: string, tail: string) => `${lead}${prefix(path)}${tail}`,
    );
}

/** Vite proxy: forwards `/mobile/*` to the mobile-app dev server. */
export function createViteMobileAppProxy(): Record<string, ViteApiProxyOptions> {
  const target = getDevMobileAppProxyTarget();
  return {
    "/mobile": {
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
      selfHandleResponse: true,
      configure: (proxy) => {
        proxy.on("error", (err, _req, res) => {
          if (res && !res.headersSent && typeof res.writeHead === "function") {
            const body = mobileAppProxyUnavailableHtml(target);
            res.writeHead(502, {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Length": String(Buffer.byteLength(body)),
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
          console.error("[mobile-app proxy]", err);
        });
        proxy.on("proxyRes", (proxyRes, _req, res) => {
          res.setHeader(
            "Set-Cookie",
            `${MOBILE_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );

          const contentType = proxyRes.headers["content-type"] ?? "";
          const isHtml = contentType.includes("text/html");

          if (!isHtml) {
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            proxyRes.pipe(res);
            return;
          }

          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            let html = Buffer.concat(chunks).toString("utf8");
            html = rewriteMobileAppHtmlAssets(html);

            const body = Buffer.from(html, "utf8");
            res.statusCode = proxyRes.statusCode ?? 200;
            copyProxyHeaders(proxyRes, res);
            res.setHeader("content-type", contentType);
            res.setHeader("content-length", String(body.length));
            res.end(body);
          });
        });
      },
    },
  };
}

function mobileAppProxyUnavailableHtml(target: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mobile app unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { max-width: 32rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { color: #a1a1aa; line-height: 1.6; margin: 0 0 1rem; }
    code { color: #fbbf24; }
  </style>
</head>
<body>
  <main>
    <h1>Mobile app is not running</h1>
    <p>
      This page is proxied to the mobile-app dev server at
      <code>${target}</code>, but nothing is listening there.
    </p>
    <p>
      From the repo root, run <code>pnpm dev</code> or
      <code>pnpm dev:restart</code> to start the full stack including mobile-app.
    </p>
  </main>
</body>
</html>`;
}

/** Combined dev proxies for apps that host owner-app behind the same origin. */
export function createViteDevProxies(): Record<string, ViteApiProxyOptions> {
  const target = getDevApiProxyTarget();
  const apiProxy: ViteApiProxyOptions = {
    target,
    changeOrigin: true,
    secure: false,
    ws: false,
  };

  return {
    ...createViteApiProxy(),
    ...createViteOwnerAppProxy(),
    ...createViteScoringAppProxy(),
    ...createViteMobileAppProxy(),
    "/robots.txt": apiProxy,
    "/sitemap.xml": apiProxy,
    "/sitemap-index.xml": apiProxy,
    "/sitemap-pages.xml": apiProxy,
    "/sitemap-academy.xml": apiProxy,
    "/sitemap-blog.xml": apiProxy,
    "/sitemap-taxonomy.xml": apiProxy,
    "/sitemap-images.xml": apiProxy,
    "/academy": apiProxy,
  };
}

const OWNER_APP_DEV_COOKIE = "bidwar-dev-app=owner";
const SCORING_APP_DEV_COOKIE = "bidwar-dev-app=scoring";
const MOBILE_APP_DEV_COOKIE = "bidwar-dev-app=mobile";
const OWNER_APP_MANIFEST_PATH = "/owner-app/manifest.webmanifest";

/** Shared Vite dev paths that collide with auction-platform. */
function isOwnerAppSharedAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/src/") ||
    pathname.startsWith("/@vite/") ||
    pathname.startsWith("/@fs/") ||
    pathname.startsWith("/@id/") ||
    pathname.includes("/@react-refresh") ||
    pathname.startsWith("/@vite-plugin-pwa/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/registerSW.js" ||
    pathname.startsWith("/pwa-icon") ||
    pathname.startsWith("/node_modules/.vite/deps/") ||
    pathname.startsWith("/node_modules/vite/dist/client")
  );
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
}

function isOwnerAppDevContext(
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (referer.includes("/owner-app")) return true;
  return parseCookies(cookieHeader)["bidwar-dev-app"] === "owner";
}

function shouldProxyOwnerAppAsset(
  pathname: string,
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (pathname.startsWith("/owner-app") || pathname.startsWith("/scoring-app") || pathname.startsWith("/mobile")) {
    return false;
  }
  if (isScoringAppDevContext(referer, cookieHeader) || isMobileAppDevContext(referer, cookieHeader)) return false;
  if (!isOwnerAppDevContext(referer, cookieHeader)) return false;
  return isOwnerAppSharedAssetPath(pathname);
}

function isScoringAppDevContext(
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (referer.includes("/scoring-app")) return true;
  return parseCookies(cookieHeader)["bidwar-dev-app"] === "scoring";
}

function shouldProxyScoringAppAsset(
  pathname: string,
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (pathname.startsWith("/scoring-app") || pathname.startsWith("/owner-app") || pathname.startsWith("/mobile")) {
    return false;
  }
  if (isOwnerAppDevContext(referer, cookieHeader) || isMobileAppDevContext(referer, cookieHeader)) {
    return false;
  }
  if (!isScoringAppDevContext(referer, cookieHeader)) return false;
  return isOwnerAppSharedAssetPath(pathname);
}

function isMobileAppDevContext(
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (referer.includes("/mobile")) return true;
  return parseCookies(cookieHeader)["bidwar-dev-app"] === "mobile";
}

function shouldProxyMobileAppAsset(
  pathname: string,
  referer: string,
  cookieHeader: string | undefined,
): boolean {
  if (
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/owner-app") ||
    pathname.startsWith("/scoring-app")
  ) {
    return false;
  }
  if (isOwnerAppDevContext(referer, cookieHeader) || isScoringAppDevContext(referer, cookieHeader)) {
    return false;
  }
  if (!isMobileAppDevContext(referer, cookieHeader)) return false;
  return isOwnerAppSharedAssetPath(pathname);
}

function isAuctionHtmlNavigation(
  pathname: string,
  accept: string | undefined,
): boolean {
  if (
    pathname.startsWith("/owner-app") ||
    pathname.startsWith("/scoring-app") ||
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/api")
  ) {
    return false;
  }
  if (!accept?.includes("text/html")) return false;
  return !pathname.includes(".");
}

function forwardHttp(
  req: IncomingMessage,
  res: ServerResponse,
  target: URL,
  next: (err?: unknown) => void,
  basePrefix?: string,
): void {
  const raw = req.url ?? "/";
  const pathname = raw.split("?")[0] ?? "/";
  const qs = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  let path = raw;
  if (basePrefix) {
    path =
      pathname.startsWith(`${basePrefix}/`) || pathname === basePrefix
        ? `${pathname}${qs}`
        : `${basePrefix}${pathname.startsWith("/") ? pathname : `/${pathname}`}${qs}`;
  }

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => next(err));
  req.pipe(proxyReq);
}

/**
 * Proxies owner-app Vite dev assets that are requested from root paths
 * (e.g. `/@vite/client`, `/src/main.tsx`) when the page was loaded via `/owner-app/`.
 */
export function ownerAppDevProxyPlugin(): Plugin {
  const target = new URL(getDevOwnerAppProxyTarget());

  return {
    name: "bidwar-owner-app-asset-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";

        if (pathname.startsWith("/owner-app")) {
          res.setHeader(
            "Set-Cookie",
            `${OWNER_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );
        } else if (pathname.startsWith("/scoring-app")) {
          res.setHeader(
            "Set-Cookie",
            `${SCORING_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );
        } else if (pathname.startsWith("/mobile")) {
          res.setHeader(
            "Set-Cookie",
            `${MOBILE_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );
        } else if (isAuctionHtmlNavigation(pathname, req.headers.accept)) {
          res.setHeader(
            "Set-Cookie",
            "bidwar-dev-app=; Path=/; Max-Age=0; SameSite=Lax",
          );
        }

        next();
      });

      // Owner-app PWA manifest must hit the API, not the owner-app Vite dev server (which SPA-fallbacks to HTML).
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";
        if (pathname !== OWNER_APP_MANIFEST_PATH) {
          next();
          return;
        }
        forwardHttp(req, res, new URL(getDevApiProxyTarget()), next);
      });

      // /academy/:slug is not matched by the "/academy" Vite proxy prefix alone.
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";
        if (!/^\/academy\/[a-z0-9-]+$/.test(pathname)) {
          next();
          return;
        }
        forwardHttp(req, res, new URL(getDevApiProxyTarget()), next);
      });

      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";
        const referer = req.headers.referer ?? "";

        if (
          !shouldProxyOwnerAppAsset(pathname, referer, req.headers.cookie)
        ) {
          next();
          return;
        }

        forwardHttp(req, res, target, next, "/owner-app");
      });
    },
  };
}

/**
 * Proxies scoring-app Vite dev assets requested from root paths when the page
 * was loaded via `/scoring-app/`.
 */
export function scoringAppDevProxyPlugin(): Plugin {
  const target = new URL(getDevScoringAppProxyTarget());

  return {
    name: "bidwar-scoring-app-asset-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";

        if (pathname.startsWith("/scoring-app")) {
          res.setHeader(
            "Set-Cookie",
            `${SCORING_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );
        }

        next();
      });

      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";
        const referer = req.headers.referer ?? "";

        if (
          !shouldProxyScoringAppAsset(pathname, referer, req.headers.cookie)
        ) {
          next();
          return;
        }

        forwardHttp(req, res, target, next, "/scoring-app");
      });
    },
  };
}

/**
 * Proxies mobile-app Vite dev assets requested from root paths when the page
 * was loaded via `/mobile/`.
 */
export function mobileAppDevProxyPlugin(): Plugin {
  const target = new URL(getDevMobileAppProxyTarget());

  return {
    name: "bidwar-mobile-app-asset-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";

        if (pathname.startsWith("/mobile")) {
          res.setHeader(
            "Set-Cookie",
            `${MOBILE_APP_DEV_COOKIE}; Path=/; SameSite=Lax`,
          );
        }

        next();
      });

      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "/";
        const pathname = raw.split("?")[0] ?? "/";
        const referer = req.headers.referer ?? "";

        if (
          !shouldProxyMobileAppAsset(pathname, referer, req.headers.cookie)
        ) {
          next();
          return;
        }

        forwardHttp(req, res, target, next, "/mobile");
      });
    },
  };
}

