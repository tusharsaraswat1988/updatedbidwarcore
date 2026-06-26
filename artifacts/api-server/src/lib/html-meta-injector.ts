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

import { readFileSync } from "fs";
import path from "path";
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
  try {
    cachedHtml = readFileSync(path.join(distDir, "index.html"), "utf-8");
  } catch {
    cachedHtml = null;
  }
}

export function isIndexHtmlLoaded(): boolean {
  return cachedHtml !== null;
}

// ─── Build the meta block ─────────────────────────────────────────────────────

function buildMetaBlock(meta: PageMeta): string {
  const title = esc(meta.title);
  const desc = esc(meta.description);
  const canonical = esc(meta.canonical);
  const ogTitle = esc(meta.ogTitle ?? meta.title);
  const ogDesc = esc(meta.ogDescription ?? meta.description);
  const ogImage = meta.ogImage ? esc(meta.ogImage) : null;
  const twitterTitle = esc(meta.twitterTitle ?? meta.ogTitle ?? meta.title);
  const twitterDesc = esc(meta.twitterDescription ?? meta.ogDescription ?? meta.description);
  const robots = esc(meta.robots ?? "index, follow");
  const keywords = meta.keywords ? `\n    <meta name="keywords" content="${esc(meta.keywords)}" />` : "";
  const ogImageTags = ogImage
    ? `\n    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${ogImage}" />`
    : "";

  return `<!-- PAGE_META_START -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />${keywords}
    <meta name="robots" content="${robots}" />
    <meta name="author" content="BidWar" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BidWar" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:url" content="${canonical}" />${ogImageTags}
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
