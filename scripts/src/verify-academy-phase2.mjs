/**
 * Runtime verification for public Academy Phase 2 endpoints.
 * Usage: node scripts/src/verify-academy-phase2.mjs [baseUrl]
 */
const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/+$/, "");

const ENDPOINTS = [
  "/academy",
  "/sitemap-academy.xml",
  "/sitemap-index.xml",
  "/sitemap.xml",
];

function extractMeta(html, name) {
  if (name === "title") {
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m?.[1] ?? null;
  }
  if (name === "canonical") {
    const m = html.match(/<link rel="canonical" href="([^"]+)"/i);
    return m?.[1] ?? null;
  }
  if (name === "robots") {
    const m = html.match(/<meta name="robots" content="([^"]+)"/i);
    return m?.[1] ?? null;
  }
  return null;
}

function extractJsonLdTypes(html) {
  const types = new Set();
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1]);
      const graphs = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of graphs) {
        const graph = item["@graph"] ?? [item];
        for (const node of graph) {
          if (node["@type"]) types.add(node["@type"]);
        }
      }
    } catch {
      /* ignore malformed blocks */
    }
  }
  return [...types].sort();
}

function countSitemapEntries(xml) {
  return (xml.match(/<url>/g) ?? []).length;
}

async function probe(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xml,*/*" },
    redirect: "manual",
  });
  const body = await res.text();
  const lines = body.split(/\r?\n/).slice(0, 20);
  const isXml = path.includes("sitemap") || path.includes("robots");
  const title = isXml ? null : extractMeta(body, "title");
  const canonical = isXml ? null : extractMeta(body, "canonical");
  const robots = isXml ? null : extractMeta(body, "robots");
  const jsonLdTypes = isXml ? [] : extractJsonLdTypes(body);
  const sitemapCount = isXml && body.includes("<urlset") ? countSitemapEntries(body) : null;
  const hasSsr = body.includes("academy-ssr") || body.includes("__BIDWAR_ACADEMY_DATA__");

  return {
    path,
    url,
    status: res.status,
    location: res.headers.get("location"),
    firstLines: lines,
    title,
    canonical,
    robots,
    jsonLdTypes,
    sitemapCount,
    hasSsr,
  };
}

async function findLessonSlug() {
  try {
    const apiBase = base.includes(":3000")
      ? base.replace(":3000", ":8080")
      : base;
    const res = await fetch(`${apiBase}/api/academy/lessons`);
    if (!res.ok) return null;
    const lessons = await res.json();
    return lessons[0]?.slug ?? null;
  } catch {
    return null;
  }
}

console.log(`\nAcademy Phase 2 runtime verification — base: ${base}\n`);

for (const path of ENDPOINTS) {
  const r = await probe(path);
  console.log("=".repeat(72));
  console.log(`GET ${path}`);
  console.log(`HTTP status: ${r.status}${r.location ? ` → ${r.location}` : ""}`);
  if (r.title) console.log(`title: ${r.title}`);
  if (r.canonical) console.log(`canonical: ${r.canonical}`);
  if (r.robots) console.log(`robots: ${r.robots}`);
  if (r.jsonLdTypes.length) console.log(`JSON-LD types: ${r.jsonLdTypes.join(", ")}`);
  if (r.sitemapCount != null) console.log(`sitemap entry count: ${r.sitemapCount}`);
  if (path === "/academy") console.log(`SSR injected: ${r.hasSsr ? "yes" : "no"}`);
  console.log("first 20 lines:");
  for (const line of r.firstLines) console.log(line);
  console.log();
}

const slug = await findLessonSlug();
if (slug) {
  const r = await probe(`/academy/${slug}`);
  console.log("=".repeat(72));
  console.log(`GET /academy/${slug}`);
  console.log(`HTTP status: ${r.status}`);
  if (r.title) console.log(`title: ${r.title}`);
  if (r.canonical) console.log(`canonical: ${r.canonical}`);
  if (r.robots) console.log(`robots: ${r.robots}`);
  if (r.jsonLdTypes.length) console.log(`JSON-LD types: ${r.jsonLdTypes.join(", ")}`);
  console.log(`SSR injected: ${r.hasSsr ? "yes" : "no"}`);
  console.log("first 20 lines:");
  for (const line of r.firstLines) console.log(line);
} else {
  console.log("(no published lessons in DB — skipped /academy/:slug probe)");
}
