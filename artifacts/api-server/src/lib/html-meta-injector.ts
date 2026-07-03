/**
 * Server-side HTML meta injection for marketing and public app pages
 * (including /register/:code player registration links).
 *
 * At startup we read the built index.html once and cache it. For each request
 * that matches a known public marketing route, we replace the marker comment
 * blocks with page-specific <title>, <meta>, canonical, OG/Twitter tags, and
 * JSON-LD <script> elements before sending the HTML.
 *
 * This makes every marketing page crawlable without JavaScript — solving the
 * key SEO gap of a Vite SPA where social crawlers and many bots only read the
 * raw HTML without executing scripts.
 *
 * index.html must contain two pairs of marker comments:
 *   <!-- PAGE_META_START --> ... <!-- PAGE_META_END -->
 *   <!-- PAGE_SCHEMA_START --> ... <!-- PAGE_SCHEMA_END -->
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { injectBrandingIconsIntoHtml } from "@workspace/api-base/branding-icon-head";
import type { PageMeta } from "./page-meta.js";

let cachedHtml: string | null = null;

// ─── HTML escape helper ───────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Load / cache the built index.html ───────────────────────────────────────

export function loadIndexHtml(distDir: string): void {
  loadIndexHtmlFile(path.join(distDir, "index.html"));
}

export function loadIndexHtmlFile(filePath: string): void {
  try {
    cachedHtml = readFileSync(filePath, "utf-8");
  } catch {
    cachedHtml = null;
  }
}

/** Load built index.html when available; fall back to Vite source index in dev. */
export function initSpaIndexShell(options: {
  distDir: string;
  sourceIndexPath?: string;
  /** In dev (Vite), prefer source index so module paths match the dev server. */
  preferSource?: boolean;
}): boolean {
  if (options.preferSource && options.sourceIndexPath && existsSync(options.sourceIndexPath)) {
    loadIndexHtmlFile(options.sourceIndexPath);
    return cachedHtml !== null;
  }
  const builtIndex = path.join(options.distDir, "index.html");
  if (existsSync(builtIndex)) {
    loadIndexHtmlFile(builtIndex);
    return cachedHtml !== null;
  }
  if (options.sourceIndexPath && existsSync(options.sourceIndexPath)) {
    loadIndexHtmlFile(options.sourceIndexPath);
  }
  return cachedHtml !== null;
}

export function isIndexHtmlLoaded(): boolean {
  return cachedHtml !== null;
}

// ─── Build the meta block ─────────────────────────────────────────────────────

function buildMetaBlock(meta: PageMeta): string {
  const title = esc(meta.title);
  const desc = esc(meta.description);
  const ogTitle = esc(meta.ogTitle ?? meta.title);
  const ogDesc = esc(meta.ogDescription ?? meta.description);
  const ogImage = meta.ogImage ? esc(meta.ogImage) : null;
  const twitterTitle = esc(meta.twitterTitle ?? meta.ogTitle ?? meta.title);
  const twitterDesc = esc(meta.twitterDescription ?? meta.ogDescription ?? meta.description);
  const robots = esc(meta.robots ?? "index, follow");
  const keywords = meta.keywords ? `\n    <meta name="keywords" content="${esc(meta.keywords)}" />` : "";
  const canonicalTags = meta.omitCanonical || !meta.canonical
    ? ""
    : `\n    <link rel="canonical" href="${esc(meta.canonical)}" />`;
  const ogUrlTag = meta.omitCanonical || !meta.canonical
    ? ""
    : `\n    <meta property="og:url" content="${esc(meta.canonical)}" />`;
  const ogImageTags = ogImage
    ? `\n    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${ogImage}" />`
    : "";
  const ogType = meta.ogType ?? "website";
  const articleTags =
    ogType === "article" && meta.articlePublishedTime
      ? `\n    <meta property="article:published_time" content="${esc(meta.articlePublishedTime)}" />${
          meta.articleModifiedTime
            ? `\n    <meta property="article:modified_time" content="${esc(meta.articleModifiedTime)}" />`
            : ""
        }`
      : "";

  return `<!-- PAGE_META_START -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />${keywords}
    <meta name="robots" content="${robots}" />
    <meta name="author" content="BidWar" />${canonicalTags}
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="BidWar" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />${ogUrlTag}${ogImageTags}${articleTags}
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />
    <meta name="twitter:site" content="@bidwar_in" />
    <meta name="twitter:title" content="${twitterTitle}" />
    <meta name="twitter:description" content="${twitterDesc}" />
    <!-- PAGE_META_END -->`;
}

// ─── Build the schema block ───────────────────────────────────────────────────

function buildSchemaBlock(meta: PageMeta): string {
  if (!meta.schemas || meta.schemas.length === 0) {
    return "<!-- PAGE_SCHEMA_START --><!-- PAGE_SCHEMA_END -->";
  }

  const scripts = meta.schemas
    .map(
      (schema) =>
        `    <script type="application/ld+json">\n    ${JSON.stringify(schema)}\n    </script>`,
    )
    .join("\n");

  return `<!-- PAGE_SCHEMA_START -->\n${scripts}\n    <!-- PAGE_SCHEMA_END -->`;
}

// ─── Inject into cached HTML ──────────────────────────────────────────────────

const META_RE = /<!-- PAGE_META_START -->[\s\S]*?<!-- PAGE_META_END -->/;
const SCHEMA_RE = /<!-- PAGE_SCHEMA_START -->[\s\S]*?<!-- PAGE_SCHEMA_END -->/;

export function patchBrandingIconsInCachedHtml(version: number): void {
  if (!cachedHtml) return;
  cachedHtml = injectBrandingIconsIntoHtml(cachedHtml, version);
}

/** Patched index.html shell (meta + versioned favicons) for SPA catch-all responses. */
export function getSpaIndexHtml(): string | null {
  return cachedHtml;
}

export function sendSpaIndexHtml(res: {
  status?: (code: number) => typeof res;
  setHeader: (k: string, v: string) => void;
  send: (body: string) => void;
}): boolean {
  const html = getSpaIndexHtml();
  if (!html) return false;
  if (typeof res.status === "function") {
    res.status(200);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(html);
  return true;
}

type HtmlResponse = {
  status: (code: number) => HtmlResponse;
  setHeader: (key: string, value: string) => void;
  send: (body: string) => void;
};

/** Send HTML with injected page meta and an explicit HTTP status code. */
export function sendInjectedHtml(
  res: HtmlResponse,
  meta: PageMeta,
  statusCode = 200,
): boolean {
  const html = injectPageMeta(meta);
  if (!html) return false;
  res.status(statusCode);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(html);
  return true;
}

const ROOT_BEFORE_BODY_RE = /<div id="root">[\s\S]*<\/div>(?=\s*(?:<script|<\/body>))/;

function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Inject SSR markup and hydration payloads into the built index.html shell. */
export function injectSsrHomepageDocument(
  shellHtml: string,
  rootMarkup: string,
  initialData: unknown,
  dehydratedState: unknown,
): string {
  const initialScript = `<script>window.__BIDWAR_INITIAL_DATA__=${serializeForScript(initialData)}</script>`;
  const queryScript = `<script>window.__REACT_QUERY_DEHYDRATED__=${serializeForScript(dehydratedState)}</script>`;

  let html = shellHtml;
  if (ROOT_BEFORE_BODY_RE.test(html)) {
    html = html.replace(ROOT_BEFORE_BODY_RE, `<div id="root">${rootMarkup}</div>`);
  }

  return html.replace(
    '<script type="module"',
    `${initialScript}\n    ${queryScript}\n    <script type="module"`,
  );
}

/** Academy pages ship inline SSR styles — defer the full app stylesheet so LCP is not blocked. */
function deferStylesheetLinks(html: string): string {
  return html.replace(
    /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
    '<link rel="preload" as="style" href="$1" crossorigin onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" crossorigin href="$1"></noscript>',
  );
}

/** Inject crawlable academy markup + hydration payload for /academy routes. */
export function injectAcademySsrDocument(
  shellHtml: string,
  rootMarkup: string,
  academyData: unknown,
  headHints = "",
): string {
  const academyScript = `<script>window.__BIDWAR_ACADEMY_DATA__=${serializeForScript(academyData)}</script>`;
  const ssrStyles = `<style>#root:empty{display:none}#academy-ssr-fallback+#root{position:absolute;inset:0;background:#09090b}.academy-ssr{font-family:system-ui,sans-serif;color:#fafafa;background:#09090b;padding:2rem;max-width:72rem;margin:0 auto;line-height:1.6}.academy-ssr a{color:#facc15}.academy-ssr-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.academy-ssr-card{border:1px solid #27272a;border-radius:.75rem;padding:1rem}.academy-ssr-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:.5rem;height:auto}.academy-ssr-featured img{width:100%;max-height:420px;object-fit:cover;border-radius:.75rem}.academy-ssr-ep{font-size:.75rem;color:#a1a1aa}.academy-ssr-cat{font-size:.875rem;color:#d4d4d8}.academy-ssr-meta{font-size:.75rem;color:#a1a1aa}.academy-ssr-desc{font-size:.875rem;color:#a1a1aa}</style>`;

  let html = deferStylesheetLinks(shellHtml);
  if (headHints) {
    html = html.replace("</head>", `    ${headHints}\n  </head>`);
  }
  if (ROOT_BEFORE_BODY_RE.test(html)) {
    // Keep SSR outside #root so createRoot() does not wipe the LCP hero before React mounts.
    html = html.replace(
      ROOT_BEFORE_BODY_RE,
      `<div id="academy-ssr-fallback">${ssrStyles}${rootMarkup}</div>\n    <div id="root"></div>`,
    );
  }

  return html.replace(
    '<script type="module"',
    `${academyScript}\n    <script type="module"`,
  );
}

export function injectPageMeta(meta: PageMeta): string | null {
  if (!cachedHtml) return null;

  const metaBlock = buildMetaBlock(meta);
  const schemaBlock = buildSchemaBlock(meta);

  let html = cachedHtml;

  if (META_RE.test(html)) {
    html = html.replace(META_RE, metaBlock);
  }
  if (SCHEMA_RE.test(html)) {
    html = html.replace(SCHEMA_RE, schemaBlock);
  }

  return html;
}
