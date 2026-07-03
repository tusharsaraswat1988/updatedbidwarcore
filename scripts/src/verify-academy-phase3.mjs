/**
 * Phase 3 production verification — SEO, sitemaps, schema, head tags.
 * Usage: node scripts/src/verify-academy-phase3.mjs [baseUrl]
 */
const base = (process.argv[2] ?? "http://127.0.0.1:24755").replace(/\/+$/, "");

const REQUIRED_LESSON_TYPES = ["WebPage", "BreadcrumbList", "Article"];
const OPTIONAL_LESSON_TYPES = ["VideoObject"];

function extractAll(html, re) {
  return [...html.matchAll(re)].map((m) => m[1] ?? m[0]);
}

function extractMeta(html, name) {
  if (name === "title") {
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m?.[1] ?? null;
  }
  const patterns = {
    description: /<meta name="description" content="([^"]*)"/i,
    canonical: /<link rel="canonical" href="([^"]+)"/i,
    robots: /<meta name="robots" content="([^"]+)"/i,
    ogTitle: /<meta property="og:title" content="([^"]+)"/i,
    ogDescription: /<meta property="og:description" content="([^"]+)"/i,
    ogUrl: /<meta property="og:url" content="([^"]+)"/i,
    ogImage: /<meta property="og:image" content="([^"]+)"/i,
    ogType: /<meta property="og:type" content="([^"]+)"/i,
    twitterCard: /<meta name="twitter:card" content="([^"]+)"/i,
    twitterTitle: /<meta name="twitter:title" content="([^"]+)"/i,
    twitterImage: /<meta name="twitter:image" content="([^"]+)"/i,
  };
  const m = html.match(patterns[name]);
  return m?.[1] ?? null;
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(block[1]));
    } catch {
      blocks.push(null);
    }
  }
  return blocks;
}

function extractJsonLdTypes(html) {
  const types = new Set();
  for (const parsed of extractJsonLdBlocks(html)) {
    if (!parsed) continue;
    const graphs = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of graphs) {
      const graph = item["@graph"] ?? [item];
      for (const node of graph) {
        if (node["@type"]) types.add(node["@type"]);
      }
    }
  }
  return [...types].sort();
}

function countDuplicates(arr) {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1);
}

function parseSitemapUrls(xml) {
  const urls = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]);
  return urls;
}

function parseSitemapLastmods(xml) {
  return [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
}

async function fetchText(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xml,*/*" },
    redirect: "manual",
  });
  const body = await res.text();
  return { path, url, status: res.status, location: res.headers.get("location"), body };
}

async function findLessonSlug() {
  try {
    const apiBase = base.includes(":24755") ? base.replace(":24755", ":8080") : base.replace(/:\d+$/, ":8080");
    const res = await fetch(`${apiBase}/api/academy/lessons`);
    if (!res.ok) return null;
    const lessons = await res.json();
    return lessons[0]?.slug ?? null;
  } catch {
    return null;
  }
}

function auditHead(path, html) {
  const issues = [];
  const titles = extractAll(html, /<title>([^<]*)<\/title>/gi);
  const canonicals = extractAll(html, /<link rel="canonical" href="([^"]+)"/gi);
  const robots = extractAll(html, /<meta name="robots" content="([^"]+)"/gi);
  const ldBlocks = extractJsonLdBlocks(html);

  if (titles.length !== 1) issues.push(`title count=${titles.length} (expected 1)`);
  if (canonicals.length !== 1) issues.push(`canonical count=${canonicals.length} (expected 1)`);
  if (robots.length !== 1) issues.push(`robots count=${robots.length} (expected 1)`);
  if (ldBlocks.length !== 1) issues.push(`JSON-LD block count=${ldBlocks.length} (expected 1)`);

  for (const field of ["description", "ogTitle", "ogDescription", "ogUrl", "twitterCard", "twitterTitle"]) {
    if (!extractMeta(html, field)) issues.push(`missing ${field}`);
  }

  const dupCanonicals = countDuplicates(canonicals);
  if (dupCanonicals.length) issues.push(`duplicate canonicals: ${JSON.stringify(dupCanonicals)}`);

  return {
    title: extractMeta(html, "title"),
    description: extractMeta(html, "description"),
    canonical: extractMeta(html, "canonical"),
    robots: extractMeta(html, "robots"),
    ogTitle: extractMeta(html, "ogTitle"),
    ogDescription: extractMeta(html, "ogDescription"),
    ogUrl: extractMeta(html, "ogUrl"),
    ogImage: extractMeta(html, "ogImage"),
    ogType: extractMeta(html, "ogType"),
    twitterCard: extractMeta(html, "twitterCard"),
    twitterTitle: extractMeta(html, "twitterTitle"),
    twitterImage: extractMeta(html, "twitterImage"),
    jsonLdTypes: extractJsonLdTypes(html),
    firstLines: html.split(/\r?\n/).slice(0, 20),
    issues,
  };
}

function auditLessonSchema(types) {
  const issues = [];
  for (const t of REQUIRED_LESSON_TYPES) {
    if (!types.includes(t)) issues.push(`missing schema type: ${t}`);
  }
  return issues;
}

console.log(`\n=== Academy Phase 3 verification — ${base} ===\n`);

const results = { passed: 0, failed: 0, checks: [] };

function report(name, ok, detail) {
  results.checks.push({ name, ok, detail });
  if (ok) results.passed++;
  else results.failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  if (detail) console.log(`       ${detail}`);
}

// Homepage
const home = await fetchText("/academy");
report("GET /academy returns 200", home.status === 200, `status=${home.status}`);
const homeAudit = auditHead("/academy", home.body);
report("Homepage head tags complete", homeAudit.issues.length === 0, homeAudit.issues.join("; ") || "all required tags present");
report("Homepage has SSR payload", home.body.includes("__BIDWAR_ACADEMY_DATA__") || home.body.includes("academy-ssr"), "");
console.log("\n--- Homepage head ---");
console.log(`title: ${homeAudit.title}`);
console.log(`canonical: ${homeAudit.canonical}`);
console.log(`robots: ${homeAudit.robots}`);
console.log(`og:type: ${homeAudit.ogType}`);
console.log(`JSON-LD: ${homeAudit.jsonLdTypes.join(", ")}`);
console.log("\n--- View source (first 20 lines) ---");
for (const line of homeAudit.firstLines) console.log(line);

// Lesson page
const slug = await findLessonSlug();
if (slug) {
  const lesson = await fetchText(`/academy/${slug}`);
  report(`GET /academy/${slug} returns 200`, lesson.status === 200, `status=${lesson.status}`);
  const lessonAudit = auditHead(`/academy/${slug}`, lesson.body);
  const schemaIssues = auditLessonSchema(lessonAudit.jsonLdTypes);
  const allIssues = [...lessonAudit.issues, ...schemaIssues];
  report("Lesson head tags + schema", allIssues.length === 0, allIssues.join("; ") || "complete");
  report(
    "Lesson VideoObject when YouTube present",
    !lesson.body.includes("youtube") || lessonAudit.jsonLdTypes.includes("VideoObject"),
    lessonAudit.jsonLdTypes.join(", "),
  );
  console.log("\n--- Lesson head ---");
  console.log(`title: ${lessonAudit.title}`);
  console.log(`description: ${lessonAudit.description?.slice(0, 80)}…`);
  console.log(`canonical: ${lessonAudit.canonical}`);
  console.log(`robots: ${lessonAudit.robots}`);
  console.log(`og:image: ${lessonAudit.ogImage ?? "(platform default)"}`);
  console.log(`twitter:card: ${lessonAudit.twitterCard}`);
  console.log(`JSON-LD types: ${lessonAudit.jsonLdTypes.join(", ")}`);
  const ldBlock = extractJsonLdBlocks(lesson.body)[0];
  if (ldBlock) {
    console.log("\n--- Schema output (truncated) ---");
    console.log(JSON.stringify(ldBlock, null, 2).slice(0, 2000));
  }
} else {
  report("Lesson page probe", false, "no published lessons in DB");
}

// Sitemaps
const sitemapIndex = await fetchText("/sitemap-index.xml");
report("sitemap-index.xml 200", sitemapIndex.status === 200, `status=${sitemapIndex.status}`);

const sitemapAcademy = await fetchText("/sitemap-academy.xml");
report("sitemap-academy.xml 200", sitemapAcademy.status === 200, `status=${sitemapAcademy.status}`);

const academyUrls = parseSitemapUrls(sitemapAcademy.body);
const dupUrls = countDuplicates(academyUrls);
report("No duplicate academy sitemap URLs", dupUrls.length === 0, dupUrls.length ? JSON.stringify(dupUrls) : `${academyUrls.length} URLs`);
report("Academy index in sitemap", academyUrls.some((u) => u.endsWith("/academy")), academyUrls[0] ?? "empty");

const lastmods = parseSitemapLastmods(sitemapAcademy.body);
const invalidLastmod = lastmods.filter((d) => !/^\d{4}-\d{2}-\d{2}/.test(d));
report("Valid lastmod dates", invalidLastmod.length === 0, invalidLastmod.length ? invalidLastmod.join(", ") : `${lastmods.length} dates`);

console.log("\n--- sitemap-academy.xml (first 30 lines) ---");
console.log(sitemapAcademy.body.split(/\r?\n/).slice(0, 30).join("\n"));

const sitemapRoot = await fetchText("/sitemap.xml");
report(
  "sitemap.xml redirects to index",
  sitemapRoot.status === 301 && (sitemapRoot.location?.includes("sitemap-index") ?? false),
  `status=${sitemapRoot.status} location=${sitemapRoot.location ?? "none"}`,
);

console.log("\n=== Summary ===");
console.log(`Passed: ${results.passed}  Failed: ${results.failed}`);
process.exit(results.failed > 0 ? 1 : 0);
