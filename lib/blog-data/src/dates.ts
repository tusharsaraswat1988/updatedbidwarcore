import { type BlogPostMeta } from "./index.js";

/** Current UTC calendar date as YYYY-MM-DD. */
export function todayIsoDate(reference = new Date()): string {
  return reference.toISOString().slice(0, 10);
}

/** True when an ISO date string is after the reference calendar day. */
export function isFutureIsoDate(iso: string, reference = new Date()): boolean {
  return iso > todayIsoDate(reference);
}

/** Clamp an ISO date so it never exceeds the reference calendar day. */
export function clampIsoDateToToday(iso: string, reference = new Date()): string {
  const today = todayIsoDate(reference);
  return iso > today ? today : iso;
}

/** Original publication date — must not be in the future for live articles. */
export function getPostDatePublished(post: BlogPostMeta): string {
  return post.publishedAt;
}

/** Latest meaningful revision date, falling back to publish date. */
export function getPostDateModified(post: BlogPostMeta): string {
  return post.updatedAt ?? post.publishedAt;
}

/** Sitemap lastmod: latest of publish/update, capped to today (sitemap spec). */
export function getPostSitemapLastmod(post: BlogPostMeta, reference = new Date()): string {
  return clampIsoDateToToday(getPostDateModified(post), reference);
}

/** ISO-8601 datetime for Open Graph / schema (date-only → midnight UTC). */
export function toIsoDateTime(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

export interface BlogDateAuditRow {
  url: string;
  slug: string;
  visibleDate: string;
  sitemapLastmod: string;
  schemaDatePublished: string;
  schemaDateModified: string;
  consistent: boolean;
  issues: string[];
}

/** Audit a single post for cross-channel date consistency. */
export function auditPostDates(
  post: BlogPostMeta,
  reference = new Date(),
): BlogDateAuditRow {
  const visibleDate = getPostDatePublished(post);
  const schemaDatePublished = getPostDatePublished(post);
  const schemaDateModified = getPostDateModified(post);
  const sitemapLastmod = getPostSitemapLastmod(post, reference);

  const issues: string[] = [];

  if (isFutureIsoDate(visibleDate, reference)) {
    issues.push(`publishedAt ${visibleDate} is in the future`);
  }
  if (schemaDateModified < schemaDatePublished) {
    issues.push(`dateModified ${schemaDateModified} is before datePublished ${schemaDatePublished}`);
  }
  if (sitemapLastmod !== clampIsoDateToToday(schemaDateModified, reference)) {
    issues.push(`sitemap lastmod ${sitemapLastmod} != clamped dateModified ${clampIsoDateToToday(schemaDateModified, reference)}`);
  }
  if (visibleDate !== schemaDatePublished) {
    issues.push("visible date != schema datePublished");
  }

  return {
    url: post.canonical,
    slug: post.slug,
    visibleDate,
    sitemapLastmod,
    schemaDatePublished,
    schemaDateModified,
    consistent: issues.length === 0,
    issues,
  };
}
